// utils/invitations.ts — FASE 5: architettura inviti staff con TOKEN (non solo "email autorizzata").
// Logica PURA e testabile. Nessuna dipendenza Supabase: con il backend, questi stessi tipi diventano
// una tabella `invitations` + RLS; createInvitation/acceptInvitation mappano 1:1 su insert/update.
export type InvitationStato = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface Invitation {
  token: string;          // opaco, condiviso col destinatario
  email: string;          // destinatario (lowercase)
  ruolo: string;          // qualifica/ruolo previsto
  stato: InvitationStato;
  createdAt: number;
  expiresAt: number;      // scadenza assoluta
  acceptedAt?: number;
}

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 giorni

// Token opaco senza dipendenze (sufficiente in locale; con Supabase lo genera il backend).
export function makeInviteToken(email: string, now: number, rnd: number = Math.random()): string {
  const base = `${email}|${now}|${rnd}`;
  let h = 0; for (let i = 0; i < base.length; i++) { h = (h * 31 + base.charCodeAt(i)) | 0; }
  return `inv_${(now).toString(36)}_${(h >>> 0).toString(36)}`;
}

export function createInvitation(email: string, ruolo: string, now: number, ttl: number = INVITE_TTL_MS): Invitation {
  const e = (email || '').trim().toLowerCase();
  return { token: makeInviteToken(e, now), email: e, ruolo, stato: 'pending', createdAt: now, expiresAt: now + ttl };
}

export function inviteStatus(inv: Invitation | null, now: number): InvitationStato | 'not_found' {
  if (!inv) return 'not_found';
  if (inv.stato === 'accepted' || inv.stato === 'revoked') return inv.stato;
  if (now > inv.expiresAt) return 'expired';
  return 'pending';
}

// Accetta un invito per (email, token). Idempotenza/sicurezza: già accettato/revocato/scaduto → errore;
// email o token non combacianti → errore. Ritorna l'invito aggiornato (accepted) e la lista mutata.
export function acceptInvitation(
  list: Invitation[], email: string, token: string, now: number
): { ok: boolean; error?: string; list: Invitation[]; invitation?: Invitation } {
  const e = (email || '').trim().toLowerCase();
  const arr = Array.isArray(list) ? list : [];
  const idx = arr.findIndex((i) => i.email === e && i.token === token);
  if (idx < 0) return { ok: false, error: 'not_found', list: arr };
  const st = inviteStatus(arr[idx], now);
  if (st === 'accepted') return { ok: false, error: 'already_used', list: arr };
  if (st === 'revoked') return { ok: false, error: 'revoked', list: arr };
  if (st === 'expired') return { ok: false, error: 'expired', list: arr };
  const updated: Invitation = { ...arr[idx], stato: 'accepted', acceptedAt: now };
  const next = arr.slice(); next[idx] = updated;
  return { ok: true, list: next, invitation: updated };
}

export function revokeInvitation(list: Invitation[], token: string): Invitation[] {
  return (Array.isArray(list) ? list : []).map((i) => (i.token === token && i.stato === 'pending' ? { ...i, stato: 'revoked' } : i));
}

// Un'email è abilitata all'accesso staff se ha almeno un invito ACCETTATO (oltre al canale membership legacy).
export function hasAcceptedInvite(list: Invitation[], email: string): boolean {
  const e = (email || '').trim().toLowerCase();
  return (Array.isArray(list) ? list : []).some((i) => i.email === e && i.stato === 'accepted');
}
