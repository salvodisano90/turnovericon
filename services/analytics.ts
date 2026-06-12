// services/analytics.ts — simulatore annuale, statistiche ed equità (funzioni pure)

import { EngineContext, Piano, Turno } from '../types';
import { STD_ORARI, MONTHS } from '../utils/constants';
import { buildPiano, edgeFromPiano, computeCoverage, PrevEdge } from './engine';
import { daysInMonth, getRep, isHoliday, isWeekend, isWork, restMinutes, shiftHours } from '../utils/helpers';
export { isHoliday };

export interface OpStats {
  infId: string;
  nome: string;
  giorniLavorati: number;
  ore: number;
  notti: number;
  weekend: number;
  festivi: number;
  straordinari: number;
  riposi: number;
  ferie: number;
  assenze: number;
  assenzePerTipo: Record<string, number>;
  smontiNotte: number;
  rientriRapidi: number;
  carico: number; // indice di carico relativo 0..100 (vs il massimo del gruppo)
  settoreCounts?: Record<string, number>;
  repartoCounts?: Record<string, number>;
  distinctSettori?: number;
  distinctReparti?: number;
  settorePiu?: string; settoreMeno?: string;
  repartoPiu?: string; repartoMeno?: string;
}

export interface AggregateStats {
  giorniLavorati: number;
  ore: number;
  notti: number;
  weekend: number;
  festivi: number;
  straordinari: number;
  riposi: number;
  ferie: number;
  assenze: number;
}

export interface EquityAlert {
  metric: 'notti' | 'weekend' | 'festivi' | 'ore';
  severity: 'warn' | 'info';
  message: string;
}

export interface SimResult {
  label: string;
  months: number;
  perOperator: OpStats[];
  aggregate: AggregateStats;
  equityIndex: number; // 0..100 (100 = perfettamente equo)
  diffOre: number;
  diffNotti: number;
  diffWeekend: number;
  diffFestivi: number;
  diffRiposi: number;
  diffSmonti: number;
  diffReparti: number;
  diffSettori: number;
  coherenceIndex: number; // 0..100 (coerenza/leggibilità della matrice)
  alerts: EquityAlert[];
  penalized: string;   // operatore più penalizzato (più ore)
  favored: string;     // operatore più favorito (meno ore)
  stdDevOre: number;   // deviazione standard delle ore
  livello: string;     // livello di equilibrio
  coveragePct: number; // % copertura media
  prefPct: number;     // % preferenze deboli soddisfatte
  desPct: number;      // % desiderata soddisfatti
  deroghe: number;     // numero totale di deroghe generate
}

// --- Festività italiane (fisse + Pasquetta) ---


function emptyOp(infId: string, nome: string): OpStats {
  return {
    infId, nome, giorniLavorati: 0, ore: 0, notti: 0, weekend: 0, festivi: 0,
    straordinari: 0, riposi: 0, ferie: 0, assenze: 0, assenzePerTipo: {}, smontiNotte: 0, rientriRapidi: 0, carico: 0,
    settoreCounts: {}, repartoCounts: {},
  };
}

/**
 * Simula `months` mesi consecutivi a partire da (fromYear, fromMonth) mantenendo la
 * continuità del ciclo (fase ancorata al calendario). Calcola statistiche per operatore
 * e aggregate, indice di equità e alert di squilibrio. Funzione PURA: non tocca lo store.
 */
