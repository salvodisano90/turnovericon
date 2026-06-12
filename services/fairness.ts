// services/fairness.ts — Fairness Engine (Fase 5). PURO e ADDITIVO: legge il piano, NON tocca il motore.
// Calcola, per operatore, il carico (notti/weekend/festivi/reperibilità) e lo confronta con la media di reparto.
import { Piano, Staff } from '../types';
import { daysInMonth, isWork, isWeekend, isHoliday } from '../utils/helpers';

export interface FairnessRow {
  infId: string;
  nome: string;
  notti: number;
  weekend: number;
  festivi: number;
  turniLavorati: number;
  turniPesanti: number;   // notti + turni in weekend/festivo
  turniLeggeri: number;   // restanti turni di lavoro
  reperibilita: number;
  carico: number;         // indice composito pesato
  scostamentoPct: number; // scostamento % dalla media di reparto
}

export type FairnessCategoria = 'eccellente' | 'buono' | 'attenzione' | 'critico';

export interface FairnessReport {
  operatori: FairnessRow[];
  mediaCarico: number;
  deviazioneStandard: number;
  coefficienteVariazione: number; // std/mean
  fairnessScore: number;          // 0..100
  categoria: FairnessCategoria;
}

// Pesi del carico (notte più pesante di un turno diurno; festivo > weekend; reperibilità conta meno di un turno).
const W = { notte: 3, weekend: 2, festivo: 2.5, reperibilita: 1.5 };

function categoriaDa(score: number): FairnessCategoria {
  if (score >= 90) return 'eccellente';
  if (score >= 75) return 'buono';
  if (score >= 60) return 'attenzione';
  return 'critico';
}

/**
 * Calcola l'equità del piano del mese.
 * @param rep mappa opzionale infId -> numero turni di reperibilità (da services/reperibilita.repStats)
 */
export function fairnessReport(
  staff: Staff[],
  piano: Piano,
  year: number,
  month: number,
  opts?: { rep?: Record<string, number> }
): FairnessReport {
  const dim = daysInMonth(year, month);
  const rep = (opts && opts.rep) || {};
  const considerati = (staff || []).filter((s) => s && s.id);

  const operatori: FairnessRow[] = considerati.map((s) => {
    let notti = 0, weekend = 0, festivi = 0, turniLavorati = 0, pesanti = 0;
    const giorni = piano && piano[s.id] ? piano[s.id] : {};
    for (let d = 1; d <= dim; d++) {
      const cell = giorni[d];
      if (!cell || !isWork(cell.turno)) continue;
      turniLavorati++;
      const we = isWeekend(year, month, d);
      const fe = isHoliday(year, month, d);
      const isNotte = cell.turno === 'N';
      if (isNotte) notti++;
      if (we) weekend++;
      if (fe) festivi++;
      if (isNotte || we || fe) pesanti++;
    }
    const reperibilita = rep[s.id] || 0;
    const carico =
      notti * W.notte + weekend * W.weekend + festivi * W.festivo + reperibilita * W.reperibilita;
    return {
      infId: s.id,
      nome: s.nome,
      notti, weekend, festivi,
      turniLavorati,
      turniPesanti: pesanti,
      turniLeggeri: Math.max(0, turniLavorati - pesanti),
      reperibilita,
      carico,
      scostamentoPct: 0, // riempito sotto
    };
  });

  const n = operatori.length;
  const mediaCarico = n ? operatori.reduce((a, o) => a + o.carico, 0) / n : 0;
  const varianza = n ? operatori.reduce((a, o) => a + Math.pow(o.carico - mediaCarico, 2), 0) / n : 0;
  const deviazioneStandard = Math.sqrt(varianza);
  const coefficienteVariazione = mediaCarico > 0 ? deviazioneStandard / mediaCarico : 0;

  for (const o of operatori) {
    o.scostamentoPct = mediaCarico > 0 ? Math.round(((o.carico - mediaCarico) / mediaCarico) * 100) : 0;
  }

  // Score: distribuzione perfettamente equa (CV=0) → 100. Più alta la variabilità, più basso il punteggio.
  const fairnessScore = Math.max(0, Math.min(100, Math.round(100 - coefficienteVariazione * 100)));

  // Ordina dal più sovraccarico al meno (utile per UI/criticità).
  operatori.sort((a, b) => b.carico - a.carico);

  return {
    operatori,
    mediaCarico: Math.round(mediaCarico * 10) / 10,
    deviazioneStandard: Math.round(deviazioneStandard * 10) / 10,
    coefficienteVariazione: Math.round(coefficienteVariazione * 1000) / 1000,
    fairnessScore,
    categoria: categoriaDa(fairnessScore),
  };
}

// Comodo con un EngineContext-like { staff, year, month }.
export function fairnessFor(
  ctx: { staff: Staff[]; year: number; month: number },
  piano: Piano,
  opts?: { rep?: Record<string, number> }
): FairnessReport {
  return fairnessReport(ctx.staff, piano, ctx.year, ctx.month, opts);
}
