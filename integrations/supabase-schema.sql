-- TURNOVER — schema Supabase (Postgres) + Row Level Security
-- Modello multi-tenant: una "organizzazione" per coordinatore; staff/capoturno vi accedono via email autorizzata.
-- Eseguire nell'editor SQL di Supabase. NON eseguito nell'ambiente offline di sviluppo.

-- 1) Organizzazioni (workspace del coordinatore)
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  nome text not null,
  created_at timestamptz default now()
);

-- 2) Membership: elenco accessi autorizzati (OWNER/CAPOTURNO/STAFF)
create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  inf_id text,
  nome text not null,
  cognome text,
  email text not null,
  ruolo text not null check (ruolo in ('OWNER','CAPOTURNO','STAFF')),
  stato text not null default 'invitato' check (stato in ('invitato','attivo','revocato')),
  ultimo_accesso timestamptz,
  created_at timestamptz default now(),
  unique (org_id, email)
);

-- 3) Richieste ferie/desiderate
create table if not exists requests (
  id text primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  inf_id text not null,
  day int not null,
  to_day int,
  month int not null,
  year int not null,
  tipo text not null,
  stato text not null default 'pending' check (stato in ('pending','approved','rejected')),
  motivo text,
  commento text,           -- visibile solo al richiedente (vedi policy)
  created_at timestamptz default now()
);

-- 4) Outbox sincronizzata (operazioni offline-first; payload generico)
create table if not exists sync_ops (
  id text primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  ts bigint not null,
  entity text not null,
  action text not null,
  payload jsonb,
  created_at timestamptz default now()
);

-- 5) Snapshot di stato (reparti/staff/ferie/pianos serializzati) per il pull
create table if not exists app_state (
  org_id uuid primary key references organizations(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz default now()
);

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table organizations enable row level security;
alter table memberships  enable row level security;
alter table requests     enable row level security;
alter table sync_ops     enable row level security;
alter table app_state    enable row level security;

-- Helper: l'utente corrente appartiene all'org (per email) ed è attivo
create or replace function is_member(o uuid) returns boolean language sql stable as $$
  select exists (
    select 1 from memberships m
    where m.org_id = o and m.email = auth.jwt() ->> 'email' and m.stato = 'attivo'
  );
$$;

create or replace function is_owner(o uuid) returns boolean language sql stable as $$
  select exists (select 1 from organizations org where org.id = o and org.owner_id = auth.uid());
$$;

-- Organizations: l'owner vede/gestisce la propria
create policy org_owner on organizations for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Memberships: l'owner gestisce; i membri leggono la propria org
create policy mem_owner_all on memberships for all using (is_owner(org_id)) with check (is_owner(org_id));
create policy mem_member_read on memberships for select using (is_member(org_id));

-- Requests: i membri vedono le richieste dell'org; l'owner gestisce tutto; il commento di rifiuto
-- è leggibile solo dal richiedente o dall'owner (la app filtra il campo commento di conseguenza).
create policy req_member_read on requests for select using (is_member(org_id));
create policy req_member_insert on requests for insert with check (is_member(org_id));
create policy req_owner_update on requests for update using (is_owner(org_id)) with check (is_owner(org_id));

-- sync_ops / app_state: solo membri attivi dell'org
create policy sync_member on sync_ops for all using (is_member(org_id)) with check (is_member(org_id));
create policy state_member on app_state for all using (is_member(org_id)) with check (is_member(org_id));

-- Nota: il "commento visibile solo al richiedente" si applica a livello applicativo
-- (la app non mostra requests.commento agli altri membri) e può essere irrobustito con una
-- view dedicata che esponga commento solo se inf_id = membership corrente o is_owner.
