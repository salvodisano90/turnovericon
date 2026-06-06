// services/backend.ts — punti di aggancio per il backend (login, sync, inviti, multi-dispositivo).
// Implementazioni PLACEHOLDER locali: non effettuano rete e non rompono la modalità offline.
// Quando collegherai Supabase/Firebase, sostituisci le implementazioni mantenendo queste interfacce.

import { Membership, ApprovalRequest, UserRole } from '../types';

export interface AuthUser { id: string; nome: string; email: string; ruolo: UserRole; }

export interface AuthService {
  getCurrentUser(): Promise<AuthUser | null>;
  loginCoordinatore(email: string, password: string): Promise<AuthUser>;
  requestStaffOtp(email: string): Promise<void>; // STAFF/CAPOTURNO: invia il codice via email
  verifyStaffOtp(email: string, token: string): Promise<AuthUser>; // verifica il codice e accede
  changePassword(newPassword: string): Promise<void>; // coordinatore
  resetPassword(email: string): Promise<void>; // recupero password via email
  logout(): Promise<void>;
  isBackendConnected(): boolean;
}

export interface SyncService {
  isOnline(): boolean;
  pull(): Promise<{ ok: boolean; updatedAt?: string }>;
  push(payload: unknown): Promise<{ ok: boolean }>;
  lastSync(): string | null;
}

export interface MembershipService {
  list(): Promise<Membership[]>;
  invite(m: Omit<Membership, 'id' | 'stato'>): Promise<Membership>;
  suspend(id: string): Promise<void>;
  revoke(id: string): Promise<void>;
  pendingRequests(): Promise<ApprovalRequest[]>;
}

// ── Placeholder locali (offline) ─────────────────────────────────────────────
const NOT_CONNECTED = 'Backend non collegato (modalità offline).';

export const localAuthService: AuthService = {
  async getCurrentUser() { return null; },
  async loginCoordinatore() { throw new Error(NOT_CONNECTED); },
  async requestStaffOtp() { throw new Error(NOT_CONNECTED); },
  async verifyStaffOtp() { throw new Error(NOT_CONNECTED); },
  async changePassword() { throw new Error(NOT_CONNECTED); },
  async resetPassword() { throw new Error(NOT_CONNECTED); },
  async logout() { /* no-op offline */ },
  isBackendConnected() { return false; },
};

export const localSyncService: SyncService = {
  isOnline() { return false; },
  async pull() { return { ok: false }; },
  async push() { return { ok: false }; },
  lastSync() { return null; },
};

export const localMembershipService: MembershipService = {
  async list() { return []; },
  async invite() { throw new Error(NOT_CONNECTED); },
  async suspend() { /* no-op offline */ },
  async revoke() { /* no-op offline */ },
  async pendingRequests() { return []; },
};

// Punto di accesso unico: oggi restituisce i placeholder locali.
export const backend = { auth: localAuthService, sync: localSyncService, membership: localMembershipService };
