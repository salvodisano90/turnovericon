// services/notifications.ts — Struttura notifiche (categorie). Mock locale derivato dai dati reali;
// architettura pronta per il backend (basterà rimpiazzare buildNotifications con una sorgente remota).
import { EngineContext, Piano } from '../types';
import { complianceReport } from './compliance';

export type NotifCategory = 'ferie' | 'criticita' | 'conflitti' | 'sistema';
export interface AppNotification { id: string; category: NotifCategory; title: string; detail: string; createdAt: string; read?: boolean; }

export function buildNotifications(ctx: EngineContext, piano: Piano, pendingRequests: number): AppNotification[] {
  const out: AppNotification[] = [];
  const now = new Date().toISOString();
  if (pendingRequests > 0) out.push({ id: 'n_ferie', category: 'ferie', title: 'Richieste in attesa', detail: `${pendingRequests} richieste da approvare`, createdAt: now });
  try {
    const comp = complianceReport(ctx, piano || {});
    if (comp.violazioni.length) out.push({ id: 'n_crit', category: 'criticita', title: 'Criticità normative', detail: `${comp.violazioni.length} violazioni rilevate nel mese`, createdAt: now });
  } catch { /* no-op */ }
  return out;
}
export const CATEGORY_LABEL: Record<NotifCategory, string> = {
  ferie: 'Richieste ferie', criticita: 'Criticità', conflitti: 'Conflitti', sistema: 'Messaggi sistema',
};
