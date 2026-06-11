// services/compliance.ts — Verifica di conformità normativa (D.Lgs 66/2003, CCNL Sanità).
// FUNZIONE PURA, di SOLA ANALISI: legge un piano (anche dopo modifiche manuali) e segnala le violazioni.
// NON modifica la generazione. Riusa le stesse primitive del motore (orari, riposo, ore).

import { EngineContext, OrariSet, Piano, Turno } from '../types';
import { STD_ORARI } from '../utils/constants';
import { daysInMonth, getCtr, getRep, isWork, restMinutes, shiftHours } from '../utils/helpers';

export type ComplianceRule =
  | 'riposo11h' | 'riposoSettimanale35h' | 'media48h' | 'nottiConsecutive' | 'giorniConsecutivi';

export interface ComplianceViolation {
  infId: string;
  nome: string;
  regola: ComplianceRule;
  giorno?: number;       // giorno (1..dim) in cui si manifesta, se applicabile
  dettaglio: string;
  gravita: 'alta' | 'media';
}

export interface ComplianceReport {
  violazioni: ComplianceViolation[];
  perRegola: Record<ComplianceRule, number>;
  conforme: boolean;
}

// Festività nazionali fisse (mese 0-based). Pasquetta (variabile) non inclusa: approssimazione documentata.
const FESTIVI_FISSI = new Set(['0-1', '0-6', '3-25', '4-1', '5-2', '7-15', '10-1', '11-8', '11-25', '11-26']);
function isFestivo(year: number, month0: number, day: number): boolean {
  if (FESTIVI_FISSI.has(`${month0}-${day}`)) return true;
  return new Date(year, month0, day).getDay() === 0; // domenica
}

function orariOf(ctx: EngineContext, repartoId: string | null): OrariSet {
  return repartoId ? (getRep(ctx.reparti, repartoId)?.orari || STD_ORARI) : STD_ORARI;
}

export function complianceReport(ctx: EngineContext, piano: Piano): ComplianceReport {
  const dim = daysInMonth(ctx.year, ctx.month);
  const v: ComplianceViolation[] = [];

  for (const inf of ctx.staff) {
    const p = piano[inf.id];
    if (!p) continue;
    const ctr = getCtr(inf.contratto);
    const nottiMax = inf.contratto ? ctr.nottiMax : 5;
    const giorniMax = ctr.giorniCons || 6;
    const nome = inf.nome;

    // 1) Riposo 11h tra turni di giorni consecutivi
    for (let d = 1; d < dim; d++) {
      const a = p[d], b = p[d + 1];
      if (!a || !b) continue;
      if (isWork(a.turno) && isWork(b.turno)) {
        const rest = restMinutes(a.turno, b.turno, orariOf(ctx, a.repartoId), orariOf(ctx, b.repartoId));
        if (rest < 660) v.push({ infId: inf.id, nome, regola: 'riposo11h', giorno: d + 1, gravita: 'alta', dettaglio: `Riposo ${Math.floor(rest / 60)}h${rest % 60}m tra giorno ${d} e ${d + 1} (< 11h)` });
      }
    }

    // 2) Notti consecutive oltre il limite di contratto
    let nightRun = 0;
    for (let d = 1; d <= dim; d++) {
      const c = p[d];
      if (c && c.turno === 'N') { nightRun++; if (nightRun > nottiMax) v.push({ infId: inf.id, nome, regola: 'nottiConsecutive', giorno: d, gravita: 'alta', dettaglio: `${nightRun} notti consecutive (max ${nottiMax})` }); }
      else nightRun = 0;
    }

    // 3) Giorni di lavoro consecutivi oltre il limite
    let workRun = 0;
    for (let d = 1; d <= dim; d++) {
      const c = p[d];
      if (c && isWork(c.turno)) { workRun++; if (workRun > giorniMax) v.push({ infId: inf.id, nome, regola: 'giorniConsecutivi', giorno: d, gravita: 'alta', dettaglio: `${workRun} giorni di lavoro consecutivi (max ${giorniMax})` }); }
      else workRun = 0;
    }

    // 4) Riposo settimanale: ogni finestra di 7 giorni deve contenere almeno un giorno di riposo (R/F)
    for (let start = 1; start + 6 <= dim; start++) {
      let hasRest = false;
      for (let d = start; d <= start + 6; d++) { const c = p[d]; if (!c || !isWork(c.turno)) { hasRest = true; break; } }
      if (!hasRest) { v.push({ infId: inf.id, nome, regola: 'riposoSettimanale35h', giorno: start, gravita: 'alta', dettaglio: `Nessun riposo nei 7 giorni dal ${start} al ${start + 6} (riposo settimanale 35h non garantito)` }); break; }
    }

    // 5) Media 48h/settimana sul mese (indicativa: la norma è su 4 mesi)
    let worked = 0;
    for (let d = 1; d <= dim; d++) { const c = p[d]; if (c && isWork(c.turno)) worked += shiftHours(c.turno, orariOf(ctx, c.repartoId)); }
    const settimane = dim / 7;
    const mediaSett = settimane ? worked / settimane : 0;
    if (mediaSett > 48) v.push({ infId: inf.id, nome, regola: 'media48h', gravita: 'media', dettaglio: `Media ${Math.round(mediaSett)}h/sett. nel mese (> 48h; verificare sul periodo di 4 mesi)` });
  }

  const perRegola = { riposo11h: 0, riposoSettimanale35h: 0, media48h: 0, nottiConsecutive: 0, giorniConsecutivi: 0 } as Record<ComplianceRule, number>;
  for (const x of v) perRegola[x.regola]++;
  return { violazioni: v, perRegola, conforme: v.length === 0 };
}
