// services/syncMapper.ts — FASE 8: traduce le mutazioni dello store (commit) in operazioni per la sync queue.
// Layer PURO e testabile. È il "produttore" che mancava: senza, la coda offline non riceveva nulla.
import { SyncAction, SyncEntity } from './sync';

// op del commit → azione di sync
export function mapAction(op: string): SyncAction | null {
  if (op === 'create') return 'create';
  if (op === 'update') return 'update';
  if (op === 'delete') return 'delete';
  return null; // 'accesso', 'mese', undo/redo… non sono mutazioni di dominio da sincronizzare
}

// entità applicativa (commit) → entità di sync. null = non sincronizzabile (es. cambio mese visualizzato).
export function mapEntity(entity: string): SyncEntity | null {
  switch (entity) {
    case 'reparto': return 'reparto';
    case 'personale': return 'staff';
    case 'assenza': return 'ferie';
    case 'ferie': return 'ferie';
    case 'richiesta': return 'richiesta';
    case 'piano': return 'piano';
    case 'membership': return 'membership';
    default: return null; // 'desiderata','mese',... non hanno (ancora) tabella dedicata nel port attuale
  }
}

// Decide se e cosa accodare per una data mutazione.
export function toSyncOp(op: string, entity: string): { entity: SyncEntity; action: SyncAction } | null {
  const action = mapAction(op);
  const ent = mapEntity(entity);
  if (!action || !ent) return null;
  return { entity: ent, action };
}
