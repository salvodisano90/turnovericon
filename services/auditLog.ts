// services/auditLog.ts — FASE 8: audit log con versionamento (seq monotono) e storico modifiche.
// Logica PURA testabile (appendAudit) + persistenza locale; pronto per il mirroring su Supabase.
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AuditEntry {
  id: string;
  seq: number;            // versionamento monotono dello storico
  ts: number;
  actor: string;          // email (o 'owner' locale)
  role: string;           // OWNER | STAFF
  azione: string;         // es. 'approva_richiesta', 'rimuovi_reparto'
  target: string;         // id/etichetta dell'oggetto
  dettagli?: string;
  before?: unknown;       // stato precedente (conformità sanitaria: tracciabilità della modifica)
  after?: unknown;        // stato successivo
  // NB: IP e device richiedono il backend (richiesta del client non attendibile) → popolati lato Supabase.
}

export const AUDIT_MAX = 500; // storico locale: cap circolare (su Supabase: illimitato)

export function appendAudit(list: AuditEntry[], e: Omit<AuditEntry, 'id' | 'seq' | 'ts'>, now: number = Date.now()): AuditEntry[] {
  const prev = Array.isArray(list) ? list : [];
  const seq = prev.length ? prev[prev.length - 1].seq + 1 : 1;
  const entry: AuditEntry = { id: `aud_${now}_${seq}`, seq, ts: now, ...e };
  const next = [...prev, entry];
  return next.length > AUDIT_MAX ? next.slice(next.length - AUDIT_MAX) : next;
}

const KEY = 'turnover.audit_log';
export async function loadAuditLog(): Promise<AuditEntry[]> {
  try { const raw = await AsyncStorage.getItem(KEY); if (!raw) return []; const d = JSON.parse(raw); return Array.isArray(d) ? d : []; } catch { return []; }
}
export async function saveAuditLog(list: AuditEntry[]): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(Array.isArray(list) ? list : [])); } catch { /* no-op */ }
}
// Fire-and-forget per le mutazioni dello store (mai bloccante, mai throw).
export function recordAudit(e: Omit<AuditEntry, 'id' | 'seq' | 'ts'>): void {
  loadAuditLog().then((l) => saveAuditLog(appendAudit(l, e))).catch(() => { /* no-op */ });
}
