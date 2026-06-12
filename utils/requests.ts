// utils/requests.ts — conversione di una richiesta approvata in vincolo di generazione.
// Funzione pura, nessuna dipendenza dal motore (evita import circolari).
import { ApprovalRequest, Ferie, Desiderata, DesiderataTipo } from '../types';

// Formato ISO 'YYYY-MM-DD' coerente con il motore (mese 0-based → +1).
function isoDay(y: number, m: number, d: number): string {
  return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

export function requestLabel(r: ApprovalRequest): string {
  const tipi: Record<string, string> = { ferie: 'Ferie', riposo: 'Riposo', mattina: 'Preferenza mattina', pomeriggio: 'Preferenza pomeriggio', evitaNotte: 'Evita notte' };
  const giorni = r.to && r.to > r.day ? `${r.day}–${r.to}` : `${r.day}`;
  return `${tipi[r.tipo] || r.tipo} · g.${giorni}`;
}

// Una richiesta APPROVATA diventa: una ferie (assenza) oppure un desiderata (preferenza/riposo).
export function requestToConstraint(r: ApprovalRequest, genId: () => string): { ferie?: Ferie; desiderata?: Desiderata } {
  if (r.tipo === 'ferie') {
    return { ferie: { infId: r.infId, from: r.day, to: r.to && r.to >= r.day ? r.to : r.day, month: r.month, year: r.year, motivo: (r.motivo && r.motivo.trim()) ? r.motivo.trim() : 'Ferie (richiesta approvata)' } };
  }
  const tipoMap: Record<string, DesiderataTipo> = { riposo: 'riposo', mattina: 'mattina', pomeriggio: 'pomeriggio', evitaNotte: 'evitaNotte' };
  const tipo: DesiderataTipo = tipoMap[r.tipo] || 'riposo';
  const dateStart = isoDay(r.year, r.month, r.day);
  const dateEnd = r.to && r.to > r.day ? isoDay(r.year, r.month, r.to) : undefined;
  return { desiderata: { id: genId(), infId: r.infId, dateStart, dateEnd, tipo, priorita: 'alta' } };
}
