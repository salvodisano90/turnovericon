// services/xlsxData.ts — modello dati del workbook Excel (funzione pura, testabile)

import { EngineContext, Piano } from '../types';
import { ASSENZA, ASS_COLOR, ASS_SOFT, MONTHS, STD_ORARI } from '../utils/constants';
import { daysInMonth, getRep, isWeekend, isWork, shiftHours } from '../utils/helpers';
import { computeCoverage } from './engine';
import { computeEquity, isHoliday, OpStats } from './analytics';
import { monthlyHours } from './hours';

export interface XlsxCell { code: string; fill: string; font: string; settore: string | null; weekend: boolean; }
export interface XlsxRow { infId: string; nome: string; cells: XlsxCell[]; totaleOre: number; }
export interface XlsxSheet { repId: string; name: string; days: number[]; rows: XlsxRow[]; }
export interface XlsxSummary {
  reparti: { nome: string; coveragePct: number; operatori: number }[];
  operatori: { nome: string; ore: number; notti: number; weekend: number; festivi: number; ferie: number; assenze: number; diff: number }[];
  equityIndex: number;
  coveragePct: number;
}
export interface XlsxLegendItem { code: string; label: string; fill: string; font: string; }
export interface XlsxAbsence { operatore: string; dal: number; al: number; motivo: string; }
export interface WorkbookModel {
  title: string;
  month: number;
  year: number;
  sheets: XlsxSheet[];
  summary: XlsxSummary;
  legend: XlsxLegendItem[];
  absences: XlsxAbsence[];
}

const hex = (c: string) => c.replace('#', '').toUpperCase();
const TCOL: Record<string, { fill: string; font: string }> = {
  M: { fill: 'D6E9FF', font: '0A57C2' },
  P: { fill: 'FFE9CC', font: 'B36B00' },
  N: { fill: 'EDDCF9', font: '7B2FB0' },
  R: { fill: 'EFEFF0', font: '6B6B70' },
  S: { fill: 'E0F2FE', font: '0369A1' },
  G: { fill: 'FEF3C7', font: 'B45309' },
  F: { fill: 'E7F8F0', font: '059669' },
};

function cellModel(ctx: EngineContext, c: { turno: string; settore?: string | null; motivo?: string; assenza?: string } | null, day: number): XlsxCell {
  const weekend = isWeekend(ctx.year, ctx.month, day);
  if (!c) return { code: '', fill: weekend ? 'F4F4F6' : 'FFFFFF', font: '000000', settore: null, weekend };
  if (c.turno === 'F') {
    return { code: ASSENZA.code, fill: hex(ASS_SOFT), font: hex(ASS_COLOR), settore: null, weekend };
  }
  const t = TCOL[c.turno] || TCOL.R;
  return { code: c.turno, fill: t.fill, font: t.font, settore: isWork(c.turno as any) ? (c.settore || null) : null, weekend };
}

