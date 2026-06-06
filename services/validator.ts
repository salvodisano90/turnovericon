// services/validator.ts — "Controlla Piano": analisi automatica del piano turni (funzione pura)

import { EngineContext, Piano } from '../types';
import { STD_ORARI } from '../utils/constants';
import { daysInMonth, getRep, isWeekend, isWork, restMinutes, shiftHours } from '../utils/helpers';
import { computeCoverage } from './engine';
import { OpStats, computeEquity, isHoliday, matrixCoherence } from './analytics';
import { monthlyHours } from './hours';

export interface PianoIssue {
  level: 'error' | 'warning' | 'suggestion';
  message: string;
}

export interface PianoCheck {
  score: number;            // 0..100
  coveragePct: number;
  equityIndex: number;
  coherenceIndex: number;
  restViolations: number;
  boundaryViolations: number;
  errors: PianoIssue[];
  warnings: PianoIssue[];
  suggestions: PianoIssue[];
}

const W = (t: string) => t === 'M' || t === 'P' || t === 'N';

function blankOp(infId: string, nome: string): OpStats {
  return {
    infId, nome, giorniLavorati: 0, ore: 0, notti: 0, weekend: 0, festivi: 0,
    straordinari: 0, riposi: 0, ferie: 0, assenze: 0, assenzePerTipo: {}, smontiNotte: 0, rientriRapidi: 0, carico: 0,
  };
}

