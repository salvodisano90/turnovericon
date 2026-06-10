// services/authProvider.ts — Astrazione AUTH + implementazione LOCALE simulata.
// Obiettivo: quando arriverà Supabase, basterà fornire un altro oggetto che implementa AuthProvider.
// Tutta la logica di codice/OTP/recovery è in funzioni PURE testabili (sotto).

import AsyncStorage from '@react-native-async-storage/async-storage';

export type AuthRole = 'OWNER' | 'STAFF';
export interface AuthUser { id: string; email: string; nome: string; cognome?: string; role: AuthRole; }
export interface AuthSession { user: AuthUser; token: string; remember: boolean; }
export type AuthResult = { ok: true } | { ok: false; error: string };
export type CodeError = 'expired' | 'too_many' | 'wrong';

export interface AuthProvider {
  getSession(): Promise<AuthSession | null>;
  signUp(d: { nome: string; cognome?: string; email: string; password: string }): Promise<AuthResult>;
  signIn(email: string, password: string, remember: boolean): Promise<AuthResult>;
  signOut(): Promise<void>;
  // recupero password (coordinatore) e OTP (staff) condividono il meccanismo del codice
  requestPasswordReset(email: string): Promise<{ ok: boolean; devCode?: string }>;
  verifyCode(email: string, code: string): Promise<{ ok: boolean; error?: CodeError }>;
  setNewPassword(email: string, code: string, password: string): Promise<AuthResult>;
  resendCode(email: string): Promise<{ ok: boolean; devCode?: string; error?: 'too_many' }>;
  signInWithOtp(email: string): Promise<{ ok: boolean; devCode?: string; error?: string }>;
  updateProfile(patch: Partial<Pick<AuthUser, 'nome' | 'cognome' | 'email'>>): Promise<AuthResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGICA PURA (testabile senza storage)
// ─────────────────────────────────────────────────────────────────────────────
export const MAX_ATTEMPTS = 5;
export const MAX_RESENDS = 3;
export const CODE_TTL_MS = 10 * 60 * 1000; // 10 minuti

export interface CodeRecord { email: string; code: string; expiresAt: number; attempts: number; resends: number; }

export function genCode(rnd: () => number = Math.random): string {
  return String(Math.floor(rnd() * 900000) + 100000); // 6 cifre
}
export function makeCodeRecord(email: string, now: number, rnd?: () => number): CodeRecord {
  return { email, code: genCode(rnd), expiresAt: now + CODE_TTL_MS, attempts: 0, resends: 0 };
}
// Valida un codice; ritorna esito + record aggiornato (attempts incrementati su errore)
export function checkCode(rec: CodeRecord | null, code: string, now: number): { ok: boolean; error?: CodeError; rec: CodeRecord | null } {
  if (!rec) return { ok: false, error: 'wrong', rec };
  if (now > rec.expiresAt) return { ok: false, error: 'expired', rec };
  if (rec.attempts >= MAX_ATTEMPTS) return { ok: false, error: 'too_many', rec };
  if (code.trim() !== rec.code) return { ok: false, error: 'wrong', rec: { ...rec, attempts: rec.attempts + 1 } };
  return { ok: true, rec };
}
export function canResend(rec: CodeRecord | null): boolean { return !rec || rec.resends < MAX_RESENDS; }

export const emailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
export const passwordIssue = (p: string): string | null =>
  p.length < 8 ? 'La password deve avere almeno 8 caratteri' : !/\d/.test(p) ? 'Inserisci almeno un numero' : null;

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER LOCALE SIMULATO (AsyncStorage). Nessuna rete. Sostituibile con Supabase.
// ─────────────────────────────────────────────────────────────────────────────
const K_USERS = 'turnover.auth.users';
const K_SESSION = 'turnover.auth.session';
const K_CODE = 'turnover.auth.code';
type StoredUser = AuthUser & { pwd: string };

async function readJson<T>(k: string, fb: T): Promise<T> { try { const r = await AsyncStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; } }
async function writeJson(k: string, v: any): Promise<void> { try { await AsyncStorage.setItem(k, JSON.stringify(v)); } catch { /* no-op */ } }
const obf = (s: string) => (typeof btoa === 'function' ? btoa(s) : s); // mock: NON è hashing reale (lato Supabase è server-side)

export const LocalAuthProvider: AuthProvider = {
  async getSession() { return readJson<AuthSession | null>(K_SESSION, null); },

  async signUp(d) {
    if (!emailValid(d.email)) return { ok: false, error: 'Email non valida' };
    const pw = passwordIssue(d.password); if (pw) return { ok: false, error: pw };
    const users = await readJson<Record<string, StoredUser>>(K_USERS, {});
    const key = d.email.trim().toLowerCase();
    if (users[key]) return { ok: false, error: 'Esiste già un account con questa email' };
    const user: StoredUser = { id: `u_${Date.now()}`, email: key, nome: d.nome.trim(), cognome: d.cognome?.trim(), role: 'OWNER', pwd: obf(d.password) };
    users[key] = user; await writeJson(K_USERS, users);
    await writeJson(K_SESSION, { user: stripPwd(user), token: `local_${user.id}`, remember: true });
    return { ok: true };
  },

  async signIn(email, password, remember) {
    const users = await readJson<Record<string, StoredUser>>(K_USERS, {});
    const u = users[email.trim().toLowerCase()];
    if (!u || u.pwd !== obf(password)) return { ok: false, error: 'Email o password non corretti' };
    await writeJson(K_SESSION, { user: stripPwd(u), token: `local_${u.id}`, remember });
    return { ok: true };
  },

  async signOut() { try { await AsyncStorage.removeItem(K_SESSION); } catch { /* no-op */ } },

  async requestPasswordReset(email) {
    const rec = makeCodeRecord(email.trim().toLowerCase(), Date.now());
    await writeJson(K_CODE, rec);
    return { ok: true, devCode: rec.code }; // devCode solo in locale: con Supabase il codice arriva via email
  },

  async verifyCode(email, code) {
    const rec = await readJson<CodeRecord | null>(K_CODE, null);
    const r = checkCode(rec && rec.email === email.trim().toLowerCase() ? rec : null, code, Date.now());
    if (r.rec) await writeJson(K_CODE, r.rec); // persiste attempts
    return { ok: r.ok, error: r.error };
  },

  async setNewPassword(email, code, password) {
    const pw = passwordIssue(password); if (pw) return { ok: false, error: pw };
    const rec = await readJson<CodeRecord | null>(K_CODE, null);
    const r = checkCode(rec && rec.email === email.trim().toLowerCase() ? rec : null, code, Date.now());
    if (!r.ok) return { ok: false, error: r.error === 'expired' ? 'Codice scaduto' : r.error === 'too_many' ? 'Troppi tentativi' : 'Codice non valido' };
    const users = await readJson<Record<string, StoredUser>>(K_USERS, {});
    const key = email.trim().toLowerCase();
    if (users[key]) { users[key].pwd = obf(password); await writeJson(K_USERS, users); }
    try { await AsyncStorage.removeItem(K_CODE); } catch { /* no-op */ }
    if (users[key]) await writeJson(K_SESSION, { user: stripPwd(users[key]), token: `local_${users[key].id}`, remember: true });
    return { ok: true };
  },

  async resendCode(email) {
    const rec = await readJson<CodeRecord | null>(K_CODE, null);
    if (!canResend(rec)) return { ok: false, error: 'too_many' };
    const next = makeCodeRecord(email.trim().toLowerCase(), Date.now());
    next.resends = (rec?.resends || 0) + 1;
    await writeJson(K_CODE, next);
    return { ok: true, devCode: next.code };
  },

  async signInWithOtp(email) {
    if (!emailValid(email)) return { ok: false, error: 'Email non valida' };
    const rec = makeCodeRecord(email.trim().toLowerCase(), Date.now());
    await writeJson(K_CODE, rec);
    return { ok: true, devCode: rec.code };
  },

  async updateProfile(patch) {
    const session = await readJson<AuthSession | null>(K_SESSION, null);
    if (!session) return { ok: false, error: 'Nessuna sessione' };
    const users = await readJson<Record<string, StoredUser>>(K_USERS, {});
    const key = session.user.email;
    const merged = { ...session.user, ...patch } as AuthUser;
    if (users[key]) { users[key] = { ...users[key], ...patch } as StoredUser; await writeJson(K_USERS, users); }
    await writeJson(K_SESSION, { ...session, user: merged });
    return { ok: true };
  },
};

function stripPwd(u: StoredUser): AuthUser { const { pwd, ...rest } = u; return rest; }

// Provider attivo: oggi LOCALE. Per Supabase: esportare un SupabaseAuthProvider con la stessa interfaccia.
export const auth: AuthProvider = LocalAuthProvider;
