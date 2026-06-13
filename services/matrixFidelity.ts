// services/matrixFidelity.ts — KPI Matrix Fidelity (FASE 4). LAYER PURO: misura, NON modifica il motore.
// Fedeltà = % di giorni in cui il PATTERN DI LAVORO generato coincide con la proiezione della
// matrice (seq[(absDayIndex + offset) % L]) per gli operatori con matrice.
// Equivalenze contrattuali: S (smonto) ≡ R (riposo) — entrambi non-lavoro: lo smonto dopo la
// notte è una trasformazione strutturale del motore, non una deroga. Le assenze (F) sono
// interruzioni legittime: escluse dal conteggio (non sono deviazioni dal pattern).
import { EngineContext, Piano, Staff } from '../types';
import { absDayIndex, daysInMonth, getMx, seasonalMatrice } from '../utils/helpers';

export interface MatrixFidelity {
  score: number;                       // 0-100
  banda: 'piena' | 'minima' | 'moderata' | 'molte-deroghe' | 'alterato';
  perOperatore: { id: string; nome: string; score: number; deviazioni: number; giorniValutati: number }[];
  giorniValutati: number;
  deviazioni: number;
}

const banda = (s: number): MatrixFidelity['banda'] =>
  s >= 100 ? 'piena' : s >= 90 ? 'minima' : s >= 75 ? 'moderata' : s >= 50 ? 'molte-deroghe' : 'alterato';

export function matrixFidelity(ctx: EngineContext, piano: Piano): MatrixFidelity {
  // Fedeltà vs PROIEZIONE DELLA MATRICE (la rotazione "stampata" che il coordinatore riconosce),
  // ancorata al calendario assoluto come fa il motore: seq[(absDayIndex + offset) % L].
  // Stagionali: matrice del giorno via seasonalMatrice. F escluse (interruzioni legittime).
  const dim = daysInMonth(ctx.year, ctx.month);
  const perOperatore: MatrixFidelity['perOperatore'] = [];
  let totV = 0, totD = 0;
  for (const inf of (ctx.staff || []) as Staff[]) {
    const pp = (piano && piano[inf.id]) || {};
    const seasonal = (inf as any).seasonal || null;
    const fixedMx = inf.matrice && inf.matrice !== 'STAGIONALE' ? getMx(inf.matrice) : null;
    if (!fixedMx && !seasonal) continue;                         // senza matrice: fuori metrica
    let val = 0, dev = 0;
    for (let d = 1; d <= dim; d++) {
      const c = (pp as any)[d];
      if (!c || c.turno === 'F') continue;
      let mx = fixedMx;
      if (!mx && seasonal) { const mid = seasonalMatrice(seasonal, ctx.month, d); mx = mid ? getMx(mid) : null; }
      if (!mx || !mx.seq || !mx.seq.length) continue;
      const L = mx.seq.length;
      const pos = (((absDayIndex(ctx.year, ctx.month, d) + (inf.offset || 0)) % L) + L) % L;
      val++;
      const exp = mx.seq[pos]; const got = c.turno;
      const nonWork = (t: string) => t === 'R' || t === 'S';
      const match = got === exp || (nonWork(exp) && nonWork(got));
      if (!match) dev++;
    }
    const sc = val ? Math.round(((val - dev) / val) * 100) : 100;
    perOperatore.push({ id: inf.id, nome: inf.nome, score: sc, deviazioni: dev, giorniValutati: val });
    totV += val; totD += dev;
  }
  const score = totV ? Math.round(((totV - totD) / totV) * 100) : 100;
  return { score, banda: banda(score), perOperatore, giorniValutati: totV, deviazioni: totD };
}