export function checkPiano(ctx: EngineContext, piano: Piano, prevPiano?: Piano | null): PianoCheck {
  const dim = daysInMonth(ctx.year, ctx.month);
  const errors: PianoIssue[] = [];
  const warnings: PianoIssue[] = [];
  const suggestions: PianoIssue[] = [];

  // --- Riposi: 11h inviolabile (errori bloccanti) ---
  let restViolations = 0;
  for (const inf of ctx.staff) {
    const p = piano[inf.id];
    if (!p) continue;
    for (let d = 1; d < dim; d++) {
      const a = p[d];
      const b = p[d + 1];
      if (a && b && W(a.turno) && W(b.turno)) {
        const ao = a.repartoId ? (getRep(ctx.reparti, a.repartoId)?.orari || STD_ORARI) : STD_ORARI;
        const bo = b.repartoId ? (getRep(ctx.reparti, b.repartoId)?.orari || STD_ORARI) : STD_ORARI;
        if (restMinutes(a.turno, b.turno, ao, bo) < 660) {
          restViolations++;
          if (restViolations <= 5) errors.push({ level: 'error', message: `Riposo < 11h: ${inf.nome}, giorni ${d}→${d + 1} (${a.turno}/${b.turno})` });
        }
      }
    }
  }
  if (restViolations > 5) errors.push({ level: 'error', message: `Altre ${restViolations - 5} violazioni del riposo 11h` });

  // --- Riposo 11h al CONFINE col mese precedente (ultimo giorno mese prec. → giorno 1) ---
  let boundaryViolations = 0;
  if (prevPiano) {
    const pm = ctx.month === 0 ? { y: ctx.year - 1, m: 11 } : { y: ctx.year, m: ctx.month - 1 };
    const prevDim = daysInMonth(pm.y, pm.m);
    for (const inf of ctx.staff) {
      const a = prevPiano[inf.id] ? prevPiano[inf.id][prevDim] : null;
      const b = piano[inf.id] ? piano[inf.id][1] : null;
      if (a && b && W(a.turno) && W(b.turno)) {
        const ao = a.repartoId ? (getRep(ctx.reparti, a.repartoId)?.orari || STD_ORARI) : STD_ORARI;
        const bo = b.repartoId ? (getRep(ctx.reparti, b.repartoId)?.orari || STD_ORARI) : STD_ORARI;
        if (restMinutes(a.turno, b.turno, ao, bo) < 660) {
          boundaryViolations++;
          restViolations++;
          errors.push({ level: 'error', message: `Riposo < 11h tra mesi: ${inf.nome}, ultimo giorno mese prec. → giorno 1 (${a.turno}/${b.turno})` });
        }
      }
    }
  }

  // --- Copertura reparti ---
  const cov = computeCoverage(ctx, piano);
  const coveragePct = cov.globalPct;
  if (coveragePct < 100) {
    const lvl = coveragePct < 70 ? 'error' : 'warning';
    const issue: PianoIssue = { level: lvl, message: `Copertura ${coveragePct}% (${cov.uncovered.length} slot scoperti su ${cov.total})` };
    if (lvl === 'error') errors.push(issue); else warnings.push(issue);
    // dettaglio per reparto peggiore
    const perRep: Record<string, number> = {};
    for (const u of cov.uncovered) perRep[u.repId] = (perRep[u.repId] || 0) + 1;
    Object.keys(perRep)
      .sort((a, b) => perRep[b] - perRep[a])
      .slice(0, 3)
      .forEach((rid) => {
        const r = getRep(ctx.reparti, rid);
        suggestions.push({ level: 'suggestion', message: `Reparto ${r ? r.nome : rid}: ${perRep[rid]} slot scoperti — valuta più personale o turni aggiuntivi` });
      });
  }

  // --- Statistiche del mese per equità ---
  const ops: OpStats[] = [];
  for (const inf of ctx.staff) {
    const p = piano[inf.id];
    const st = blankOp(inf.id, inf.nome);
    if (p) {
      for (let d = 1; d <= dim; d++) {
        const c = p[d];
        if (!c) continue;
        if (c.turno === 'R') st.riposi++;
        else if (c.turno === 'F') { st.assenze++; }
        if (isWork(c.turno)) {
          st.giorniLavorati++;
          const orari = c.repartoId ? (getRep(ctx.reparti, c.repartoId)?.orari || STD_ORARI) : STD_ORARI;
          st.ore += shiftHours(c.turno, orari);
          if (c.turno === 'N') st.notti++;
          if (isWeekend(ctx.year, ctx.month, d)) st.weekend++;
          if (isHoliday(ctx.year, ctx.month, d)) st.festivi++;
        }
      }
    }
    ops.push(st);
  }
  const eq = computeEquity(ops);
  const equityIndex = eq.equityIndex;
  eq.alerts.forEach((a) => warnings.push({ level: 'warning', message: a.message }));
  if (ops.length >= 2 && equityIndex < 70) {
    suggestions.push({ level: 'suggestion', message: `Equità ${equityIndex}/100 (${eq.livello}) — riequilibra tra ${eq.penalized} (più carico) e ${eq.favored} (meno carico)` });
  }

  // --- Integrità: operatori senza piano / giorni mancanti ---
  for (const inf of ctx.staff) {
    const p = piano[inf.id];
    if (!p) { warnings.push({ level: 'warning', message: `${inf.nome} non ha turni nel mese` }); continue; }
    let missing = 0;
    for (let d = 1; d <= dim; d++) if (!p[d]) missing++;
    if (missing > 0) warnings.push({ level: 'warning', message: `${inf.nome}: ${missing} giorni senza turno assegnato` });
  }

  // --- Monte ore contrattuale ---
  const mh = monthlyHours(ctx, piano);
  mh.alerts.forEach((a) => {
    if (a.level === 'warning') warnings.push({ level: 'warning', message: a.message });
    else suggestions.push({ level: 'suggestion', message: a.message });
  });

  // --- Personale senza reparto (non verrà schedulato in copertura) ---
  const senzaReparto = ctx.staff.filter((s) => !s.reparti || s.reparti.length === 0);
  if (senzaReparto.length) {
    suggestions.push({ level: 'suggestion', message: `${senzaReparto.length} operatori senza reparto: assegnali per includerli nella copertura` });
  }

  // --- Smonto notte: ogni notte (o blocco) deve avere smonto e recupero corretti ---
  let smontoMancante = 0; let recuperoMancante = 0;
  for (const inf of ctx.staff) {
    const p = piano[inf.id]; if (!p) continue;
    for (let d = 1; d <= dim; d++) {
      if (!(p[d] && p[d].turno === 'N')) continue;
      const lastOfBlock = d === dim || !(p[d + 1] && p[d + 1].turno === 'N');
      if (!lastOfBlock || d >= dim) continue;
      let blockLen = 1; for (let k = d - 1; k >= 1 && p[k] && p[k].turno === 'N'; k--) blockLen++;
      const sDay = p[d + 1];
      if (!sDay || sDay.turno !== 'S') { smontoMancante++; continue; }
      if (blockLen >= 2) {
        const after = d + 2 <= dim ? p[d + 2] : null;
        if (!after || (after.turno !== 'R' && after.turno !== 'S')) recuperoMancante++;
      }
    }
  }
  if (smontoMancante) warnings.push({ level: 'warning', message: `${smontoMancante} notti senza smonto successivo` });
  if (recuperoMancante) warnings.push({ level: 'warning', message: `${recuperoMancante} doppie notti senza recupero completo dopo lo smonto` });

  // --- Qualità/coerenza della matrice ---
  const coh = matrixCoherence(ctx, piano);
  const coherenceIndex = coh.index;
  if (ctx.staff.length >= 1 && coherenceIndex < 70) {
    const worst = coh.perOp.slice().sort((a, b) => a.score - b.score)[0];
    suggestions.push({ level: 'suggestion', message: `Coerenza matrice ${coherenceIndex}/100 — sequenze poco naturali${worst ? ` (rivedi ${worst.nome})` : ''}` });
  }

  // --- Punteggio finale 0..100 ---
  const restScore = restViolations === 0 ? 100 : Math.max(0, 100 - restViolations * 20);
  let score = Math.round(coveragePct * 0.45 + equityIndex * 0.28 + restScore * 0.17 + coherenceIndex * 0.10);
  if (restViolations > 0) score = Math.min(score, 50); // riposo è inviolabile: cap se violato
  if (!ctx.staff.length) score = 0;
  score = Math.max(0, Math.min(100, score));

  return { score, coveragePct, equityIndex, coherenceIndex, restViolations, boundaryViolations, errors, warnings, suggestions };
}
