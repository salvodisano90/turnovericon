// services/hoursBank.ts — Banca ore per operatore (FUNZIONE PURA, sola analisi).
// Combina ore contrattuali/lavorate/saldo/straordinari con conteggio notti e festivi.
// Riusa le primitive del motore; non modifica la generazione.

import { EngineContext, OrariSet, Piano, Staff } from '../types';
import { STD_ORARI } from '../utils/constants';
import { daysInMonth, getCtr, getRep, isWork, shiftHours } from '../utils/helpers';

export interface HoursBankRow {
  infId: string;
  nome: string;
  contratto: string;
  oreContrattuali: number; // ore previste nel mese
  oreLavorate: number;     // solo turni
  oreAccreditate: number;  // turni + assenze giustificate
  saldo: number;           // accreditate - previste
  straordinari: number;    // max(0, saldo)
  debito: number;          // max(0, -saldo)
  notti: number;           // turni N
  festivi: number;         // turni in domenica/festivo
  assenze: number;         // giorni F
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const FESTIVI_FISSI = new Set(['0-1', '0-6', '3-25', '4-1', '5-2', '7-15', '10-1', '11-8', '11-25', '11-26']);
function isFestivo(year: number, month0: number, day: number): boolean {
  if (FESTIVI_FISSI.has(`${month0}-${day}`)) return true;
  return new Date(year, month0, day).getDay() === 0;
}
function orariOf(ctx: EngineContext, repartoId: string | null): OrariSet {
  return repartoId ? (getRep(ctx.reparti, repartoId)?.orari || STD_ORARI) : STD_ORARI;
}
function effContract(inf: Staff): { oreSett: number; oreMese: number } {
  if (inf.oreSettimanali && inf.oreSettimanali > 0) return { oreSett: inf.oreSettimanali, oreMese: Math.round(inf.oreSettimanali * 4.345) };
  const c = getCtr(inf.contratto);
  return { oreSett: c.oreSett, oreMese: c.oreMese };
}

export function hoursBank(ctx: EngineContext, piano: Piano): HoursBankRow[] {
  const dim = daysInMonth(ctx.year, ctx.month);
  const rows: HoursBankRow[] = [];
  for (const inf of ctx.staff) {
    const { oreSett, oreMese } = effContract(inf);
    const p = piano[inf.id];
    let worked = 0, notti = 0, festivi = 0, assenze = 0;
    if (p) {
      for (let d = 1; d <= dim; d++) {
        const c = p[d];
        if (!c) continue;
        if (isWork(c.turno)) {
          worked += shiftHours(c.turno, orariOf(ctx, c.repartoId));
          if (c.turno === 'N') notti++;
          if (isFestivo(ctx.year, ctx.month, d)) festivi++;
        } else if (c.turno === 'F') assenze++;
      }
    }
    const dailyQuota = oreSett / 6;
    const accreditate = r1(worked + assenze * dailyQuota);
    const saldo = r1(accreditate - oreMese);
    rows.push({
      infId: inf.id, nome: inf.nome, contratto: inf.contratto,
      oreContrattuali: oreMese, oreLavorate: r1(worked), oreAccreditate: accreditate,
      saldo, straordinari: Math.max(0, saldo), debito: Math.max(0, -saldo),
      notti, festivi, assenze,
    });
  }
  return rows;
}
