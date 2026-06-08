-- TURNOVER — Backend Supabase/Postgres — Migrazione 0001: SCHEMA
-- Multi-tenant per organizzazione. Strutture annidate (orari, settori, postazioni,
-- minimi, esenzioni, competenze, Piano) salvate come JSONB, coerenti col modello dell'app.
-- NOTA: non eseguito in ambiente offline. Da applicare sul progetto Supabase reale.

create extension if not exists "pgcrypto";

-- Schema helper per le funzioni di sicurezza
create schema if not exists app;

-- ─────────────────────────────────────────────────────────────────────────────
-- ORGANIZZAZIONI E IDENTITÀ
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references auth.users(id) on delete restrict,
  created_at  timestamptz not null default now()
);

-- Profilo: collega un utente auth a un'organizzazione, con ruolo e (eventuale) operatore.
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role            text not null default 'STAFF' check (role in ('OWNER','STAFF')),
  staff_id        text,                -- collegamento a public.staff.id (se STAFF è un operatore)
  email           text,
  display_name    text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_profiles_org on public.profiles(organization_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- DATI GESTIONALI (tutti vincolati all'organizzazione)
-- ─────────────────────────────────────────────────────────────────────────────

-- Reparti (id mantiene l'identificatore generato dall'app)
create table if not exists public.reparti (
  id              text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome            text not null,
  sigla           text not null default '',
  orari           jsonb not null default '{}'::jsonb,   -- OrariSet
  matrice         text not null default '',
  seasonal        jsonb,                                  -- SeasonalConfig
  postazioni      jsonb,                                  -- Postazione[]
  minimi          jsonb,                                  -- RepartoMinimi
  settori         jsonb not null default '{"M":0,"P":0,"N":0}'::jsonb,
  created_at      timestamptz not null default now(),
  primary key (organization_id, id)
);

-- Personale. ATTENZIONE: contiene campi SENSIBILI (esenzioni, competenze, note, livello…)
-- → la tabella base è accessibile solo all'OWNER; lo STAFF legge la vista sanitizzata.
create table if not exists public.staff (
  id                 text not null,
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  nome               text not null,
  qualifica          text not null default 'Infermiere',
  contratto          text not null default 'FT36',
  notti_per_ciclo    int  not null default 0,
  matrice            text not null default '',
  "offset"           int  not null default 0,
  reparti            jsonb not null default '[]'::jsonb,
  esenzioni_turni    jsonb not null default '[]'::jsonb,   -- SENSIBILE
  esenzioni_settori  jsonb not null default '[]'::jsonb,   -- SENSIBILE
  ore_settimanali    int,
  ferie_annue        int,
  count_in_coverage  boolean,
  -- campi sensibili / riservati al coordinatore
  esente_weekend     boolean,
  esente_festivi     boolean,
  preferenze         jsonb,
  competenze         jsonb,
  anni_esperienza    int,
  livello            text,
  note               text,
  seasonal           jsonb,
  created_at         timestamptz not null default now(),
  primary key (organization_id, id)
);

-- Assenze / ferie
create table if not exists public.ferie (
  id              bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inf_id          text not null,
  from_day        int  not null,
  to_day          int  not null,
  month           int  not null,         -- 0-based
  year            int  not null,
  motivo          text,
  tipo            text,
  note            text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_ferie_org on public.ferie(organization_id, year, month);

-- Piani turni: un documento JSONB per (organizzazione, mese)
create table if not exists public.pianos (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  month_key       text not null,                 -- es. "2026-05"
  data            jsonb not null default '{}'::jsonb,  -- Record<infId, Record<day, Cell>>
  updated_at      timestamptz not null default now(),
  primary key (organization_id, month_key)
);

-- Richieste dello staff (ApprovalRequest)
create table if not exists public.requests (
  id              text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inf_id          text not null,
  day             int  not null,
  to_day          int,
  month           int  not null,
  year            int  not null,
  tipo            text not null,
  stato           text not null default 'inviata',
  motivo          text,
  commento        text,
  created_at      timestamptz not null default now(),
  primary key (organization_id, id)
);
create index if not exists idx_requests_org on public.requests(organization_id, stato);
create index if not exists idx_requests_inf on public.requests(organization_id, inf_id);

-- Reperibilità (overlay)
create table if not exists public.reperibilita (
  id              text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inf_id          text not null,
  day             int  not null,
  month           int  not null,
  year            int  not null,
  richiamato      boolean not null default false,
  richiamo_turno  text,
  note            text,
  created_at      timestamptz not null default now(),
  primary key (organization_id, id)
);
create index if not exists idx_rep_org on public.reperibilita(organization_id, year, month);

-- Desiderata
create table if not exists public.desiderata (
  id              text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inf_id          text not null,
  date_start      date not null,
  date_end        date,
  tipo            text not null,
  priorita        text not null,
  primary key (organization_id, id)
);

-- Registro audit (append-only)
create table if not exists public.audit (
  id              text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ts              timestamptz not null default now(),
  op              text not null,
  entity          text not null,
  before          text,
  after           text,
  actor           text,
  motivo          text,
  primary key (organization_id, id)
);
create index if not exists idx_audit_org on public.audit(organization_id, ts desc);

-- Impostazioni per organizzazione (riga singola)
create table if not exists public.org_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  mode            text not null default 'operativa',
  ai_mode         text not null default 'coordinatore',
  matrice_mese    jsonb not null default '{}'::jsonb,
  matrici_custom  jsonb not null default '[]'::jsonb,
  profile         jsonb,
  updated_at      timestamptz not null default now()
);

-- Trigger updated_at per le tabelle "documento"
create or replace function app.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_pianos_touch on public.pianos;
create trigger trg_pianos_touch before update on public.pianos
  for each row execute function app.touch_updated_at();

drop trigger if exists trg_settings_touch on public.org_settings;
create trigger trg_settings_touch before update on public.org_settings
  for each row execute function app.touch_updated_at();
