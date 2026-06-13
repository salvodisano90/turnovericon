-- ============================================================================
-- TURNOVER — RLS enterprise (FASE 5). Isolamento per organizzazione + per ruolo.
-- Helper: org dell'utente e ruolo, da users (1:1 con auth.uid()).
-- ============================================================================
create or replace function auth_org() returns uuid language sql stable as $$
  select org_id from users where id = auth.uid() and deleted_at is null
$$;
create or replace function auth_role() returns text language sql stable as $$
  select role from users where id = auth.uid() and deleted_at is null
$$;
create or replace function is_staff_self(p_staff uuid) returns boolean language sql stable as $$
  select exists(select 1 from staff s where s.id = p_staff and s.user_id = auth.uid())
$$;

-- Abilita RLS ovunque
do $$ declare t text; begin
  for t in select unnest(array['organizations','users','wards','matrices','seasonal_matrices','staff','staff_wards','shifts','absences','vacations','desiderata','requests','availability','on_call','notifications','invitations','ai_conversations','ai_messages','settings','attachments','audit_log','sync_queue']) loop
    execute format('alter table %s enable row level security;', t);
  end loop; end $$;

-- ── Isolamento organizzazione: SELECT consentito solo nella propria org ──────
-- (pattern ripetuto; SUPER_ADMIN bypassa via role)
do $$ declare t text; begin
  for t in select unnest(array['wards','matrices','seasonal_matrices','staff','shifts','absences','vacations','desiderata','requests','availability','on_call','invitations','ai_conversations','settings','attachments','audit_log']) loop
    execute format($f$
      create policy %1$s_org_select on %1$s for select using (
        auth_role() = 'SUPER_ADMIN' or org_id = auth_org()
      );$f$, t);
  end loop; end $$;

-- ── STAFF: vede SOLO le proprie righe dove esiste staff_id ──────────────────
create policy shifts_staff_scope on shifts for select using (
  auth_role() in ('OWNER','MANAGER','SUPER_ADMIN') or is_staff_self(staff_id)
);
create policy absences_staff_scope on absences for select using (
  auth_role() in ('OWNER','MANAGER','SUPER_ADMIN') or is_staff_self(staff_id)
);
create policy vacations_staff_scope on vacations for select using (
  auth_role() in ('OWNER','MANAGER','SUPER_ADMIN') or is_staff_self(staff_id)
);

-- ── Scrittura dominio: solo OWNER/MANAGER (STAFF non crea reparti/matrici/turni) ──
do $$ declare t text; begin
  for t in select unnest(array['wards','matrices','seasonal_matrices','staff','shifts','on_call']) loop
    execute format($f$
      create policy %1$s_mgr_write on %1$s for all using (
        org_id = auth_org() and auth_role() in ('OWNER','MANAGER','SUPER_ADMIN')
      ) with check (
        org_id = auth_org() and auth_role() in ('OWNER','MANAGER','SUPER_ADMIN')
      );$f$, t);
  end loop; end $$;

-- ── STAFF può creare le PROPRIE richieste/disponibilità/desiderata ──────────
create policy requests_staff_insert on requests for insert with check (
  org_id = auth_org() and (auth_role() in ('OWNER','MANAGER') or is_staff_self(staff_id))
);
create policy requests_mgr_decide on requests for update using (
  org_id = auth_org() and auth_role() in ('OWNER','MANAGER','SUPER_ADMIN')
);  -- solo i manager cambiano stato (approva/rifiuta)
create policy availability_staff_insert on availability for insert with check (
  org_id = auth_org() and (auth_role() in ('OWNER','MANAGER') or is_staff_self(staff_id))
);
create policy desiderata_staff_insert on desiderata for insert with check (
  org_id = auth_org() and (auth_role() in ('OWNER','MANAGER') or is_staff_self(staff_id))
);

-- ── Notifiche: ognuno vede le proprie ───────────────────────────────────────
create policy notif_own on notifications for select using (user_id = auth.uid());

-- ── Audit log: append-only. SELECT solo OWNER/MANAGER della propria org; nessuno UPDATE/DELETE ──
create policy audit_read on audit_log for select using (
  org_id = auth_org() and auth_role() in ('OWNER','MANAGER','SUPER_ADMIN')
);
create policy audit_insert on audit_log for insert with check (org_id = auth_org());
-- (nessuna policy UPDATE/DELETE ⇒ immutabile per definizione)

-- ── ANON: nessuna policy ⇒ deny-all su tutte le tabelle. ────────────────────

-- ============================================================================
-- MATRICE DI VERIFICA (da eseguire come test di accettazione lato server)
-- role escalation:    STAFF che fa update su users.role           → BLOCCATO (nessuna policy write su users per STAFF)
-- cross-ward:         STAFF legge shifts di altro operatore        → BLOCCATO (is_staff_self)
-- cross-organization: utente org A legge wards di org B            → BLOCCATO (org_id = auth_org())
-- id enumeration:     GET /shifts?id=<altro>                       → BLOCCATO da RLS (riga non visibile)
-- mass assignment:    insert requests.stato='approved' come STAFF  → lo stato è cambiabile solo via requests_mgr_decide (UPDATE manager)
-- RLS bypass:         query senza org filter                       → RLS applica sempre il predicato, non bypassabile da client
-- audit tamper:       UPDATE/DELETE su audit_log                   → BLOCCATO (nessuna policy ⇒ negato)
-- ============================================================================