export function simulateRange(base: EngineContext, fromYear: number, fromMonth: number, months: number): SimResult {
  const ops: Record<string, OpStats> = {};
  for (const inf of base.staff) ops[inf.id] = emptyOp(inf.id, inf.nome);

  let y = fromYear;
  let m = fromMonth;
  let prevEdge: PrevEdge = {};
  let cohSum = 0; let cohCount = 0;
  let covSum = 0; let prefSum = 0; let desSum = 0; let derTot = 0;
  for (let mi = 0; mi < months; mi++) {
    const ctx: EngineContext = { ...base, month: m, year: y };
    const { piano, stats } = buildPiano(ctx, {}, false, prevEdge);
    const dim = daysInMonth(y, m);
    cohSum += matrixCoherence(ctx, piano).index; cohCount++;
    covSum += computeCoverage(ctx, piano).globalPct;
    prefSum += (stats.prefPct ?? 100); desSum += (stats.desPct ?? 100); derTot += (stats.derogheList ? stats.derogheList.length : 0);
    for (const inf of base.staff) {
      const p = piano[inf.id];
      const st = ops[inf.id];
      if (!p) continue;
      for (let d = 1; d <= dim; d++) {
        const c = p[d];
        if (!c) continue;
        const t: Turno = c.turno;
        if (t === 'R') st.riposi++;
        else if (t === 'F') {
          const motivo = (c.motivo && c.motivo.trim()) ? c.motivo.trim() : 'Assenza';
          st.assenzePerTipo[motivo] = (st.assenzePerTipo[motivo] || 0) + 1;
          st.assenze++;
        }
        if (isWork(t)) {
          st.giorniLavorati++;
          if (c.settore) st.settoreCounts![c.settore] = (st.settoreCounts![c.settore] || 0) + 1;
          if (c.repartoId) st.repartoCounts![c.repartoId] = (st.repartoCounts![c.repartoId] || 0) + 1;
          const orari = c.repartoId ? (getRep(ctx.reparti, c.repartoId)?.orari || STD_ORARI) : STD_ORARI;
          st.ore += shiftHours(t, orari);
          if (t === 'N') st.notti++;
          if (isWeekend(y, m, d)) st.weekend++;
          if (isHoliday(y, m, d)) st.festivi++;
          if (c.deroghe && c.deroghe.indexOf('ore') >= 0) st.straordinari++;
          // rientro rapido: riposo tra due giorni lavorati tra 11h e <12h
          const prev = d > 1 ? p[d - 1] : null;
          if (prev && isWork(prev.turno)) {
            const po = prev.repartoId ? (getRep(ctx.reparti, prev.repartoId)?.orari || STD_ORARI) : STD_ORARI;
            const r = restMinutes(prev.turno, t, po, orari);
            if (r >= 660 && r < 720) st.rientriRapidi++;
          }
        }
        // smonto notte: R preceduto da N
        if (t === 'S') st.smontiNotte++; // smonto notte: categoria separata (né lavoro né riposo)
      }
    }
    // bordo per il mese successivo (riposo 11h tra mesi consecutivi)
    prevEdge = edgeFromPiano(ctx.reparti, piano, y, m);
    m++;
    if (m > 11) { m = 0; y++; }
  }

  const list = base.staff.map((inf) => ops[inf.id]);
  const round1 = (x: number) => Math.round(x * 10) / 10;
  for (const st of list) st.ore = round1(st.ore);

  // carico relativo
  const maxOre = Math.max(1, ...list.map((s) => s.ore));
  for (const st of list) st.carico = Math.round((st.ore / maxOre) * 100);

  // diversità settore/reparto per operatore (most/least + distinti)
  const repName: Record<string, string> = {};
  for (const r of base.reparti) repName[r.id] = r.sigla || r.nome;
  const extremes = (m: Record<string, number>): { piu: string; meno: string; n: number } => {
    const ks = Object.keys(m); if (!ks.length) return { piu: '—', meno: '—', n: 0 };
    let piu = ks[0], meno = ks[0];
    for (const k of ks) { if (m[k] > m[piu]) piu = k; if (m[k] < m[meno]) meno = k; }
    return { piu, meno, n: ks.length };
  };
  for (const st of list) {
    const es = extremes(st.settoreCounts || {});
    st.distinctSettori = es.n; st.settorePiu = es.piu; st.settoreMeno = es.n > 1 ? es.meno : es.piu;
    const er = extremes(st.repartoCounts || {});
    st.distinctReparti = er.n;
    st.repartoPiu = repName[er.piu] || er.piu; st.repartoMeno = repName[er.n > 1 ? er.meno : er.piu] || er.piu;
  }
  const distinctSet = list.map((s) => s.distinctSettori || 0);
  const distinctRep = list.map((s) => s.distinctReparti || 0);
  const diffSettori = distinctSet.length ? Math.max(...distinctSet) - Math.min(...distinctSet) : 0;
  const diffReparti = distinctRep.length ? Math.max(...distinctRep) - Math.min(...distinctRep) : 0;

  // aggregate
  const aggregate: AggregateStats = {
    giorniLavorati: list.reduce((a, s) => a + s.giorniLavorati, 0),
    ore: round1(list.reduce((a, s) => a + s.ore, 0)),
    notti: list.reduce((a, s) => a + s.notti, 0),
    weekend: list.reduce((a, s) => a + s.weekend, 0),
    festivi: list.reduce((a, s) => a + s.festivi, 0),
    straordinari: list.reduce((a, s) => a + s.straordinari, 0),
    riposi: list.reduce((a, s) => a + s.riposi, 0),
    ferie: list.reduce((a, s) => a + s.ferie, 0),
    assenze: list.reduce((a, s) => a + s.assenze, 0),
  };

  const eq = computeEquity(list);
  const smonti = list.map((s) => s.smontiNotte);
  const diffSmonti = smonti.length ? Math.max(...smonti) - Math.min(...smonti) : 0;
  const coherenceIndex = cohCount ? Math.round(cohSum / cohCount) : 100;

  const toLabel = (() => {
    const end = new Date(fromYear, fromMonth + months - 1, 1);
    return `${MONTHS[fromMonth]} ${fromYear} → ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
  })();

  return { label: toLabel, months, perOperator: list, aggregate, equityIndex: eq.equityIndex, diffOre: eq.diffOre, diffNotti: eq.diffNotti, diffWeekend: eq.diffWeekend, diffFestivi: eq.diffFestivi, diffRiposi: eq.diffRiposi, alerts: eq.alerts, penalized: eq.penalized, favored: eq.favored, stdDevOre: eq.stdDevOre, livello: eq.livello, coherenceIndex, diffSmonti, diffReparti, diffSettori, coveragePct: Math.round(covSum / months), prefPct: Math.round(prefSum / months), desPct: Math.round(desSum / months), deroghe: derTot };
}

/**
 * Indice di Coerenza della Matrice (0..100): valuta quanto la riga di ogni operatore
 * somiglia a una turnazione costruita da un coordinatore esperto — blocchi compatti,
 * rotazioni naturali, recuperi post-notte (N→S→R), riposi non frammentati, assenza di
 * alternanze casuali. 100 = molto leggibile/coerente.
 */
export function matrixCoherence(ctx: EngineContext, piano: Piano): { index: number; perOp: { infId: string; nome: string; score: number }[] } {
  const dim = daysInMonth(ctx.year, ctx.month);
  const restLike = (x: string | null) => x === 'R' || x === 'S' || x === null;
  const perOp = ctx.staff.map((inf) => {
    const p = piano[inf.id];
    if (!p) return { infId: inf.id, nome: inf.nome, score: 100 };
    let pen = 0; let runRest = 0;
    for (let d = 1; d <= dim; d++) {
      const c = p[d]; const t = c ? c.turno : 'R';
      const pt = p[d - 1] ? p[d - 1].turno : null;
      const nt = p[d + 1] ? p[d + 1].turno : null;
      if (t === 'R') { runRest++; if (runRest > 4) pen += 2 * (runRest - 4); } else runRest = 0;
      if (pt === 'N' && (t === 'M' || t === 'P')) pen += 6;            // notte→lavoro senza smonto
      else if ((pt === 'M' || pt === 'P') && t === 'N') pen += 3;      // giorno→notte brusco
      if (isWork(t)) {
        if (restLike(pt) && restLike(nt)) pen += 2;                    // lavoro isolato fra riposi/smonti
        else if (pt && nt && isWork(pt) && isWork(nt) && pt !== t && nt !== t && pt === nt) pen += 1.5; // alternanza M P M
      }
    }
    const score = Math.max(0, Math.min(100, Math.round(100 - (pen / Math.max(1, dim)) * 55)));
    return { infId: inf.id, nome: inf.nome, score };
  });
  const index = perOp.length ? Math.round(perOp.reduce((a, o) => a + o.score, 0) / perOp.length) : 100;
  return { index, perOp };
}

function balance(vals: number[]): number {
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  if (max <= 0) return 100;
  return Math.round((min / max) * 100);
}

function extremes(list: OpStats[], key: 'notti' | 'weekend' | 'festivi' | 'ore' | 'riposi') {
  let hi = list[0];
  let lo = list[0];
  for (const s of list) {
    if (s[key] > hi[key]) hi = s;
    if (s[key] < lo[key]) lo = s;
  }
  return { hi, lo };
}

export interface EquityReport {
  equityIndex: number;
  diffOre: number;
  diffNotti: number;
  diffWeekend: number;
  diffFestivi: number;
  diffRiposi: number;
  alerts: EquityAlert[];
  penalized: string;
  favored: string;
  stdDevOre: number;
  livello: string;
}

function stdDev(vals: number[]): number {
  if (!vals.length) return 0;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const v = vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vals.length;
  return Math.round(Math.sqrt(v) * 10) / 10;
}

export function computeEquity(list: OpStats[]): EquityReport {
  if (list.length < 2) {
    return { equityIndex: 100, diffOre: 0, diffNotti: 0, diffWeekend: 0, diffFestivi: 0, diffRiposi: 0, alerts: [], penalized: list[0]?.nome || '—', favored: list[0]?.nome || '—', stdDevOre: 0, livello: 'Alto' };
  }
  const bNotti = balance(list.map((s) => s.notti));
  const bWeek = balance(list.map((s) => s.weekend));
  const bFest = balance(list.map((s) => s.festivi));
  const bOre = balance(list.map((s) => s.ore));
  const bRip = balance(list.map((s) => s.riposi));
  // punteggio 0..100: media pesata (ore e notti contano di più)
  const equityIndex = Math.round((bNotti * 1.2 + bWeek + bFest + bOre * 1.2 + bRip * 0.6) / 5.0);
  const dRip = extremes(list, 'riposi');

  const alerts: EquityAlert[] = [];
  const push = (metric: EquityAlert['metric'], diff: number, thr: number, label: string) => {
    const { hi, lo } = extremes(list, metric);
    if (diff >= thr) {
      alerts.push({
        metric,
        severity: diff >= thr * 2 ? 'warn' : 'info',
        message: `Distribuzione ${label} non equa: ${hi.nome} ${hi[metric]} vs ${lo.nome} ${lo[metric]}`,
      });
    }
  };
  const dN = extremes(list, 'notti'); push('notti', dN.hi.notti - dN.lo.notti, 5, 'notti');
  const dW = extremes(list, 'weekend'); push('weekend', dW.hi.weekend - dW.lo.weekend, 4, 'weekend');
  const dF = extremes(list, 'festivi'); push('festivi', dF.hi.festivi - dF.lo.festivi, 3, 'festivi');
  const dO = extremes(list, 'ore');
  const meanOre = list.reduce((a, s) => a + s.ore, 0) / list.length;
  push('ore', dO.hi.ore - dO.lo.ore, Math.max(16, meanOre * 0.15), 'ore');

  const hiOre = extremes(list, 'ore');
  const stdDevOre = stdDev(list.map((o) => o.ore));
  const livello = equityIndex >= 80 ? 'Alto' : equityIndex >= 60 ? 'Medio' : 'Basso';
  return {
    equityIndex,
    diffOre: Math.round((dO.hi.ore - dO.lo.ore) * 10) / 10,
    diffNotti: dN.hi.notti - dN.lo.notti,
    diffWeekend: dW.hi.weekend - dW.lo.weekend,
    diffFestivi: dF.hi.festivi - dF.lo.festivi,
    diffRiposi: dRip.hi.riposi - dRip.lo.riposi,
    alerts, penalized: hiOre.hi.nome, favored: hiOre.lo.nome, stdDevOre, livello,
  };
}
