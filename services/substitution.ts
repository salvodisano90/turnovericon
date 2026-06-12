// services/substitution.ts — proposta automatica dei migliori sostituti (funzione pura)

import { EngineContext, Piano, Reparto, SubCandidate, TurnoLavoro, UncoveredSlot } from '../types';
import { STD_ORARI } from '../utils/constants';
import { daysInMonth, getRep, isWeekend, isWork, shiftHours, countsInCoverage } from '../utils/helpers';
import { computeCoverage, countTurno, countWork, evalCandidate, getCell, monteTurni, classifyOperator } from './engine';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface OpAgg { worked: number; notti: number; weekend: number; ore: number; }

function aggregate(ctx: EngineContext, piano: Piano, infId: string, dim: number): OpAgg {
  const p = piano[infId];
  const agg: OpAgg = { worked: 0, notti: 0, weekend: 0, ore: 0 };
  if (!p) return agg;
  for (let d = 1; d <= dim; d++) {
    const c = p[d];
    if (!c || !isWork(c.turno)) continue;
    agg.worked++;
    if (c.turno === 'N') agg.notti++;
    if (isWeekend(ctx.year, ctx.month, d)) agg.weekend++;
    const orari = c.repartoId ? (getRep(ctx.reparti, c.repartoId)?.orari || STD_ORARI) : STD_ORARI;
    agg.ore += shiftHours(c.turno, orari);
  }
  return agg;
}

export interface SubTarget {
  day: number;
  repId: string;
  turno: TurnoLavoro;
  settore: string;     // codice settore completo (es. MPS1)
  excludeId?: string;
}

/** Restituisce i candidati ordinati per compatibilità (0..100) per coprire uno slot. */
export function rankSubstitutes(ctx: EngineContext, piano: Piano, target: SubTarget): SubCandidate[] {
  const rep: Reparto | null = getRep(ctx.reparti, target.repId);
  if (!rep) return [];
  const dim = daysInMonth(ctx.year, ctx.month);

  // massimi di squadra per normalizzare l'equità
  let maxNotti = 1; let maxWeekend = 1; let maxOre = 1;
  const aggs: Record<string, OpAgg> = {};
  for (const s of ctx.staff) {
    const a = aggregate(ctx, piano, s.id, dim);
    aggs[s.id] = a;
    if (a.notti > maxNotti) maxNotti = a.notti;
    if (a.weekend > maxWeekend) maxWeekend = a.weekend;
    if (a.ore > maxOre) maxOre = a.ore;
  }

  const out: SubCandidate[] = [];
  for (const s of ctx.staff) {
    if (target.excludeId && s.id === target.excludeId) continue;
    if (!countsInCoverage(s)) continue; // coordinamento/supporto: mai tra i sostituti disponibili
    const cell = getCell(piano, s.id, target.day);
    const disponibile = !cell || cell.turno === 'R'; // libero (riposo o vuoto), non già a lavoro né assente
    const ev = evalCandidate(ctx, piano, s, target.day, target.turno, rep, target.settore);
    const a = aggs[s.id];
    const quota = monteTurni(s);
    const residuo = quota - a.worked;

    const breakdown = {
      disponibile,
      reparto: s.reparti.indexOf(rep.id) >= 0,
      settore: (rep.settori[target.turno] || 0) > 0 && s.esenzioniSettori.indexOf(target.settore) < 0,
      riposo11h: !!ev, // evalCandidate ritorna null se il riposo 11h sarebbe violato
      monteOreResiduo: residuo,
      notti: a.notti,
      weekend: a.weekend,
      caricoOre: a.ore,
    };

    const eligible = disponibile && !!ev;
    let score = 0;
    let motivo = '';
    if (!eligible) {
      // motivazione del perché non è proponibile
      const reasons: string[] = [];
      if (!disponibile) reasons.push(cell && isWork(cell.turno) ? 'già in turno' : cell && cell.turno === 'F' ? 'assente' : 'non disponibile');
      else if (!ev) {
        if (s.reparti.indexOf(rep.id) < 0) reasons.push('reparto incompatibile');
        else if (s.esenzioniTurni.indexOf(target.turno) >= 0) reasons.push('turno esente');
        else if (s.esenzioniSettori.indexOf(target.settore) >= 0) reasons.push('settore esente');
        else if (target.turno === 'N' && s.nottiPerCiclo === 0) reasons.push('non idoneo notti');
        else reasons.push('riposo 11h non rispettato');
      }
      motivo = reasons.join(' · ');
    } else {
      score = 100;
      const der = ev.deroghe;
      if (der.indexOf('ore') >= 0) score -= 22;
      if (der.indexOf('notti') >= 0) score -= 16;
      if (der.indexOf('consec') >= 0) score -= 12;
      const rr = quota > 0 ? residuo / quota : 0;
      if (rr < 0) score -= Math.min(20, -rr * 40);        // oltre il monte ore
      score -= (a.notti / maxNotti) * 14;                  // equità notti
      score -= (a.weekend / maxWeekend) * 10;              // equità weekend
      score -= (a.ore / maxOre) * 12;                      // carico complessivo
      const lvlRank = { Referente: 5, Esperto: 4, Senior: 3, Junior: 2, Neoassunto: 1 } as const;
      score += (lvlRank[classifyOperator(s).categoria] - 3) * 3; // priorità livello professionale
      score = clamp(Math.round(score), 0, 100);

      const parts: string[] = ['riposo 11h ok'];
      parts.push(residuo > 0 ? `${residuo} turni residui` : 'monte ore pieno');
      parts.push(`${a.notti} notti`, `${a.weekend} weekend`);
      if (der.length) parts.push('⚠ ' + der.map((d) => d === 'ore' ? 'oltre monte ore' : d === 'notti' ? 'oltre notti max' : 'giorni consecutivi').join(', '));
      motivo = parts.join(' · ');
    }

    out.push({ infId: s.id, nome: s.nome, score, eligible, deroghe: ev ? ev.deroghe : [], motivo, breakdown });
  }

  out.sort((x, y) => (Number(y.eligible) - Number(x.eligible)) || (y.score - x.score) || x.nome.localeCompare(y.nome));
  return out;
}

/** Slot scoperti in un reparto in un dato giorno (per la sostituzione dopo un'assenza). */
export function findUncovered(ctx: EngineContext, piano: Piano, day: number, repId: string): UncoveredSlot[] {
  const cov = computeCoverage(ctx, piano);
  return cov.uncovered.filter((u) => u.repId === repId && u.day === day);
}
