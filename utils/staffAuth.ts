// utils/staffAuth.ts — credenziali Staff (FASE 8): logica PURA testabile. Architettura pronta per Supabase.
// Campi: passwordHash, lastLogin, failedAttempts, lockedUntil, resetToken. Hash = placeholder locale (btoa-like), da sostituire con Supabase Auth.
export interface StaffCredential {
  email: string;
  passwordHash: string;
  lastLogin?: number;
  failedAttempts: number;
  lockedUntil?: number;   // AccountLocked finché now < lockedUntil
  resetToken?: string;    // PasswordReset (flusso futuro)
}
export type StaffCreds = Record<string, StaffCredential>;
export const MAX_STAFF_ATTEMPTS = 5;
export const LOCK_MS = 15 * 60 * 1000;

export function hashPassword(pwd: string): string {
  // Placeholder deterministico locale (NON crittografico): Supabase gestirà l'hashing reale lato server.
  let h = 0; const s = `turnover::${pwd}`;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
  return `loc_${h.toString(16)}`;
}

export interface VerifyResult { ok: boolean; error?: string; creds: StaffCreds; provisioned?: boolean; }

// Primo accesso: se non esiste un record, la password fornita viene registrata (provisioning locale).
// Poi: verifica, lockout dopo MAX_STAFF_ATTEMPTS per LOCK_MS, lastLogin aggiornato al successo.
export function verifyStaffPassword(creds: StaffCreds, email: string, pwd: string, now: number): VerifyResult {
  const e = (email || '').trim().toLowerCase();
  if (!pwd || pwd.length < 4) return { ok: false, error: 'Password troppo corta (min 4 caratteri).', creds };
  const next: StaffCreds = { ...(creds || {}) };
  const rec = next[e];
  if (!rec) {
    next[e] = { email: e, passwordHash: hashPassword(pwd), failedAttempts: 0, lastLogin: now };
    return { ok: true, creds: next, provisioned: true };
  }
  if (rec.lockedUntil && now < rec.lockedUntil) {
    return { ok: false, error: 'Account bloccato per troppi tentativi. Riprova più tardi.', creds: next };
  }
  if (rec.passwordHash !== hashPassword(pwd)) {
    const fails = (rec.failedAttempts || 0) + 1;
    next[e] = { ...rec, failedAttempts: fails, lockedUntil: fails >= MAX_STAFF_ATTEMPTS ? now + LOCK_MS : rec.lockedUntil };
    return { ok: false, error: fails >= MAX_STAFF_ATTEMPTS ? 'Account bloccato per troppi tentativi.' : 'Password errata.', creds: next };
  }
  next[e] = { ...rec, failedAttempts: 0, lockedUntil: undefined, lastLogin: now };
  return { ok: true, creds: next };
}

export function requestPasswordReset(creds: StaffCreds, email: string, token: string): StaffCreds {
  const e = (email || '').trim().toLowerCase();
  if (!creds[e]) return creds;
  return { ...creds, [e]: { ...creds[e], resetToken: token } };
}
export function applyPasswordReset(creds: StaffCreds, email: string, token: string, newPwd: string): { ok: boolean; creds: StaffCreds } {
  const e = (email || '').trim().toLowerCase(); const rec = creds[e];
  if (!rec || !rec.resetToken || rec.resetToken !== token) return { ok: false, creds };
  return { ok: true, creds: { ...creds, [e]: { ...rec, passwordHash: hashPassword(newPwd), resetToken: undefined, failedAttempts: 0, lockedUntil: undefined } } };
}
