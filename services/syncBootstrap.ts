// services/syncBootstrap.ts — collega la fondazione offline-first all'app.
// Usa AsyncStorage come storage della coda. Build-safe: nessun import dell'SDK Supabase.
// Quando colleghi Supabase, chiama configureSync(createSupabaseRemotePort(client, orgId, online)).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Outbox, SyncEngine, RemotePort, localPort, SyncEntity, SyncAction, KVStore } from './sync';

let _outbox: Outbox | null = null;
let _engine: SyncEngine | null = null;
let _port: RemotePort = localPort;

export function getOutbox(): Outbox {
  if (!_outbox) _outbox = new Outbox(AsyncStorage as unknown as KVStore);
  return _outbox;
}
export function getSyncEngine(): SyncEngine {
  if (!_engine) _engine = new SyncEngine(getOutbox(), _port);
  return _engine;
}
// Collega il backend reale (Supabase): da chiamare dopo il login del coordinatore.
export function configureSync(port: RemotePort) { _port = port; _engine = new SyncEngine(getOutbox(), port); }

// Registra una modifica nella coda di sincronizzazione. Best-effort: non blocca mai la UI offline.
export function recordChange(entity: SyncEntity, action: SyncAction, payload: unknown) {
  try { void getOutbox().enqueue(entity, action, payload); } catch { /* offline-safe: la modifica resta comunque salvata localmente nello store */ }
}
// Da invocare al ritorno della connettività (es. listener NetInfo) per inviare la coda.
export async function trySync(): Promise<{ pushed: number; remaining: number; offline?: boolean }> {
  try { return await getSyncEngine().flush(); } catch { return { pushed: 0, remaining: -1 }; }
}
