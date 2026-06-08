-- TURNOVER — Backend Supabase/Postgres — Migrazione 0002: SICUREZZA (RLS)
-- Modello: OWNER (coordinatore) = pieno accesso ai dati della PROPRIA organizzazione.
--          STAFF = vede solo i propri dati + vista personale SENZA campi sensibili.
-- NOTA: non eseguito offline. Presuppone Postgres 15+ (Supabase) per le viste security-definer.

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNZIONI HELPER (SECURITY DEFINER, STABLE) — leggono il profilo del chiamante
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function app.current_org() returns uuid
  language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

create or replace function app.current_role() returns text
  language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function app.current_staff_id() returns text
  language sql stable security definer set search_path = public as $$
  select staff_id from public.profiles where id = auth.uid()
$$;

create or replace function app.is_owner() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'OWNER' from public.profiles where id = auth.uid()), false)
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ABILITA RLS SU TUTTE LE TABELLE
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.organizations enable row level security;
alter table public.profiles      enable row level security;
alter table public.reparti       enable row level security;
alter table public.staff         enable row level security;
alter table public.ferie         enable row level security;
alter table public.pianos        enable row level security;
alter table public.requests      enable row level security;
alter table public.reperibilita  enable row level security;
alter table public.desiderata    enable row level security;
alter table public.audit         enable row level security;
alter table public.org_settings  enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- ORGANIZATIONS — un utente vede/gestisce solo la propria organizzazione
-- ─────────────────────────────────────────────────────────────────────────────
create policy org_select on public.organizations for select to authenticated
  using (id = app.current_org());
create policy org_insert on public.organizations for insert to authenticated
  with check (owner_id = auth.uid());          -- creazione al primo accesso
create policy org_update on public.organizations for update to authenticated
  using (id = app.current_org() and app.is_owner()) with check (owner_id = auth.uid());

-- PROFILES — visibili nell'organizzazione; l'OWNER li gestisce; ognuno crea il proprio
create policy prof_select on public.profiles for select to authenticated
  using (organization_id = app.current_org());
create policy prof_insert_self on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy prof_owner_write on public.profiles for update to authenticated
  using (organization_id = app.current_org() and app.is_owner());
create policy prof_owner_delete on public.profiles for delete to authenticated
  using (organization_id = app.current_org() and app.is_owner());

-- ─────────────────────────────────────────────────────────────────────────────
-- REPARTI / ORG_SETTINGS — lettura nell'org, scrittura solo OWNER
-- ─────────────────────────────────────────────────────────────────────────────
create policy reparti_read on public.reparti for select to authenticated
  using (organization_id = app.current_org());
create policy reparti_write on public.reparti for all to authenticated
  using (organization_id = app.current_org() and app.is_owner())
  with check (organization_id = app.current_org() and app.is_owner());

create policy settings_read on public.org_settings for select to authenticated
  using (organization_id = app.current_org());
create policy settings_write on public.org_settings for all to authenticated
  using (organization_id = app.current_org() and app.is_owner())
  with check (organization_id = app.current_org() and app.is_owner());

-- ─────────────────────────────────────────────────────────────────────────────
-- STAFF (tabella base = SENSIBILE) — accesso diretto SOLO all'OWNER.
-- Lo STAFF NON legge questa tabella: usa la vista staff_public (sotto).
-- ─────────────────────────────────────────────────────────────────────────────
create policy staff_owner_only on public.staff for all to authenticated
  using (organization_id = app.current_org() and app.is_owner())
  with check (organization_id = app.current_org() and app.is_owner());

-- Vista personale SANITIZZATA: solo colonne non sensibili, isolata per organizzazione.
-- security_invoker=false (default PG15) → bypassa la RLS della tabella base, ma:
--  • filtra per organizzazione del chiamante
--  • espone esclusivamente le colonne sicure (rispecchia utils/privacy.ts)
create or replace view public.staff_public
  with (security_invoker = false) as
  select id, organization_id, nome, qualifica, matrice, reparti, settori
  from public.staff
  where organization_id = app.current_org();
grant select on public.staff_public to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PIANI — l'OWNER legge/scrive tutto; lo STAFF legge solo i PROPRI turni (funzione).
-- ─────────────────────────────────────────────────────────────────────────────
create policy pianos_owner_all on public.pianos for all to authenticated
  using (organization_id = app.current_org() and app.is_owner())
  with check (organization_id = app.current_org() and app.is_owner());

-- Turni del solo chiamante (STAFF): estrae data->staff_id dal piano del mese.
create or replace function public.my_shifts(p_month_key text)
  returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((data -> app.current_staff_id()), '{}'::jsonb)
  from public.pianos
  where organization_id = app.current_org() and month_key = p_month_key
$$;
grant execute on function public.my_shifts(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RICHIESTE — OWNER tutte; STAFF solo le proprie. Approvazione (UPDATE stato) solo OWNER.
-- ─────────────────────────────────────────────────────────────────────────────
create policy req_select on public.requests for select to authenticated
  using (organization_id = app.current_org()
         and (app.is_owner() or inf_id = app.current_staff_id()));
create policy req_insert on public.requests for insert to authenticated
  with check (organization_id = app.current_org()
              and (app.is_owner() or inf_id = app.current_staff_id()));
create policy req_owner_update on public.requests for update to authenticated
  using (organization_id = app.current_org() and app.is_owner());  -- solo OWNER approva/rifiuta
create policy req_delete on public.requests for delete to authenticated
  using (organization_id = app.current_org()
         and (app.is_owner() or (inf_id = app.current_staff_id() and stato = 'inviata')));

-- ─────────────────────────────────────────────────────────────────────────────
-- FERIE / REPERIBILITÀ — OWNER tutto; STAFF lettura solo delle proprie.
-- ─────────────────────────────────────────────────────────────────────────────
create policy ferie_select on public.ferie for select to authenticated
  using (organization_id = app.current_org()
         and (app.is_owner() or inf_id = app.current_staff_id()));
create policy ferie_write on public.ferie for all to authenticated
  using (organization_id = app.current_org() and app.is_owner())
  with check (organization_id = app.current_org() and app.is_owner());

create policy rep_select on public.reperibilita for select to authenticated
  using (organization_id = app.current_org()
         and (app.is_owner() or inf_id = app.current_staff_id()));
create policy rep_write on public.reperibilita for all to authenticated
  using (organization_id = app.current_org() and app.is_owner())
  with check (organization_id = app.current_org() and app.is_owner());

-- ─────────────────────────────────────────────────────────────────────────────
-- DESIDERATA — OWNER tutto; STAFF gestisce solo i propri.
-- ─────────────────────────────────────────────────────────────────────────────
create policy des_select on public.desiderata for select to authenticated
  using (organization_id = app.current_org()
         and (app.is_owner() or inf_id = app.current_staff_id()));
create policy des_staff_write on public.desiderata for all to authenticated
  using (organization_id = app.current_org()
         and (app.is_owner() or inf_id = app.current_staff_id()))
  with check (organization_id = app.current_org()
              and (app.is_owner() or inf_id = app.current_staff_id()));

-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT — append-only: lettura OWNER, inserimento nell'org, nessun update/delete.
-- ─────────────────────────────────────────────────────────────────────────────
create policy audit_read on public.audit for select to authenticated
  using (organization_id = app.current_org() and app.is_owner());
create policy audit_insert on public.audit for insert to authenticated
  with check (organization_id = app.current_org());
-- (nessuna policy UPDATE/DELETE → negati di default con RLS attiva)