export function buildWorkbookModel(ctx: EngineContext, piano: Piano): WorkbookModel {
  const dim = daysInMonth(ctx.year, ctx.month);
  const days = Array.from({ length: dim }, (_, i) => i + 1);

  const sheets: XlsxSheet[] = ctx.reparti.map((rep) => {
    const members = ctx.staff.filter((s) => (s.reparti || []).indexOf(rep.id) >= 0);
    const rows: XlsxRow[] = members.map((m) => {
      const p = piano[m.id];
      const cells: XlsxCell[] = [];
      let ore = 0;
      for (let d = 1; d <= dim; d++) {
        const c = p ? p[d] : null;
        cells.push(cellModel(ctx, c as any, d));
        if (c && isWork(c.turno)) {
          const orari = c.repartoId ? (getRep(ctx.reparti, c.repartoId)?.orari || STD_ORARI) : STD_ORARI;
          ore += shiftHours(c.turno, orari);
        }
      }
      return { infId: m.id, nome: m.nome, cells, totaleOre: Math.round(ore) };
    });
    return { repId: rep.id, name: rep.nome, days, rows };
  });

  // --- riepilogo ---
  const cov = computeCoverage(ctx, piano);
  const repPct: Record<string, { covered: number; total: number }> = {};
  for (const rep of ctx.reparti) {
    const rc = cov.byRep[rep.id];
    let covered = 0;
    let total = 0;
    if (rc) for (const s of rc.slots) { covered += s.covered; total += s.total; }
    repPct[rep.id] = { covered, total };
  }
  const mh = monthlyHours(ctx, piano);
  const diffById: Record<string, number> = {};
  for (const o of mh.perOperator) diffById[o.infId] = o.diff;

  const ops: OpStats[] = [];
  const operatori = ctx.staff.map((s) => {
    const p = piano[s.id];
    let ore = 0; let notti = 0; let weekend = 0; let festivi = 0; let ferie = 0; let assenze = 0;
    if (p) {
      for (let d = 1; d <= dim; d++) {
        const c = p[d];
        if (!c) continue;
        if (c.turno === 'F') { assenze++; }
        if (isWork(c.turno)) {
          const orari = c.repartoId ? (getRep(ctx.reparti, c.repartoId)?.orari || STD_ORARI) : STD_ORARI;
          ore += shiftHours(c.turno, orari);
          if (c.turno === 'N') notti++;
          if (isWeekend(ctx.year, ctx.month, d)) weekend++;
          if (isHoliday(ctx.year, ctx.month, d)) festivi++;
        }
      }
    }
    ops.push({ infId: s.id, nome: s.nome, giorniLavorati: 0, ore, notti, weekend, festivi, straordinari: 0, riposi: 0, ferie, assenze, assenzePerTipo: {}, smontiNotte: 0, rientriRapidi: 0, carico: 0 });
    return { nome: s.nome, ore: Math.round(ore), notti, weekend, festivi, ferie, assenze, diff: diffById[s.id] || 0 };
  });

  const eq = computeEquity(ops);
  const summary: XlsxSummary = {
    reparti: ctx.reparti.map((rep) => ({ nome: rep.nome, coveragePct: repPct[rep.id].total ? Math.round((repPct[rep.id].covered / repPct[rep.id].total) * 100) : 100, operatori: ctx.staff.filter((s) => (s.reparti || []).indexOf(rep.id) >= 0).length })),
    operatori,
    equityIndex: eq.equityIndex,
    coveragePct: cov.globalPct,
  };

  const legend: XlsxLegendItem[] = [
    { code: 'M', label: 'Mattina', fill: TCOL.M.fill, font: TCOL.M.font },
    { code: 'P', label: 'Pomeriggio', fill: TCOL.P.fill, font: TCOL.P.font },
    { code: 'N', label: 'Notte', fill: TCOL.N.fill, font: TCOL.N.font },
    { code: 'R', label: 'Riposo', fill: TCOL.R.fill, font: TCOL.R.font },
    { code: 'S', label: 'Smonto notte', fill: TCOL.S.fill, font: TCOL.S.font },
    { code: ASSENZA.code, label: ASSENZA.label, fill: hex(ASS_SOFT), font: hex(ASS_COLOR) },
  ];

  const nameById: Record<string, string> = {};
  for (const st of ctx.staff) nameById[st.id] = st.nome;
  const absences: XlsxAbsence[] = (ctx.ferie || [])
    .filter((f) => f.month === ctx.month && f.year === ctx.year)
    .sort((a, b) => (a.from - b.from) || ((nameById[a.infId] || '').localeCompare(nameById[b.infId] || '')))
    .map((f) => ({ operatore: nameById[f.infId] || f.infId, dal: f.from, al: f.to, motivo: (f.motivo && f.motivo.trim()) ? f.motivo.trim() : 'Assenza' }));

  return { title: `Turni ${MONTHS[ctx.month]} ${ctx.year}`, month: ctx.month, year: ctx.year, sheets, summary, legend, absences };
}
