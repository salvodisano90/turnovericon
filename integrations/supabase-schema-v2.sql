-- ============================================================================
-- TURNOVER — Schema relazionale enterprise (FASE 3) — sostituisce app_state(jsonb)
-- Postgres / Supabase. Multi-organizzazione, multi-reparto, soft-delete, audit.
-- Principio: nessun dato può diventare orfano (FK + on delete cascade/restrict).
-- ============================================================================
create extension if not exists "pgcrypto";

-- ── Anagrafiche di base ─────────────────────────────────────────────────────
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table roles (
  code        text primary key,         -- SUPER_ADMIN | OWNER | MANAGER | STAFF | READ_ONLY
  descr       text not null
);
insert into roles(code,descr) values
  ('SUPER_ADMIN','Amministrazione piattaforma'),('OWNER','Titolare organizzazione'),
  ('MANAGER','Coordinatore di reparto'),('STAFF','Operatore'),('READ_ONLY','Sola lettura')
  on conflict do nothing;

-- users: estende auth.users di Supabase (1:1 via id)
create table users (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid not null references organizations(id) on delete cascade,
  email       text not null,
  nome        text not null,
  role        text not null references roles(code) default 'STAFF',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (org_id, email)
);
create index on users(org_id);

-- ── Dominio operativo ───────────────────────────────────────────────────────
create table wards (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  nome        text not null,
  sigla       text,
  settori     jsonb not null default '{}'::jsonb,   -- {M:n,P:n,N:n}
  orari       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (org_id, nome)
);
create index on wards(org_id);

create table matrices (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  nome        text not null,
  seq         text not null,            -- es. 'MPRNNRR'
  notti       int  not null default 0,
  is_custom   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (org_id, nome)
);
create index on matrices(org_id);

create table seasonal_matrices (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  ward_id     uuid references wards(id) on delete cascade,
  config      jsonb not null,           -- finestre stagionali → matrice
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table staff (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid references users(id) on delete set null,  -- collega l'operatore al login (se presente)
  nome        text not null,
  qualifica   text,
  contratto   text,
  matrice_id  uuid references matrices(id) on delete set null,
  offset_ciclo int not null default 0,
  notti_ciclo int not null default 1,
  esenzioni   jsonb not null default '{}'::jsonb,
  ferie_annue int not null default 26,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index on staff(org_id);
create index on staff(matrice_id);

-- staff ↔ wards (un operatore può coprire più reparti)
create table staff_wards (
  staff_id    uuid not null references staff(id) on delete cascade,
  ward_id     uuid not null references wards(id) on delete cascade,
  primary key (staff_id, ward_id)
);

create table shifts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  ward_id     uuid not null references wards(id) on delete cascade,
  staff_id    uuid not null references staff(id) on delete cascade,
  giorno      date not null,
  turno       text not null,            -- M|P|N|R|S|F
  locked      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (staff_id, giorno)             -- un solo turno per operatore al giorno
);
create index on shifts(org_id, giorno);
create index on shifts(ward_id, giorno);

create table absences (   -- malattia/infortunio/104/maternità/permesso
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  staff_id    uuid not null references staff(id) on delete cascade,
  dal         date not null,
  al          date not null,
  tipo        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  check (al >= dal)
);
create index on absences(org_id, staff_id);

create table vacations (  -- ferie (separate per reporting/contatori)
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  staff_id    uuid not null references staff(id) on delete cascade,
  dal         date not null,
  al          date not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  check (al >= dal)
);
create index on vacations(org_id, staff_id);

create table desiderata (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  staff_id    uuid not null references staff(id) on delete cascade,
  giorno      date not null,
  preferenza  text not null,            -- preferito|indisponibile
  created_at  timestamptz not null default now(),
  unique (staff_id, giorno)
);

create table requests (   -- cambio turno, permesso, straordinario...
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  staff_id    uuid not null references staff(id) on delete cascade,
  tipo        text not null,
  stato       text not null default 'pending',  -- pending|approved|rejected
  payload     jsonb not null default '{}'::jsonb,
  decided_by  uuid references users(id) on delete set null,
  commento    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on requests(org_id, stato);

create table availability (  -- disponibilità operatore per reperibilità
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  staff_id    uuid not null references staff(id) on delete cascade,
  giorno      date not null,
  fascia      text,
  stato       text not null default 'attesa',   -- attesa|approvata|rifiutata
  created_at  timestamptz not null default now(),
  unique (staff_id, giorno, fascia)
);

create table on_call (   -- reperibilità assegnata
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  ward_id     uuid references wards(id) on delete cascade,
  staff_id    uuid not null references staff(id) on delete cascade,
  giorno      date not null,
  fascia      text,
  created_at  timestamptz not null default now()
);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  tipo        text not null,
  testo       text not null,
  letta       boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on notifications(user_id, letta);

create table invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  token       text not null unique,
  email       text not null,
  ruolo       text not null references roles(code) default 'STAFF',
  stato       text not null default 'pending',   -- pending|accepted|revoked|expired
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on invitations(org_id, email);

create table ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  titolo      text,
  created_at  timestamptz not null default now()
);
create table ai_messages (
  id          uuid primary key default gen_random_uuid(),
  conv_id     uuid not null references ai_conversations(id) on delete cascade,
  ruolo       text not null,            -- user|assistant
  contenuto   text not null,
  created_at  timestamptz not null default now()
);
create index on ai_messages(conv_id);

create table settings (
  org_id      uuid primary key references organizations(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,   -- preferenze NON di dominio (tema, flag)
  updated_at  timestamptz not null default now()
);

create table attachments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  owner_user  uuid references users(id) on delete set null,
  storage_key text not null,            -- riferimento a Supabase Storage
  mime        text,
  created_at  timestamptz not null default now()
);

create table audit_log (   -- append-only, conformità sanitaria (FASE 11)
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  seq         bigint generated always as identity,
  actor_user  uuid references users(id) on delete set null,
  actor_email text,
  role        text,
  azione      text not null,
  entita      text,
  target      text,
  before      jsonb,
  after       jsonb,
  motivo      text,
  ip          inet,
  device      text,
  session_id  text,
  ts          timestamptz not null default now()
);
create index on audit_log(org_id, ts);

create table sync_queue (  -- mirror server della coda client (telemetria/replay)
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  entity      text not null,
  action      text not null,
  payload     jsonb not null,
  applied_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- trigger updated_at
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
do $$ declare t text;
begin for t in select unnest(array['organizations','users','wards','matrices','seasonal_matrices','staff','shifts','absences','vacations','requests']) loop
  execute format('create trigger trg_%s_touch before update on %s for each row execute function touch_updated_at();', t, t);
end loop; end $$;
