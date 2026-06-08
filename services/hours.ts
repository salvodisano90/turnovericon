// services/hours.ts — monte ore contrattuale (funzione pura)

import { AnnualHours, EngineContext, HoursAlert, MonthlyHours, OperatorHours, Piano, Staff } from '../types';
import { MONTHS, STD_ORARI } from '../utils/constants';
import { daysInMonth, getCtr, getRep, isWork, shiftHours } from '../utils/helpers';
import { buildPiano, edgeFromPiano, PrevEdge } from './engine';

const r1 = (n: number) => Math.round(n * 10) / 10;

function effContract(inf: Staff): { oreSett: number; oreMese: number } {
  if (inf.oreSettimanali && inf.oreSettimanali > 0) {
    return { oreSett: inf.oreSettimanali, oreMese: Math.round(inf.oreSettimanali * 4.345) };
  }
  const c = getCtr(inf.contratto);
  return { oreSett: c.oreSett, oreMese: c.oreMese };
}
const dailyQuota = (oreSett: number) => oreSett / 6; // settimana standard a 6 giorni

function opHoursForMonth(ctx: EngineContext, piano: Piano, inf: Staff, dim: number): OperatorHours {
  const { oreSett, oreMese } = effContract(inf);
  const p = piano[inf.id];
  let worked = 0;
  let absDays = 0;
  if (p) {
    for (let d = 1; d <= dim; d++) {
      const c = p[d];
      if (!c) continue;
      if (isWork(c.turno)) {
        const orari = c.repartoId ? (getRep(ctx.reparti, c.repartoId)?.orari || STD_ORARI) : STD_ORARI;
        worked += shiftHours(c.turno, orari);
      } else if (c.turno === 'F') {
        absDays++; // assenza giustificata: accreditata al monte ore
      }
    }
  }
  const assigned = r1(worked + absDays * dailyQuota(oreSett));
  const diff = r1(assigned - oreMese);
  return {
    infId: inf.id, nome: inf.nome, contratto: inf.contratto, oreSett,
    expected: oreMese, assigned, worked: r1(worked), diff,
    overtime: Math.max(0, diff), debt: Math.max(0, -diff),
  };
}

export function hoursAlerts(list: OperatorHours[], months: number): HoursAlert[] {
  const alerts: HoursAlert[] = [];
  for (const o of list) {
    if (o.overtime > 16 * months) alerts.push({ level: 'warning', infId: o.infId, message: `${o.nome}: straordinario elevato (+${o.overtime}h)` });
    else if (o.diff > 8 * months) alerts.push({ level: 'info', infId: o.infId, message: `${o.nome}: monte ore superato (+${o.diff}h)` });
    if (o.debt > 12 * months) alerts.push({ level: 'warning', infId: o.infId, message: `${o.nome}: monte ore insufficiente / debito (${o.debt}h)` });
  }
  if (list.length >= 2) {
    const a = list.map((o) => o.assigned);
    const mx = Math.max(...a);
    const mn = Math.min(...a);
    if (mx - mn > 24 * months) alerts.push({ level: 'warning', message: `Squilibrio ore tra operatori (Δ ${Math.round(mx - mn)}h)` });
  }
  return alerts;
}

export function monthlyHours(ctx: EngineContext, piano: Piano): MonthlyHours {
  const dim = daysInMonth(ctx.year, ctx.month);
  const perOperator = ctx.staff.map((inf) => opHoursForMonth(ctx, piano, inf, dim));
  return { month: ctx.month, year: ctx.year, perOperator, alerts: hoursAlerts(perOperator, 1) };
}

export function annualHours(base: EngineContext, fromYear: number, fromMonth: number, months: number): AnnualHours {
  const acc: Record<string, { nome: string; contratto: string; oreSett: number; expected: number; assigned: number; worked: number }> = {};
  const trend: { label: string; expected: number; assigned: number }[] = [];
  let y = fromYear;
  let m = fromMonth;
  let prevEdge: PrevEdge = {};
  for (let k = 0; k < months; k++) {
    const ctx: EngineContext = { ...base, month: m, year: y };
    const { piano } = buildPiano(ctx, {}, false, prevEdge);
    const mh = monthlyHours(ctx, piano);
    let te = 0;
    let ta = 0;
    for (const o of mh.perOperator) {
      const a = acc[o.infId] || (acc[o.infId] = { nome: o.nome, contratto: o.contratto, oreSett: o.oreSett, expected: 0, assigned: 0, worked: 0 });
      a.expected += o.expected;
      a.assigned += o.assigned;
      a.worked += o.worked;
      te += o.expected;
      ta += o.assigned;
    }
    trend.push({ label: `${MONTHS[m].slice(0, 3)} ${String(y).slice(2)}`, expected: Math.round(te), assigned: Math.round(ta) });
    prevEdge = edgeFromPiano(ctx.reparti, piano, y, m);
    m++;
    if (m > 11) { m = 0; y++; }
  }
  const perOperator: OperatorHours[] = Object.keys(acc).map((id) => {
    const a = acc[id];
    const expected = Math.round(a.expected);
    const assigned = Math.round(a.assigned);
    const diff = assigned - expected;
    return { infId: id, nome: a.nome, contratto: a.contratto, oreSett: a.oreSett, expected, assigned, worked: Math.round(a.worked), diff, overtime: Math.max(0, diff), debt: Math.max(0, -diff) };
  });
  return { label: `${months} mesi`, months, perOperator, trend, alerts: hoursAlerts(perOperator, months) };
}
