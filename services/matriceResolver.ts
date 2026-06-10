// services/matriceResolver.ts — LAYER che risolve la matrice attiva per data. PURO e ADDITIVO: NON tocca il motore.
// Il motore continua a lavorare con UNA matrice alla volta; questo layer decide QUALE passargli.
import { Matrice, Reparto, SeasonalConfig, Season } from '../types';
import { seasonalMatrice, inSeasonRange } from '../utils/helpers';

export type MatriceMode = 'standard' | 'custom' | 'seasonal';

// Modalità del reparto: esplicita se presente, altrimenti dedotta (matrice 'STAGIONALE' = seasonal).
export function repartoMatriceMode(rep: Reparto): MatriceMode {
  const m = (rep as any).matriceMode as MatriceMode | undefined;
  if (m === 'standard' || m === 'custom' || m === 'seasonal') return m;
  return rep.matrice === 'STAGIONALE' ? 'seasonal' : 'standard';
}

// Id della matrice attiva per (month0, day). standard/custom → rep.matrice; seasonal → matrice della stagione del giorno.
export function getActiveMatriceId(rep: Reparto, month0: number, day: number): string | null {
  if (repartoMatriceMode(rep) === 'seasonal') {
    return seasonalMatrice(rep.seasonal, month0, day) || (rep.matrice && rep.matrice !== 'STAGIONALE' ? rep.matrice : null);
  }
  return rep.matrice || null;
}

// Oggetto Matrice attivo (cerca tra catalogo + custom passati).
export function getActiveMatrice(rep: Reparto, allMatrici: Matrice[], month0: number, day: number): Matrice | null {
  const id = getActiveMatriceId(rep, month0, day);
  if (!id) return null;
  return (allMatrici || []).find((m) => m.id === id) || null;
}

export interface SeasonalValidation {
  ok: boolean;
  errors: string[];
  gaps: number;       // giorni dell'anno non coperti
  overlaps: number;   // giorni coperti da più stagioni
}

const SEASONS: Season[] = ['primavera', 'estate', 'autunno', 'inverno'];
const DIM = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // anno non bisestile (rappresentativo)

// Valida: ogni stagione ha matrice esistente, l'anno è coperto interamente, senza sovrapposizioni né buchi.
export function validateSeasonalConfig(cfg: SeasonalConfig | undefined, knownMatriceIds?: string[]): SeasonalValidation {
  const errors: string[] = [];
  if (!cfg) return { ok: false, errors: ['Configurazione stagionale mancante'], gaps: 365, overlaps: 0 };

  for (const s of SEASONS) {
    const r = (cfg as any)[s];
    if (!r || !r.matrice) errors.push(`Stagione ${s}: matrice non assegnata`);
    else if (knownMatriceIds && knownMatriceIds.length && !knownMatriceIds.includes(r.matrice)) {
      errors.push(`Stagione ${s}: matrice "${r.matrice}" inesistente`);
    }
  }

  let gaps = 0, overlaps = 0;
  for (let m = 0; m < 12; m++) {
    for (let d = 1; d <= DIM[m]; d++) {
      let count = 0;
      for (const s of SEASONS) if (inSeasonRange(m, d, (cfg as any)[s])) count++;
      if (count === 0) gaps++;
      else if (count > 1) overlaps++;
    }
  }
  if (gaps > 0) errors.push(`${gaps} giorni non coperti da alcuna stagione (buchi temporali)`);
  if (overlaps > 0) errors.push(`${overlaps} giorni coperti da più stagioni (sovrapposizioni)`);

  return { ok: errors.length === 0, errors, gaps, overlaps };
}

// Prossimo cambio di matrice (solo seasonal): scansiona avanti i giorni finché la matrice attiva cambia.
// Puro/engine-safe. Ritorna { month0, day, matriceId } oppure null (standard/custom: nessun cambio).
export function nextMatriceChange(rep: Reparto, month0: number, day: number, year: number = 2027): { month0: number; day: number; matriceId: string | null } | null {
  if (repartoMatriceMode(rep) !== 'seasonal') return null;
  const cur = getActiveMatriceId(rep, month0, day);
  const d = new Date(year, month0, day);
  for (let i = 1; i <= 370; i++) {
    d.setDate(d.getDate() + 1);
    const m = d.getMonth(), dd = d.getDate();
    const id = getActiveMatriceId(rep, m, dd);
    if (id !== cur) return { month0: m, day: dd, matriceId: id };
  }
  return null;
}
