// services/sync.ts — Fondazione offline-first (provider-agnostica).
// Coda "outbox": ogni modifica locale viene accodata e sincronizzata appena c'è rete.
// Nessuna dipendenza da rete o SDK: il backend reale implementa RemotePort.
// Testabile offline iniettando una KVStore in memoria.

export type SyncEntity = 'reparto' | 'staff' | 'ferie' | 'piano' | 'richiesta' | 'membership';
export type SyncAction = 'create' | 'update' | 'delete';
export interface SyncOp { id: string; ts: number; entity: SyncEntity; action: SyncAction; payload: unknown; synced?: boolean; }

// Porta verso il backend remoto (implementata da Supabase/Firebase).
export interface RemotePort {
  pushOps(ops: SyncOp[]): Promise<{ okIds: string[] }>;
  pullSnapshot(since?: string | null): Promise<{ updatedAt: string; data: unknown } | null>;
  isOnline(): boolean;
}

// Storage chiave-valore (AsyncStorage in app; oggetto in memoria nei test).
export interface KVStore { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void>; }

export class Outbox {
  constructor(private kv: KVStore, private key = 'turnover.outbox') {}
  private async readAll(): Promise<SyncOp[]> { try { const r = await this.kv.getItem(this.key); return r ? (JSON.parse(r) as SyncOp[]) : []; } catch { return []; } }
  private async write(ops: SyncOp[]): Promise<void> { await this.kv.setItem(this.key, JSON.stringify(ops)); }
  async enqueue(entity: SyncEntity, action: SyncAction, payload: unknown): Promise<SyncOp> {
    const ops = await this.readAll();
    const op: SyncOp = { id: 'op_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), ts: Date.now(), entity, action, payload, synced: false };
    ops.push(op); await this.write(ops); return op;
  }
  async pending(): Promise<SyncOp[]> { return (await this.readAll()).filter((o) => !o.synced); }
  async pendingCount(): Promise<number> { return (await this.pending()).length; }
  // Segna come sincronizzate e rimuove dalla coda quelle confermate dal backend.
  async markSynced(ids: string[]): Promise<void> { const set = new Set(ids); const remaining = (await this.readAll()).filter((o) => !set.has(o.id)); await this.write(remaining); }
  async clear(): Promise<void> { await this.write([]); }
}

export interface SyncStatus { online: boolean; pending: number; lastSync: string | null; }

export class SyncEngine {
  lastSync: string | null = null;
  constructor(private outbox: Outbox, private port: RemotePort) {}
  async status(): Promise<SyncStatus> { return { online: this.port.isOnline(), pending: await this.outbox.pendingCount(), lastSync: this.lastSync }; }
  // Invia le operazioni pendenti se c'è rete; offline non fa nulla (i dati restano in coda).
  async flush(): Promise<{ pushed: number; remaining: number; offline?: boolean }> {
    if (!this.port.isOnline()) return { pushed: 0, remaining: await this.outbox.pendingCount(), offline: true };
    const pending = await this.outbox.pending();
    if (!pending.length) return { pushed: 0, remaining: 0 };
    const { okIds } = await this.port.pushOps(pending);
    await this.outbox.markSynced(okIds);
    this.lastSync = new Date().toISOString();
    return { pushed: okIds.length, remaining: await this.outbox.pendingCount() };
  }
}

// Porta locale (offline puro): mai online, nessun push. Usata finché il backend non è collegato.
export const localPort: RemotePort = {
  async pushOps() { return { okIds: [] }; },
  async pullSnapshot() { return null; },
  isOnline() { return false; },
};

// KVStore basata su AsyncStorage (in app). Import lazy per non rompere ambienti senza il pacchetto.
export function asyncStorageKV(AsyncStorage: KVStore): KVStore { return AsyncStorage; }

// ── Risoluzione conflitti esplicita ──────────────────────────────────────────
// Due dispositivi possono modificare lo stesso bersaglio (stessa cella turno, stessa richiesta…).
// targetKey identifica il bersaglio; un conflitto esiste se locale e remoto toccano lo stesso
// bersaglio con valori diversi. La UI mostra Versione A (locale) / B (remota) e l'utente sceglie.
export function targetKey(op: SyncOp): string {
  const p = (op.payload || {}) as Record<string, unknown>;
  switch (op.entity) {
    case 'piano': return `piano:${p.infId}:${p.day}`;
    case 'richiesta': return `richiesta:${p.id}`;
    case 'ferie': return `ferie:${(p.id as string) ?? `${p.infId}:${p.from}`}`;
    case 'reparto': return `reparto:${p.id}`;
    case 'staff': return `staff:${p.id}`;
    case 'membership': return `membership:${(p.id as string) ?? (p.email as string)}`;
    default: return `${op.entity}:${(p.id as string) ?? ''}`;
  }
}
function valueSig(op: SyncOp): string {
  const p = (op.payload || {}) as Record<string, unknown>;
  if (op.entity === 'piano') return String(p.turno);
  if (op.entity === 'richiesta') return String(p.stato);
  return JSON.stringify(p);
}
export interface Conflict { key: string; entity: SyncEntity; local: SyncOp; remote: SyncOp; }
// Confronta le operazioni locali pendenti con quelle remote scaricate; ritorna i conflitti reali.
export function detectConflicts(localPending: SyncOp[], remoteOps: SyncOp[]): Conflict[] {
  const out: Conflict[] = [];
  const remoteByKey = new Map<string, SyncOp>();
  for (const r of remoteOps) { const k = targetKey(r); const cur = remoteByKey.get(k); if (!cur || r.ts >= cur.ts) remoteByKey.set(k, r); }
  for (const l of localPending) { const k = targetKey(l); const r = remoteByKey.get(k); if (r && valueSig(l) !== valueSig(r)) out.push({ key: k, entity: l.entity, local: l, remote: r }); }
  return out;
}
export function resolveConflict(c: Conflict, choice: 'local' | 'remote'): SyncOp { return choice === 'local' ? c.local : c.remote; }
// Operazioni remote che NON sono in conflitto (da applicare automaticamente in locale).
export function nonConflicting(localPending: SyncOp[], remoteOps: SyncOp[]): SyncOp[] {
  const conflictKeys = new Set(detectConflicts(localPending, remoteOps).map((c) => c.key));
  return remoteOps.filter((r) => !conflictKeys.has(targetKey(r)));
}
