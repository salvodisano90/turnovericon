// utils/permissions.ts — RBAC (Role Based Access Control), funzione pura.
// Due ruoli: OWNER (Coordinatore) = permessi completi; STAFF = sola consultazione + invio richieste.
import { UserRole, RbacAction } from '../types';

const MATRIX: Record<UserRole, Record<RbacAction, boolean>> = {
  OWNER: { view: true, editTurni: true, editPersonale: true, editReparti: true, publish: true, approve: true, invite: true, export: true },
  STAFF: { view: true, editTurni: false, editPersonale: false, editReparti: false, publish: false, approve: false, invite: false, export: false },
};

export function can(role: UserRole | undefined, action: RbacAction): boolean {
  const r: UserRole = role === 'STAFF' ? 'STAFF' : 'OWNER';
  return !!(MATRIX[r] && MATRIX[r][action]);
}

export function isOwner(role: UserRole | undefined): boolean { return role !== 'STAFF'; }
export function roleLabel(role: UserRole | undefined): string {
  return role === 'STAFF' ? 'Operatore' : 'Coordinatore';
}

// Autorizzazione Staff (login v1, senza OTP): l'email deve essere fra gli utenti autorizzati e non disattivata.
export function isAuthorizedStaff(members: { email: string; stato: string }[], email: string): boolean {
  const e = (email || '').trim().toLowerCase();
  if (!e) return false;
  return (members || []).some((m) => (m.email || '').trim().toLowerCase() === e && m.stato !== 'revocato');
}
