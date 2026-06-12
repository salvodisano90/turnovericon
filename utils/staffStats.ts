// utils/staffStats.ts — widget della dashboard STAFF: logica PURA (testabile in Node), solo dati reali.
import { ApprovalRequest, Ferie, Piano, ReperibilitaOperatore, Staff } from '../types';

export const DEFAULT_FERIE_ANNUE = 26; // giorni; usato solo se Staff.ferieAnnue assente (dichiarato in UI)

const WORK = (t?: string) => t === 'M' || t === 'P' || t === 'N';

export function turnoDelGiorno(piano: Piano, infId: string, day: number): string | null {
  const c = piano && piano[infId] && (piano[infId] as any)[day];
  return c ? c.turno : null;
}

export function prossimoTurno(piano: Piano, infId: string, fromDay: number, dim: number): { day: number; turno: string } | null {
  const pp = (piano && piano[infId]) || {};
  for (let d = fromDay + 1; d <= dim; d++) {
    const c = (pp as any)[d];
    if (c && WORK(c.turno)) return { day: d, turno: c.turno };
  }
  return null;
}

export function ferieGodute(ferie: Ferie[], infId: string, year: number): number {
  let g = 0;
  for (const f of ferie || []) {
    if (f.infId !== infId || f.year !== year) continue;
    const from = Math.max(1, f.from || 1); const to = Math.max(from, f.to || from);
    g += to - from + 1;
  }
  return g;
}

export function ferieResidue(staff: Staff | undefined, godute: number): number {
  const tot = staff && typeof (staff as any).ferieAnnue === 'number' ? (staff as any).ferieAnnue : DEFAULT_FERIE_ANNUE;
  return Math.max(0, tot - godute);
}

export function richiesteInAttesa(requests: ApprovalRequest[], infId: string | undefined): number {
  if (!infId) return 0;
  return (requests || []).filter((r) => r.infId === infId && r.stato === 'pending').length;
}

export function prossimaReperibilita(list: ReperibilitaOperatore[], staffId: string | undefined, todayIso: string): ReperibilitaOperatore | null {
  if (!staffId) return null;
  const mine = (list || []).filter((r) => r.staffId === staffId && r.stato !== 'rifiutata' && r.data >= todayIso);
  if (!mine.length) return null;
  return [...mine].sort((a, b) => a.data.localeCompare(b.data))[0];
}

export function notificheRecenti(requests: ApprovalRequest[], infId: string | undefined, n = 3): ApprovalRequest[] {
  if (!infId) return [];
  return [...(requests || [])].filter((r) => r.infId === infId)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, n);
}
