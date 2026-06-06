// services/supabaseBackend.ts — adapter REALE per Supabase.
// Build-safe: NON importa l'SDK (riceve un client già configurato come parametro), così il
// progetto compila anche senza il pacchetto installato. NON eseguito nell'ambiente offline.
//
// Per attivarlo nell'app:
//   1) npm i @supabase/supabase-js
//   2) crea il client: const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
//   3) inietta: backendReal = { auth: createSupabaseAuth(client), membership: createSupabaseMembership(client, orgId), ... }
// Lo schema SQL + le policy RLS sono in integrations/supabase-schema.sql.

import { AuthUser, AuthService, MembershipService } from './backend';
import { Membership } from '../types';
import { RemotePort, SyncOp } from './sync';

type Client = any; // tipizzato dall'SDK quando installato (SupabaseClient)

function roleFrom(r: string | undefined): AuthUser['ruolo'] { return r === 'OWNER' || r === 'CAPOTURNO' || r === 'STAFF' ? r : 'STAFF'; }

export function createSupabaseAuth(client: Client): AuthService {
  return {
    async getCurrentUser() {
      const { data } = await client.auth.getUser();
      const u = data && data.user; if (!u) return null;
      const prof = await client.from('memberships').select('nome,ruolo').eq('email', u.email).maybeSingle();
      return { id: u.id, nome: (prof.data && prof.data.nome) || u.email, email: u.email, ruolo: roleFrom(prof.data && prof.data.ruolo) } as AuthUser;
    },
    async loginCoordinatore(email: string, password: string) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      return { id: data.user.id, nome: email, email, ruolo: 'OWNER' } as AuthUser;
    },
    // STAFF/CAPOTURNO: invia OTP SOLO se l'email è autorizzata e attiva (nessuna password).
    async requestStaffOtp(email: string) {
      const m = await client.from('memberships').select('stato').eq('email', email).maybeSingle();
      if (!m.data || m.data.stato !== 'attivo') throw new Error('Accesso negato. Contatta il tuo coordinatore.');
      const { error } = await client.auth.signInWithOtp({ email });
      if (error) throw new Error(error.message);
    },
    async verifyStaffOtp(email: string, token: string) {
      const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' });
      if (error) throw new Error(error.message);
      const prof = await client.from('memberships').select('nome,ruolo').eq('email', email).maybeSingle();
      await client.from('memberships').update({ ultimo_accesso: new Date().toISOString() }).eq('email', email);
      return { id: (data.user && data.user.id) || email, nome: (prof.data && prof.data.nome) || email, email, ruolo: roleFrom(prof.data && prof.data.ruolo) } as AuthUser;
    },
    async changePassword(newPassword: string) { const { error } = await client.auth.updateUser({ password: newPassword }); if (error) throw new Error(error.message); },
    async resetPassword(email: string) { const { error } = await client.auth.resetPasswordForEmail(email); if (error) throw new Error(error.message); },
    async logout() { await client.auth.signOut(); },
    isBackendConnected() { return true; },
  };
}

export function createSupabaseMembership(client: Client, orgId: string): MembershipService {
  return {
    async list() {
      const { data } = await client.from('memberships').select('*').eq('org_id', orgId).order('nome');
      return (data || []).map((r: any) => ({ id: r.id, infId: r.inf_id, nome: r.nome, cognome: r.cognome, email: r.email, ruolo: r.ruolo, stato: r.stato })) as Membership[];
    },
    async invite(m) {
      const { data, error } = await client.from('memberships').insert({ org_id: orgId, nome: m.nome, cognome: (m as any).cognome, email: m.email, ruolo: m.ruolo, stato: 'invitato' }).select().single();
      if (error) throw new Error(error.message);
      return { id: data.id, nome: data.nome, email: data.email, ruolo: data.ruolo, stato: data.stato } as Membership;
    },
    async suspend(id) { await client.from('memberships').update({ stato: 'revocato' }).eq('id', id); },
    async revoke(id) { await client.from('memberships').delete().eq('id', id); },
    async pendingRequests() {
      const { data } = await client.from('requests').select('*').eq('org_id', orgId).eq('stato', 'pending');
      return (data || []) as any;
    },
  };
}

// Porta di sincronizzazione: invia le operazioni outbox alla tabella sync_ops e rileva la connettività.
export function createSupabaseRemotePort(client: Client, orgId: string, online: () => boolean): RemotePort {
  return {
    isOnline() { return online(); },
    async pushOps(ops: SyncOp[]) {
      const rows = ops.map((o) => ({ id: o.id, org_id: orgId, ts: o.ts, entity: o.entity, action: o.action, payload: o.payload }));
      const { error } = await client.from('sync_ops').upsert(rows, { onConflict: 'id' });
      if (error) return { okIds: [] };
      return { okIds: ops.map((o) => o.id) };
    },
    async pullSnapshot(since?: string | null) {
      let q = client.from('sync_ops').select('*').eq('org_id', orgId).order('ts');
      if (since) q = q.gt('ts', new Date(since).getTime());
      const { data } = await q;
      return { updatedAt: new Date().toISOString(), data: data || [] };
    },
  };
}
