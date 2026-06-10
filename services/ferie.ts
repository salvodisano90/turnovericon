// services/ferie.ts — Ferie residue (FUNZIONE PURA). Monte annuo, maturate (pro-rata), usate, residue.
import { EngineContext, Ferie, Staff } from '../types';

export const FERIE_ANNUE_DEFAULT = 28; // giorni/anno se l'operatore non ha un monte personalizzato

export interface FerieBalanceRow {
  infId: string; nome: string;
  spettanti: number;  // monte annuo
  maturate: number;   // pro-rata al mese corrente
  usate: number;      // ferie godute nell'anno
  residue: number;    // spettanti - usate
}

function isFerie(f: Ferie): boolean {
  if (f.tipo) return f.tipo === 'ferie';
  return !f.motivo || /feri/i.test(f.motivo); // modello unificato: motivo libero
}

export function ferieBalance(staff: Staff[], ferie: Ferie[], year: number, today: Date = new Date()): FerieBalanceRow[] {
  const monthsElapsed = today.getFullYear() > year ? 12 : today.getFullYear() < year ? 0 : today.getMonth() + 1;
  const frac = monthsElapsed / 12;
  return (staff || []).map((s) => {
    const spettanti = s.ferieAnnue && s.ferieAnnue > 0 ? s.ferieAnnue : FERIE_ANNUE_DEFAULT;
    const maturate = Math.round(spettanti * frac);
    const usate = (ferie || []).filter((f) => f.infId === s.id && f.year === year && isFerie(f)).reduce((a, f) => a + (Math.max(f.from, 1) <= f.to ? f.to - f.from + 1 : 1), 0);
    return { infId: s.id, nome: s.nome, spettanti, maturate, usate, residue: spettanti - usate };
  });
}

export function ferieBalanceFor(ctx: EngineContext, year: number, today?: Date): FerieBalanceRow[] {
  return ferieBalance(ctx.staff, ctx.ferie, year, today);
}
