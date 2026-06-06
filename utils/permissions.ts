// utils/permissions.ts — RBAC (Role Based Access Control), funzione pura.
// OWNER (Coordinatore): permessi completi. STAFF (operatore): sola consultazione + invio richieste.
import { UserRole, RbacAction } from '../types';

const MATRIX: Record<UserRole, Record<RbacAction, boolean>> = {
  OWNER: { view: true, editTurni: true, editPersonale: true, editReparti: true, publish: true, approve: true, invite: true, export: true },
  CAPOTURNO: { view: true, editTurni: true, editPersonale: false, editReparti: false, publish: false, approve: true, invite: false, export: false },
  STAFF: { view: true, editTurni: false, editPersonale: false, editReparti: false, publish: false, approve: false, invite: false, export: false },
};

export function can(role: UserRole | undefined, action: RbacAction): boolean {
  const r: UserRole = role === 'STAFF' ? 'STAFF' : role === 'CAPOTURNO' ? 'CAPOTURNO' : 'OWNER';
  return !!(MATRIX[r] && MATRIX[r][action]);
}

export function isOwner(role: UserRole | undefined): boolean { return role === 'OWNER' || role === undefined; }
export function roleLabel(role: UserRole | undefined): string {
  return role === 'STAFF' ? 'Operatore' : role === 'CAPOTURNO' ? 'Capoturno' : 'Coordinatore';
}
