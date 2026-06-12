// services/reperibilita.ts — Modulo REPERIBILITÀ separato (overlay), NON tocca il motore di generazione.
// Persistenza propria su AsyncStorage. Parte pura (stats/controlli) verificabile.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { EngineContext, Piano, RepAssignment, Staff } from '../types';
import { isWork } from '../utils/helpers';

const KEY = 'turnover.reperibilita';

// --- Persistenza (best-effort, mai crash) ---
export async function loadRep(): Promise<RepAssignment[]> {
  try { const raw = await AsyncStorage.getItem(KEY); if (!raw) return []; const d = JSON.parse(raw); return Array.isArray(d) ? d : []; }
  catch { return []; }
}
export async function saveRep(list: RepAssignment[]): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(Array.isArray(list) ? list : [])); } catch { /* no-op */ }
}

// --- Operazioni pure (ritornano nuove liste) ---
export function assignRep(list: RepAssignment[], a: Omit<RepAssignment, 'id'>): RepAssignment[] {
  const exists = list.some((x) => x.infId === a.infId && x.day === a.day && x.month === a.month && x.year === a.year);
  if (exists) return list;
  return [...list, { ...a, id: `rep_${a.year}_${a.month}_${a.day}_${a.infId}` }];
}
export function removeRep(list: RepAssignment[], id: string): RepAssignment[] { return list.filter((x) => x.id !== id); }
export function setRichiamo(list: RepAssignment[], id: string, richiamato: boolean, richiamoTurno?: any): RepAssignment[] {
  return list.map((x) => (x.id === id ? { ...x, richiamato, richiamoTurno } : x));
}

// --- Statistiche per operatore ---
export interface RepStat { infId: string; nome: string; reperibilita: number; richiami: number; }
export function repStats(list: RepAssignment[], staff: Staff[], month?: number, year?: number): RepStat[] {
  const inScope = (x: RepAssignment) => (month == null || x.month === month) && (year == null || x.year === year);
  return (staff || []).map((s) => {
    const mine = list.filter((x) => x.infId === s.id && inScope(x));
    return { infId: s.id, nome: s.nome, reperibilita: mine.length, richiami: mine.filter((x) => x.richiamato).length };
  });
}

// --- Controlli normativi (overlay) ---
export interface RepConflict { infId: string; nome: string; day: number; regola: 'repConsecutive' | 'richiamoDopoTurno' | 'repSuTurno'; dettaglio: string; }
export function repConflicts(list: RepAssignment[], ctx: EngineContext, piano: Piano, maxConsecutive = 7): RepConflict[] {
  const out: RepConflict[] = [];
  const nomeOf = (id: string) => (ctx.staff.find((s) => s.id === id)?.nome) || id;
  const byOp: Record<string, RepAssignment[]> = {};
  for (const a of list) { if (a.month !== ctx.month || a.year !== ctx.year) continue; (byOp[a.infId] = byOp[a.infId] || []).push(a); }

  for (const infId of Object.keys(byOp)) {
    const days = byOp[infId].map((x) => x.day).sort((a, b) => a - b);
    // reperibilità consecutive oltre il limite
    let run = 1;
    for (let i = 1; i < days.length; i++) {
      if (days[i] === days[i - 1] + 1) { run++; if (run > maxConsecutive) out.push({ infId, nome: nomeOf(infId), day: days[i], regola: 'repConsecutive', dettaglio: `${run} reperibilità consecutive (max ${maxConsecutive})` }); }
      else run = 1;
    }
    // reperibilità nello stesso giorno di un turno di lavoro
    const p = piano[infId];
    if (p) for (const a of byOp[infId]) { const c = p[a.day]; if (c && isWork(c.turno)) out.push({ infId, nome: nomeOf(infId), day: a.day, regola: 'repSuTurno', dettaglio: `Reperibilità il giorno ${a.day} ma è già in turno (${c.turno})` }); }
    // richiamo: se richiamato, il giorno dopo dovrebbe avere riposo adeguato (segnalazione se lavora la mattina dopo una notte di richiamo)
    if (p) for (const a of byOp[infId]) { if (a.richiamato && a.richiamoTurno === 'N') { const next = p[a.day + 1]; if (next && next.turno === 'M') out.push({ infId, nome: nomeOf(infId), day: a.day, regola: 'richiamoDopoTurno', dettaglio: `Richiamo notturno il ${a.day} seguito da mattina il ${a.day + 1} (verificare riposo)` }); } }
  }
  return out;
}
