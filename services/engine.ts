// services/engine.ts — AI scheduling engine (pure, framework-agnostic)

import {
  BuildStats, Cell, Coverage, DerogaCode, DerogaItem, EngineContext,
  OrariSet, Piano, Reparto, Staff, Turno, TurnoLavoro, UncoveredSlot,
  Preferenze, Desiderata, Deroga, GenerationMode, Matrice, Competenza, SkillLevel,
} from '../types';
import { ROTATION_TEMPLATES, STD_ORARI, MATRICI } from '../utils/constants';
import {
  cloneDeep, daysInMonth, emptyCell, getCtr, getMx, getRep,
  isWork, restMinutes, secCode, absDayIndex, shiftHours, isWeekend, isHoliday, easter,
} from '../utils/helpers';

function ensurePiano(piano: Piano, infId: string) {
  if (!piano[infId]) piano[infId] = {};
  return piano[infId];
}

/**
 * Bordo del mese precedente: ultimo turno EFFETTIVO (lavorato) di ogni operatore,
 * con gli orari reali del reparto in cui era assegnato. Tiene conto di assenze e
 * modifiche manuali (una cella 'F'/'R' nell'ultimo giorno non vincola il giorno 1).
 * Serve a garantire il riposo 11h nel passaggio tra mesi consecutivi.
 */
export type PrevEdge = Record<string, { turno: TurnoLavoro; orari: OrariSet; runWork?: number }>;

export function edgeFromPiano(
  reparti: Reparto[], prevPiano: Piano | null | undefined, prevYear: number, prevMonth: number,
): PrevEdge {
  const edge: PrevEdge = {};
  if (!prevPiano) return edge;
  const dim = daysInMonth(prevYear, prevMonth);
  for (const infId of Object.keys(prevPiano)) {
    const dm = prevPiano[infId];
    const c = dm ? dm[dim] : null;
    if (c && isWork(c.turno)) {
      const orari = c.repartoId ? (getRep(reparti, c.repartoId)?.orari || STD_ORARI) : STD_ORARI;
      let runWork = 0; for (let d = dim; d >= 1 && dm[d] && isWork(dm[d].turno); d--) runWork++;
      edge[infId] = { turno: c.turno as TurnoLavoro, orari, runWork };
    }
  }
  return edge;
}

/**
 * Bordo iniziale del mese SUCCESSIVO: giorno 1 di ogni operatore, incluso SOLO se è
 * un turno lavorato e BLOCCATO (modifica manuale / immovibile). Le celle non bloccate
 * del giorno 1 cedono già da sole al mese precedente via prevEdge, quindi non vincolano
 * all'indietro. Serve a far cedere l'ultimo giorno del mese in costruzione quando il
 * giorno 1 del mese dopo è fissato dall'utente.
 */
export function nextEdgeFromPiano(
  reparti: Reparto[], nextPiano: Piano | null | undefined, _nextYear: number, _nextMonth: number,
): PrevEdge {
  const edge: PrevEdge = {};
  if (!nextPiano) return edge;
  for (const infId of Object.keys(nextPiano)) {
    const dm = nextPiano[infId];
    const c = dm ? dm[1] : null;
    if (c && c.locked && isWork(c.turno)) {
      const orari = c.repartoId ? (getRep(reparti, c.repartoId)?.orari || STD_ORARI) : STD_ORARI;
      edge[infId] = { turno: c.turno as TurnoLavoro, orari };
    }
  }
  return edge;
}

export function getCell(piano: Piano, infId: string, day: number): Cell | null {
  const p = piano[infId];
  return p && p[day] ? p[day] : null;
}

export function countWork(piano: Piano, infId: string, dim: number): number {
  const p = piano[infId];
  if (!p) return 0;
  let n = 0;
  for (let d = 1; d <= dim; d++) if (p[d] && isWork(p[d].turno)) n++;
  return n;
}

export function countTurno(piano: Piano, infId: string, t: Turno, dim: number): number {
  const p = piano[infId];
  if (!p) return 0;
  let n = 0;
  for (let d = 1; d <= dim; d++) if (p[d] && p[d].turno === t) n++;
  return n;
}

export function monteTurni(inf: Staff): number {
  return Math.round(getCtr(inf.contratto).oreMese / 8);
}

function consecIfWork(piano: Piano, infId: string, day: number): number {
  const p = piano[infId];
  if (!p) return 1;
  let n = 1;
  for (let d = day - 1; d >= 1; d--) { if (p[d] && isWork(p[d].turno)) n++; else break; }
  for (let d = day + 1; d <= 400; d++) { if (p[d] && isWork(p[d].turno)) n++; else break; }
  return n;
}

function restOkBothSides(
  ctx: EngineContext, piano: Piano, infId: string, day: number, turn: Turno, orari: typeof STD_ORARI, prevEdge: PrevEdge = {}, nextEdge: PrevEdge = {},
): boolean {
  const p = piano[infId];
  const dim = daysInMonth(ctx.year, ctx.month);
  if (day > 1) {
    const prev = p[day - 1];
    if (prev && isWork(prev.turno)) {
      const po = prev.repartoId ? (getRep(ctx.reparti, prev.repartoId)?.orari || STD_ORARI) : STD_ORARI;
      if (restMinutes(prev.turno, turn, po, orari) < 660) return false;
    }
  } else {
    // confine col mese precedente: l'ultimo turno effettivo fa da "giorno 0"
    const e = prevEdge[infId];
    if (e && restMinutes(e.turno, turn, e.orari, orari) < 660) return false;
  }
  if (day < dim) {
    const next = p[day + 1];
    if (next && isWork(next.turno)) {
      const no = next.repartoId ? (getRep(ctx.reparti, next.repartoId)?.orari || STD_ORARI) : STD_ORARI;
      if (restMinutes(turn, next.turno, orari, no) < 660) return false;
    }
  } else {
    // confine col mese successivo: giorno 1 bloccato del mese dopo fa da "giorno dim+1"
    const ne = nextEdge[infId];
    if (ne && restMinutes(turn, ne.turno, orari, ne.orari) < 660) return false;
  }
  return true;
}

export interface CandidateEval {
  ok: boolean;
  deroghe: DerogaCode[];
}

export function evalCandidate(
  ctx: EngineContext, piano: Piano, inf: Staff, day: number, t: TurnoLavoro, rep: Reparto, code: string, prevEdge: PrevEdge = {}, nextEdge: PrevEdge = {},
): CandidateEval | null {
  if (inf.reparti.indexOf(rep.id) < 0) return null;
  if ((rep.settori[t] || 0) <= 0) return null;
  if (inf.esenzioniSettori.indexOf(code) >= 0) return null;
  const rex = roleExemptions(inf);
  const pr = prefsOf(inf);
  if (pr.soloMattina && t !== 'M') return null;                                 // preferenza FORTE: solo mattina
  if (pr.soloPomeriggio && t !== 'P') return null;                              // preferenza FORTE: solo pomeriggio
  if (t === 'N' && (rex.noNight || inf.nottiPerCiclo === 0)) return null;        // esente notti (skill/ruolo): mai derogabile
  if (inf.esenzioniTurni.indexOf(t) >= 0) return null;
  if (!restOkBothSides(ctx, piano, inf.id, day, t, rep.orari, prevEdge, nextEdge)) return null; // 11h: MAI derogabile
  const dim = daysInMonth(ctx.year, ctx.month);
  // C5: massimo 6 giorni consecutivi = vincolo DURO (in entrambe le modalità)
  if (consecRunIfWork(piano[inf.id], day, dim, prevEdge[inf.id]?.runWork || 0) > maxConsec(inf)) return null;
  const mode = modeOf(ctx);
  const coord = isCoordinator(inf);
  const we = isWeekend(ctx.year, ctx.month, day);
  const fe = isHoliday(ctx.year, ctx.month, day);
  if (coord && (we || fe)) return null;                                         // coordinatore (ruolo): mai weekend/festivi
  const der: DerogaCode[] = [];
  // esenzioni weekend/festivi NON di ruolo: dure in RIGIDA, derogabili e tracciate in OPERATIVA
  if (!coord && rex.noWeekend && we) { if (mode === 'rigida') return null; der.push('weekend'); }
  if (!coord && rex.noFestivi && fe) { if (mode === 'rigida') return null; der.push('festivo'); }
  // C1: tetto notti ∝ contratto — duro in RIGIDA, derogabile e tracciato in OPERATIVA
  if (t === 'N' && countTurno(piano, inf.id, 'N', dim) + 1 > nightQuota(inf)) { if (mode === 'rigida') return null; der.push('notti'); }
  if (countWork(piano, inf.id, dim) + 1 > monteTurni(inf)) der.push('ore');
  return { ok: true, deroghe: der };
}

function ferieForMonth(ctx: EngineContext) {
  return ctx.ferie.filter((f) => f.month === ctx.month && f.year === ctx.year && ctx.staff.some((m) => m.id === f.infId));
}

function coverageQuick(ctx: EngineContext, occupied: Record<number, Record<string, string>>, dim: number) {
  let covered = 0;
  let total = 0;
  for (const r of ctx.reparti) {
    (['M', 'P', 'N'] as TurnoLavoro[]).forEach((t) => {
      const ns = r.settori[t] || 0;
      for (let sn = 1; sn <= ns; sn++) {
        const code = secCode(t, r.sigla, sn);
        for (let d = 1; d <= dim; d++) {
          total++;
          if (occupied[d] && occupied[d][code]) covered++;
        }
      }
    });
  }
  return { covered, total };
}

/**
 * Main generator: builds the cyclic-matrix base then AI-maximizes coverage.
 * Returns a NEW piano (does not mutate `prev`).
 */
// ── STEP 0 — TEMPLATE DI ROTAZIONE ────────────────────────────────────────────
// Id dei template "nuovi" (compatti). Le matrici legacy NON sono template e vengono
// migrate automaticamente a un template coerente col profilo (vedi autoTemplateIds).
// Catalogo effettivo: built-in (MATRICI) + personalizzate passate via ctx.matrici.
function catalogOf(ctx?: EngineContext): Matrice[] {
  return (ctx && ctx.matrici && ctx.matrici.length) ? ctx.matrici : MATRICI;
}
function mxOf(id: string, ctx?: EngineContext): Matrice | undefined {
  return catalogOf(ctx).find((m) => m.id === id) || MATRICI.find((m) => m.id === id);
}
function seqOf(id: string, ctx?: EngineContext): Turno[] | null {
  const m = mxOf(id, ctx);
  return m && m.seq && m.seq.length ? m.seq.slice() : null;
}
function templateSeq(id: string): Turno[] | null { return seqOf(id); }
// hash stabile (qualifica+id) per variare il template-giorno tra operatori simili
function profileIdx(inf: Staff, idx: number): number {
  let h = idx;
  const s = (inf.qualifica || '') + '|' + (inf.id || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
// Assegnazione AUTOMATICA recovery-safe (blocco giorno + blocco notte con smonto+riposi).
// Usata SOLO come ultima istanza, quando nessun livello della gerarchia ha una matrice.
function autoTemplateIds(inf: Staff, idx: number): string[] {
  const pr = prefsOf(inf);
  if (pr.soloMattina) return ['TM'];
  if (pr.soloPomeriggio) return ['TP'];
  const noNight = roleExemptions(inf).noNight;
  const pt = /^PT|^TDPT/.test(inf.contratto || '');
  const dayPool = ROTATION_TEMPLATES.day;
  const dayId = dayPool[profileIdx(inf, idx) % dayPool.length] || 'TA';
  if (noNight || (inf.nottiPerCiclo || 0) === 0) return [dayId];
  const nightId = (!pt && (inf.nottiPerCiclo || 1) >= 2) ? ROTATION_TEMPLATES.night2 : ROTATION_TEMPLATES.night1;
  return [dayId, nightId];
}
function autoTemplateCycle(inf: Staff, idx: number): { id: string; seq: Turno[] } {
  const ids = autoTemplateIds(inf, idx);
  const seq: Turno[] = [];
  for (const id of ids) { const s = templateSeq(id); if (s) for (const x of s) seq.push(x); }
  return { id: ids.join('+'), seq: seq.length ? seq : ['M', 'M', 'P', 'P', 'R'] };
}

export type MatriceOrigine = 'operatore' | 'reparto' | 'mese' | 'auto';
// SORGENTE DI VERITÀ con GERARCHIA OBBLIGATORIA: operatore → reparto → mese → (auto).
// La matrice assegnata è la regola; l'auto è solo l'ultima istanza per non bloccare la generazione.
export function resolveMatrice(inf: Staff, ctx: EngineContext, idx = 0): { id: string; seq: Turno[]; origine: MatriceOrigine } {
  // PREFERENZE FORTI (vincolo): solo mattina / solo pomeriggio prevalgono su qualsiasi matrice.
  const pr = prefsOf(inf);
  if (pr.soloMattina) return { id: 'TM', seq: seqOf('TM', ctx) || ['M', 'M', 'M', 'M', 'R'], origine: 'operatore' };
  if (pr.soloPomeriggio) return { id: 'TP', seq: seqOf('TP', ctx) || ['P', 'P', 'P', 'P', 'R'], origine: 'operatore' };
  // 1. OPERATORE — combo esplicito o matrice personale
  if (inf.templateCombo && inf.templateCombo.length) {
    const seq: Turno[] = [];
    for (const id of inf.templateCombo) { const s = templateSeq(id); if (s) for (const x of s) seq.push(x); }
    if (seq.length) return { id: inf.templateCombo.join('+'), seq, origine: 'operatore' };
  }
  if (inf.matrice) { const s = seqOf(inf.matrice, ctx); if (s && s.length) return { id: inf.matrice, seq: s, origine: 'operatore' }; }
  // 2. REPARTO — prima matrice di reparto disponibile fra i reparti dell'operatore
  for (const rid of inf.reparti || []) {
    const r = ctx.reparti.find((x) => x.id === rid);
    if (r && r.matrice) { const s = seqOf(r.matrice, ctx); if (s && s.length) return { id: r.matrice, seq: s, origine: 'reparto' }; }
  }
  // 3. MESE — matrice mensile
  if (ctx.matriceMese) { const s = seqOf(ctx.matriceMese, ctx); if (s && s.length) return { id: ctx.matriceMese, seq: s, origine: 'mese' }; }
  // 4. AUTO — ultima istanza recovery-safe
  const auto = autoTemplateCycle(inf, idx);
  return { id: auto.id, seq: auto.seq, origine: 'auto' };
}
function operatorCycle(inf: Staff, ctx: EngineContext, idx: number): Turno[] { return resolveMatrice(inf, ctx, idx).seq; }

// MIGRAZIONE: NON forza più una matrice operatore (così la gerarchia reparto/mese può agire).
// Lascia invariati gli operatori; assegna un combo recovery-safe solo a chi è privo di QUALSIASI
// indicazione (né combo, né matrice operatore valida) per non bloccare la generazione legacy.
export function migrateTemplates(staff: Staff[]): Staff[] {
  return staff.map((inf, i) => {
    if (inf.templateCombo && inf.templateCombo.length) return inf;
    if (inf.matrice && seqOf(inf.matrice)) return inf;
    return { ...inf, templateCombo: autoTemplateIds(inf, i) };
  });
}

// ── VALIDAZIONE / AUDIT MATRICE: aderenza alla matrice contrattuale ───────────
const DEROGA_IT: Record<string, string> = {
  ore: 'monte ore', notti: 'quota notti', consec: 'giorni consecutivi', weekend: 'weekend',
  festivo: 'festivo', preferenza: 'preferenza', desiderata: 'desiderata',
};
export interface MatrixOpReport {
  infId: string; nome: string; matrice: string; matriceLabel: string; origine: MatriceOrigine;
  position: number; cycleLen: number; giorni: number; matrice_ok: number;
  modificati: number; assenze: number; aderenzaPct: number; deroghe: number; motivi: string[];
}
export function matrixReport(ctx: EngineContext, piano: Piano): {
  perOp: MatrixOpReport[]; byMatrice: Record<string, number>; byOrigine: Record<string, number>;
  giorniTotali: number; giorniModificati: number; giorniAssenza: number; aderenzaPct: number;
} {
  const dim = daysInMonth(ctx.year, ctx.month);
  const perOp: MatrixOpReport[] = [];
  const byMatrice: Record<string, number> = {};
  const byOrigine: Record<string, number> = {};
  let okTot = 0, modTot = 0, absTot = 0;
  for (const inf of ctx.staff) {
    const p = piano[inf.id]; if (!p) continue;
    const { id, seq, origine } = resolveMatrice(inf, ctx);
    const L = seq.length || 7;
    byMatrice[id] = (byMatrice[id] || 0) + 1;
    byOrigine[origine] = (byOrigine[origine] || 0) + 1;
    const pos0 = (((absDayIndex(ctx.year, ctx.month, 1) + (inf.offset || 0)) % L) + L) % L;
    let ok = 0, mod = 0, abs = 0, der = 0;
    const motivi = new Set<string>();
    for (let d = 1; d <= dim; d++) {
      const c = p[d]; if (!c) continue;
      const pos = (((absDayIndex(ctx.year, ctx.month, d) + (inf.offset || 0)) % L) + L) % L;
      const expected = seq[pos];
      if (c.deroghe && c.deroghe.length) { der += c.deroghe.length; c.deroghe.forEach((x) => motivi.add(DEROGA_IT[x] || x)); }
      if (c.turno === 'F') abs++;                      // assenza: eccezione legittima (esclusa)
      else if (c.turno === expected) ok++;
      else mod++;
    }
    okTot += ok; modTot += mod; absTot += abs;
    const denom = ok + mod;
    const m = mxOf(id, ctx);
    perOp.push({
      infId: inf.id, nome: inf.nome, matrice: id, matriceLabel: (m && m.label) || id, origine,
      position: pos0, cycleLen: (m && m.durata) || L, giorni: dim, matrice_ok: ok, modificati: mod, assenze: abs,
      aderenzaPct: denom ? Math.round((100 * ok) / denom) : 100, deroghe: der, motivi: Array.from(motivi),
    });
  }
  const denomTot = okTot + modTot;
  return { perOp, byMatrice, byOrigine, giorniTotali: okTot + modTot + absTot, giorniModificati: modTot, giorniAssenza: absTot, aderenzaPct: denomTot ? Math.round((100 * okTot) / denomTot) : 100 };
}

// ── C2 — RUOLI / ESENZIONI (applicate per qualifica) ──────────────────────────
function isCoordinator(inf: Staff): boolean { return /coordinat/i.test(inf.qualifica || ''); }
function roleExemptions(inf: Staff): { noNight: boolean; noWeekend: boolean; noFestivi: boolean } {
  if (isCoordinator(inf)) return { noNight: true, noWeekend: true, noFestivi: true }; // coordinatore: solo giornata feriale
  return {
    noNight: !!inf.esenzioniTurni && inf.esenzioniTurni.indexOf('N' as TurnoLavoro) >= 0,
    noWeekend: !!inf.esenteWeekend,
    noFestivi: !!inf.esenteFestivi,
  };
}
function mustRestDay(inf: Staff, y: number, m: number, d: number): boolean {
  const r = roleExemptions(inf);
  return (r.noWeekend && isWeekend(y, m, d)) || (r.noFestivi && isHoliday(y, m, d));
}
// ── C1 — NOTTI / FTE: la quota mensile teorica è il tetto notti del contratto (∝ FTE) ──
function nightQuota(inf: Staff): number { return getCtr(inf.contratto).nottiMax; }
// ── C5 — GIORNI CONSECUTIVI: tetto duro per operatore (max 6) ──────────────────
function maxConsec(inf: Staff): number { return Math.min(getCtr(inf.contratto).giorniCons, 6); }
function consecRunIfWork(p: Record<number, Cell>, day: number, dim: number, edgeRun: number): number {
  let left = 0; for (let k = day - 1; k >= 1 && p[k] && isWork(p[k].turno); k--) left++;
  if (day - left === 1) left += edgeRun; // il blocco arriva al giorno 1 → somma il run di fine mese precedente
  let right = 0; for (let k = day + 1; k <= dim && p[k] && isWork(p[k].turno); k++) right++;
  return left + 1 + right;
}
// ── C3 — FESTIVI MAGGIORI (chiave stabile per memoria/alternanza) ─────────────
export function majorHolidayKey(y: number, m: number, d: number): string | null {
  if (m === 11 && d === 25) return 'natale';
  if (m === 0 && d === 1) return 'capodanno';
  if (m === 7 && d === 15) return 'ferragosto';
  const e = easter(y);
  if (m === e.m && d === e.d) return 'pasqua';
  const mon = new Date(y, e.m, e.d + 1);
  if (m === mon.getMonth() && d === mon.getDate()) return 'pasquetta';
  return null;
}

// ── PREFERENZE & DESIDERATA & MODALITÀ ───────────────────────────────────────
function prefsOf(inf: Staff): Preferenze { return inf.preferenze || {}; }
function modeOf(ctx: EngineContext): GenerationMode { return ctx.mode === 'rigida' ? 'rigida' : 'operativa'; }
function isoDay(y: number, m: number, d: number): string {
  return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
function desForDay(ctx: EngineContext, infId: string, y: number, m: number, d: number): Desiderata[] {
  if (!ctx.desiderata || !ctx.desiderata.length) return [];
  const iso = isoDay(y, m, d);
  return ctx.desiderata.filter((x) => x.infId === infId && x.dateStart <= iso && (x.dateEnd || x.dateStart) >= iso);
}
const PRIO_W: Record<string, number> = { bassa: 4, media: 9, alta: 18 };

// RECUPERO POST-NOTTE INVIOLABILE: marca come protetti (riposoForzato) lo smonto e i
// riposi di recupero che seguono ogni blocco di notti (1 notte → S+1R, 2 notti → S+2R).
// La copertura (STEP 5) non potrà usarli. Vincolo forte, non preferenza.
function protectFrom(p: Record<number, Cell>, start: number, nights: number, dim: number) {
  const need = 1 + nights; // smonto + N riposi
  let done = 0;
  for (let day = start; day <= dim && done < need; day++) {
    const c = p[day];
    if (!c || c.locked) break;
    if (c.turno === 'S' || c.turno === 'R') { p[day] = { ...c, riposoForzato: true }; done++; }
    else break; // incontrato lavoro/assenza → fine recupero
  }
}
function protectRecovery(ctx: EngineContext, piano: Piano, prevEdge: PrevEdge = {}) {
  const dim = daysInMonth(ctx.year, ctx.month);
  for (const inf of ctx.staff) {
    const p = piano[inf.id]; if (!p) continue;
    if (prevEdge[inf.id]?.turno === 'N') protectFrom(p, 1, 1, dim); // recupero di una notte del mese precedente
    let d = 1;
    while (d <= dim) {
      if (p[d] && p[d].turno === 'N') {
        let nb = 0; let k = d;
        while (k <= dim && p[k] && p[k].turno === 'N') { nb++; k++; }
        protectFrom(p, k, nb, dim); // smonto + nb riposi dopo il blocco
        d = k;
      } else d++;
    }
  }
}

// VINCOLO FORTE di recupero: ogni notte (ultima del blocco) dev'essere seguita da
// smonto + (numero notti del blocco) riposi, tutti non lavorativi. Restituisce false
// se la finestra di recupero (entro il mese) contiene lavoro.
function rowRecoveryOk(p: Record<number, Cell>, dim: number, overrideDay = 0, overrideCell: { turno: Turno } | null = null): boolean {
  const at = (d: number): { turno: Turno } | null | undefined => (d === overrideDay ? overrideCell : p[d]);
  for (let d = 1; d <= dim; d++) {
    const c = at(d);
    if (!c || c.turno !== 'N') continue;
    const nx = d < dim ? at(d + 1) : null;
    if (nx && nx.turno === 'N') continue;          // non è l'ultima notte del blocco
    let nb = 0; for (let k = d; k >= 1; k--) { const ck = at(k); if (ck && ck.turno === 'N') nb++; else break; }
    const need = 1 + nb;                            // smonto + nb riposi
    for (let j = 1; j <= need; j++) {
      const day = d + j; if (day > dim) break;      // recupero oltre il mese → gestito da 11h/cross-mese
      const tj = at(day) ? at(day)!.turno : null;
      if (tj === 'M' || tj === 'P' || tj === 'N') return false;
    }
  }
  return true;
}

// true se mettere una notte sul giorno d creerebbe un blocco di 3+ notti consecutive
function wouldExceed2Nights(p: Record<number, Cell>, d: number, dim: number): boolean {
  let left = 0; for (let k = d - 1; k >= 1 && p[k] && p[k].turno === 'N'; k--) left++;
  let right = 0; for (let k = d + 1; k <= dim && p[k] && p[k].turno === 'N'; k++) right++;
  return (1 + left + right) > 2;
}

// C5 — ENFORCEMENT DURO dei giorni consecutivi: nessun blocco supera maxConsec (≤6).
// Converte in RIPOSO il giorno lavorato che sfora (anche a cavallo di mese via prevEdge).
// Solo lavoro→riposo (sempre sicuro per 11h e recupero); le notti eventualmente tagliate
// vengono normalizzate da deriveSmonti.
function enforceMaxConsec(ctx: EngineContext, piano: Piano, prevEdge: PrevEdge = {}) {
  const dim = daysInMonth(ctx.year, ctx.month);
  for (const inf of ctx.staff) {
    const p = piano[inf.id]; if (!p) continue;
    const cap = maxConsec(inf);
    let run = prevEdge[inf.id]?.runWork || 0;
    for (let d = 1; d <= dim; d++) {
      const c = p[d];
      if (c && isWork(c.turno)) {
        run++;
        if (run > cap && !c.locked) {
          p[d] = { turno: 'R', repartoId: null, settore: null, locked: false, autoFilled: false, riposoForzato: false, deroghe: [] };
          run = 0;
        }
      } else { run = 0; }
    }
  }
}

// Registro deroghe controllate: una voce per ogni regola derogata su ogni cella.
const DEROGA_MOTIVO: Record<DerogaCode, string> = {
  ore: 'Superamento monte ore (straordinario)',
  notti: 'Superamento quota notti mensile',
  consec: 'Giorni consecutivi oltre il limite',
  weekend: 'Assegnazione weekend extra (operatore esente)',
  festivo: 'Assegnazione festivo extra (operatore esente)',
  preferenza: 'Preferenza non rispettata',
  desiderata: 'Desiderata non rispettato',
};
function buildDerogheList(ctx: EngineContext, piano: Piano): Deroga[] {
  const out: Deroga[] = [];
  const dim = daysInMonth(ctx.year, ctx.month);
  for (const inf of ctx.staff) {
    const p = piano[inf.id]; if (!p) continue;
    for (let d = 1; d <= dim; d++) {
      const c = p[d];
      if (c && c.deroghe && c.deroghe.length) {
        for (const code of c.deroghe) out.push({ infId: inf.id, day: d, repartoId: c.repartoId, motivo: DEROGA_MOTIVO[code] || code, regola: code });
      }
    }
  }
  return out;
}
// % preferenze deboli soddisfatte e % desiderata soddisfatti.
export function prefSatisfaction(ctx: EngineContext, piano: Piano): { prefPct: number; desPct: number; prefTot: number; desTot: number } {
  const dim = daysInMonth(ctx.year, ctx.month);
  let pOk = 0, pTot = 0, dOk = 0, dTot = 0;
  for (const inf of ctx.staff) {
    const p = piano[inf.id]; if (!p) continue;
    const pr = prefsOf(inf);
    for (let d = 1; d <= dim; d++) {
      const c = p[d]; const t = c ? c.turno : 'R'; const working = !!c && isWork(t);
      const we = isWeekend(ctx.year, ctx.month, d);
      if (pr.prefMattina && working) { pTot++; if (t === 'M') pOk++; }
      if (pr.prefPomeriggio && working) { pTot++; if (t === 'P') pOk++; }
      if (pr.prefWeekendLibero && we) { pTot++; if (!working) pOk++; }
      if (pr.prefSettore && working && c && c.settore) { pTot++; if (c.settore === pr.prefSettore) pOk++; }
      if (pr.prefReparto && working && c && c.repartoId) { pTot++; if (c.repartoId === pr.prefReparto) pOk++; }
      if (ctx.desiderata && ctx.desiderata.length) {
        const ds = desForDay(ctx, inf.id, ctx.year, ctx.month, d);
        for (const x of ds) {
          dTot++;
          const ok = x.tipo === 'riposo' ? !working
            : x.tipo === 'lavoro' ? working
            : x.tipo === 'mattina' ? (working && t === 'M')
            : x.tipo === 'pomeriggio' ? (working && t === 'P')
            : x.tipo === 'evitaNotte' ? (t !== 'N') : true;
          if (ok) dOk++;
        }
      }
    }
  }
  return { prefPct: pTot ? Math.round((100 * pOk) / pTot) : 100, desPct: dTot ? Math.round((100 * dOk) / dTot) : 100, prefTot: pTot, desTot: dTot };
}

export function buildPiano(ctx: EngineContext, prev: Piano, keepLocked: boolean, prevEdge: PrevEdge = {}, nextEdge: PrevEdge = {}, optimize = false): { piano: Piano; stats: BuildStats } {
  const dim = daysInMonth(ctx.year, ctx.month);
  const piano: Piano = keepLocked ? cloneDeep(prev) : {};
  const stats: BuildStats = { filled: 0, deroghe: 0, before: 0, after: 0 };

  // STEP 1 — base costruita dai TEMPLATE DI ROTAZIONE (STEP 0), ANCORATA AL CALENDARIO
  // ASSOLUTO → la sequenza compatta scorre senza salti tra un mese e l'altro.
  let _ti = 0;
  for (const inf of ctx.staff) {
    const p = ensurePiano(piano, inf.id);
    const seq = operatorCycle(inf, ctx, _ti++);
    const L = seq.length || 7;
    for (let d = 1; d <= dim; d++) {
      if (keepLocked && p[d] && p[d].locked) continue;
      const pos = (((absDayIndex(ctx.year, ctx.month, d) + (inf.offset || 0)) % L) + L) % L;
      let turno = seq[pos];
      if (mustRestDay(inf, ctx.year, ctx.month, d) && isWork(turno)) turno = 'R'; // C2: esenzione weekend/festivi
      if (roleExemptions(inf).noNight && (turno === 'N')) turno = 'R';            // esenzione ruolo: mai notti (vincolo assoluto)
      p[d] = { turno, repartoId: null, settore: null, locked: false, autoFilled: false, riposoForzato: false, deroghe: [] };
    }
  }

  // STEP 2 — assenze override (ferie/malattia/permesso/104/formazione/congedo/infortunio/aspettativa)
  for (const f of ferieForMonth(ctx)) {
    const p = ensurePiano(piano, f.infId);
    for (let d = f.from; d <= f.to; d++) {
      if (d >= 1 && d <= dim) {
        p[d] = { turno: 'F', repartoId: null, settore: null, locked: true, autoFilled: false, riposoForzato: false, deroghe: [], motivo: (f.motivo && f.motivo.trim()) ? f.motivo.trim() : 'Assenza' };
      }
    }
  }

  // STEP 3 — enforce 11h rest on non-locked work cells (generic STD orari).
  // Backward: vs giorno precedente (o bordo mese prec. al giorno 1).
  // Forward: SOLO verso celle BLOCCATE (immovibili) o il bordo del mese successivo
  //          (giorno 1 bloccato del mese dopo) → la cella non bloccata cede.
  for (const inf of ctx.staff) {
    const p = piano[inf.id];
    if (!p) continue;
    for (let d = 1; d <= dim; d++) {
      const cur = p[d];
      if (!cur || !isWork(cur.turno) || cur.locked) continue;
      let bad = false;
      // lato precedente
      if (d > 1) {
        const prevC = p[d - 1];
        if (prevC && isWork(prevC.turno) && restMinutes(prevC.turno, cur.turno, STD_ORARI, STD_ORARI) < 660) bad = true;
      } else {
        const e = prevEdge[inf.id];
        if (e && restMinutes(e.turno, cur.turno, e.orari, STD_ORARI) < 660) bad = true;
      }
      // lato successivo (solo verso celle bloccate o bordo mese successivo)
      if (!bad) {
        if (d < dim) {
          const nextC = p[d + 1];
          if (nextC && nextC.locked && isWork(nextC.turno) && restMinutes(cur.turno, nextC.turno, STD_ORARI, STD_ORARI) < 660) bad = true;
        } else {
          const ne = nextEdge[inf.id];
          if (ne && restMinutes(cur.turno, ne.turno, STD_ORARI, ne.orari) < 660) bad = true;
        }
      }
      if (bad) p[d] = { turno: 'R', repartoId: null, settore: null, locked: false, autoFilled: false, riposoForzato: true, deroghe: [] };
    }
  }

  // C1 — TETTO NOTTI ∝ CONTRATTO (FTE): attivo SOLO con ottimizzazione esplicita. In modalità
  // MATRICE-FIRST (default) la matrice contrattuale definisce le notti e non viene corretta:
  // gli operatori part-time ricevono semplicemente una matrice con meno notti.
  if (optimize) {
    for (const inf of ctx.staff) {
      const p = piano[inf.id]; if (!p) continue;
      const q = nightQuota(inf);
      const nightDays: number[] = [];
      for (let d = 1; d <= dim; d++) { const c = p[d]; if (c && c.turno === 'N' && !c.locked) nightDays.push(d); }
      while (nightDays.length > q) {
        const d = nightDays.pop()!;
        p[d] = { turno: 'R', repartoId: null, settore: null, locked: false, autoFilled: false, riposoForzato: false, deroghe: [] };
      }
    }
  }

  // C5 — taglio dei giorni consecutivi oltre il limite PRIMA della copertura: libera slot
  // che la copertura ridistribuirà (gate ≤6) verso altri operatori.
  enforceMaxConsec(ctx, piano, prevEdge);

  // RECUPERO POST-NOTTE INVIOLABILE: protegge smonto + riposi di recupero dalla copertura.
  protectRecovery(ctx, piano, prevEdge);

  // occupied[day][code] = infId
  const occupied: Record<number, Record<string, string>> = {};
  for (let d = 1; d <= dim; d++) occupied[d] = {};
  for (const inf of ctx.staff) {
    const p = piano[inf.id];
    if (!p) continue;
    for (let d = 1; d <= dim; d++) {
      const c = p[d];
      if (c && isWork(c.turno) && c.settore) occupied[d][c.settore] = inf.id;
    }
  }

  // STEP 4 — assign reparto+settore to matrix-working cells (equity: fewest first)
  const order = ctx.staff.slice().sort((a, b) => countWork(piano, a.id, dim) - countWork(piano, b.id, dim));
  for (let d = 1; d <= dim; d++) {
    for (const inf of order) {
      const p = piano[inf.id];
      if (!p) continue;
      const c = p[d];
      if (!c || !isWork(c.turno)) continue;
      if (c.settore) continue;
      const t = c.turno as TurnoLavoro;
      let assigned = false;
      for (let ri = 0; ri < inf.reparti.length && !assigned; ri++) {
        const rep = getRep(ctx.reparti, inf.reparti[ri]);
        if (!rep) continue;
        const ns = rep.settori[t] || 0;
        if (ns <= 0) continue;
        if (inf.esenzioniTurni.indexOf(t) >= 0) continue;
        const prevCell = d > 1 ? p[d - 1] : null;
        if (prevCell && isWork(prevCell.turno)) {
          const pOr = prevCell.repartoId ? (getRep(ctx.reparti, prevCell.repartoId)?.orari || STD_ORARI) : STD_ORARI;
          if (restMinutes(prevCell.turno, t, pOr, rep.orari) < 660) continue;
        } else if (d === 1) {
          const e = prevEdge[inf.id];
          if (e && restMinutes(e.turno, t, e.orari, rep.orari) < 660) continue;
        }
        // lato successivo: rispetta 11h verso una cella BLOCCATA (immovibile) o il bordo del mese dopo
        const nextCell = d < dim ? p[d + 1] : null;
        if (nextCell && nextCell.locked && isWork(nextCell.turno)) {
          const nOr = nextCell.repartoId ? (getRep(ctx.reparti, nextCell.repartoId)?.orari || STD_ORARI) : STD_ORARI;
          if (restMinutes(t, nextCell.turno, rep.orari, nOr) < 660) continue;
        } else if (d === dim) {
          const ne = nextEdge[inf.id];
          if (ne && restMinutes(t, ne.turno, rep.orari, ne.orari) < 660) continue;
        }
        for (let sn = 1; sn <= ns && !assigned; sn++) {
          const code = secCode(t, rep.sigla, sn);
          if (inf.esenzioniSettori.indexOf(code) >= 0) continue;
          if (occupied[d][code]) continue;
          occupied[d][code] = inf.id;
          p[d] = { turno: t, repartoId: rep.id, settore: code, locked: c.locked, autoFilled: false, riposoForzato: false, deroghe: [] };
          assigned = true;
        }
      }
      if (!assigned) {
        p[d] = { turno: 'R', repartoId: null, settore: null, locked: false, autoFilled: false, riposoForzato: false, deroghe: [] };
      }
    }
  }

  stats.before = coverageQuick(ctx, occupied, dim).covered;

  // STEP 5 — AI COVERAGE MAXIMIZATION: pull rested staff onto uncovered slots
  for (let d = 1; d <= dim; d++) {
    for (const r of ctx.reparti) {
      const turns: TurnoLavoro[] = ['M', 'P', 'N'];
      for (const tt of turns) {
        const nn = r.settori[tt] || 0;
        for (let s2 = 1; s2 <= nn; s2++) {
          const cc = secCode(tt, r.sigla, s2);
          if (occupied[d][cc]) continue;
          let best: Staff | null = null;
          let bestCost = 99;
          let bestWork = 1e9;
          let bestHol = 1e9;
          let bestMakes3 = true;
          let bestDer: DerogaCode[] = [];
          const isHol = isHoliday(ctx.year, ctx.month, d);
          const mkey = isHol ? majorHolidayKey(ctx.year, ctx.month, d) : null;
          for (const cand of ctx.staff) {
            const pc = piano[cand.id];
            if (!pc) continue;
            const cell = pc[d];
            if (!cell || cell.locked) continue;
            if (cell.turno !== 'R' || cell.riposoForzato) continue; // recupero post-notte intoccabile
            const ev = evalCandidate(ctx, piano, cand, d, tt, r, cc, prevEdge, nextEdge);
            if (!ev) continue;
            if (tt === 'N' && !rowRecoveryOk(pc, dim, d, { turno: 'N' })) continue; // recupero post-notte = vincolo forte
            const cost = ev.deroghe.length;
            const wk = countWork(piano, cand.id, dim);
            const makes3 = tt === 'N' && wouldExceed2Nights(pc, d, dim);
            // C3: sui festivi preferisci chi ne ha lavorati meno; sui festivi MAGGIORI evita chi li ha lavorati l'anno prima
            let holBias = 0;
            if (isHol) { holBias = ctx.festiviCount?.[cand.id] || 0; if (mkey && (ctx.festiviMajor?.[mkey] || []).indexOf(cand.id) >= 0) holBias += 100; }
            // desiderata: non assegnare lavoro a chi vuole riposo; preferire chi vuole lavorare
            if (ctx.desiderata && ctx.desiderata.length) {
              for (const x of desForDay(ctx, cand.id, ctx.year, ctx.month, d)) {
                const w = PRIO_W[x.priorita] || 9;
                if (x.tipo === 'riposo') holBias += w;
                else if (x.tipo === 'evitaNotte' && tt === 'N') holBias += w;
                else if (x.tipo === 'lavoro') holBias -= w;
                else if (x.tipo === 'mattina' && tt !== 'M') holBias += w * 0.5;
                else if (x.tipo === 'pomeriggio' && tt !== 'P') holBias += w * 0.5;
              }
            }
            // ordine: meno deroghe → evita 3+ notti → festivi/desiderata → chi lavora meno
            const better = cost < bestCost
              || (cost === bestCost && ((makes3 ? 1 : 0) < (bestMakes3 ? 1 : 0)))
              || (cost === bestCost && (makes3 ? 1 : 0) === (bestMakes3 ? 1 : 0) && holBias < bestHol)
              || (cost === bestCost && (makes3 ? 1 : 0) === (bestMakes3 ? 1 : 0) && holBias === bestHol && wk < bestWork);
            if (better) {
              best = cand;
              bestCost = cost;
              bestWork = wk;
              bestHol = holBias;
              bestMakes3 = makes3;
              bestDer = ev.deroghe;
            }
          }
          if (best) {
            piano[best.id][d] = { turno: tt, repartoId: r.id, settore: cc, locked: false, autoFilled: true, riposoForzato: false, deroghe: bestDer.slice() };
            occupied[d][cc] = best.id;
            stats.filled++;
            if (bestDer.length) stats.deroghe++;
            if (tt === 'N') {
              // la notte appena coperta crea un recupero che va protetto SUBITO da riempimenti successivi
              const pb = piano[best.id];
              let e = d; while (e < dim && pb[e + 1] && pb[e + 1].turno === 'N') e++;
              let s2n = d; while (s2n > 1 && pb[s2n - 1] && pb[s2n - 1].turno === 'N') s2n--;
              protectFrom(pb, e + 1, e - s2n + 1, dim);
            }
          }
        }
      }
    }
  }

  stats.after = coverageQuick(ctx, occupied, dim).covered;

  // STEP 6 — OTTIMIZZAZIONE EQUITÀ ("coordinatore infermieristico"): ribilancia i
  // carichi senza toccare la copertura (scambi di intera cella nello stesso giorno).
  if (optimize) {
    const opt = optimizePiano(ctx, piano, prevEdge, nextEdge);
    stats.equityBefore = opt.before.score;
    stats.equityAfter = opt.after.score;
    stats.optSwaps = opt.swaps;
    stats.optPasses = opt.passes;
  }

  // C5 — ENFORCEMENT FINALE: garanzia assoluta che l'output non contenga mai 7+ giorni
  // consecutivi (né da template, né da copertura, né da ottimizzazione).
  enforceMaxConsec(ctx, piano, prevEdge);

  // STEP 7 — SMONTO NOTTE: il primo giorno NON lavorativo dopo un blocco di notti è uno
  // "smonto" (S), categoria separata: né lavoro né riposo. Le 11h sono già garantite
  // (quel giorno era forzato a riposo), quindi la copertura e i riposi 11h non cambiano.
  deriveSmonti(ctx, piano, prevEdge);
  stats.derogheList = buildDerogheList(ctx, piano);
  const sat = prefSatisfaction(ctx, piano);
  stats.prefPct = sat.prefPct;
  stats.desPct = sat.desPct;
  return { piano, stats };
}

/**
 * Fill a single freed slot after a manual edit. Mutates `piano` and returns the assignment.
 */
export function smartFill(ctx: EngineContext, piano: Piano, oldCell: Cell, day: number, prevEdge: PrevEdge = {}, nextEdge: PrevEdge = {}): { inf: Staff; settore: string; deroghe: DerogaCode[] } | null {
  if (!oldCell || !isWork(oldCell.turno) || !oldCell.repartoId || !oldCell.settore) return null;
  const rep = getRep(ctx.reparti, oldCell.repartoId);
  if (!rep) return null;
  const turn = oldCell.turno as TurnoLavoro;
  const code = oldCell.settore;
  const dim = daysInMonth(ctx.year, ctx.month);
  for (const s of ctx.staff) {
    const cz = getCell(piano, s.id, day);
    if (cz && cz.settore === code) return null; // already covered
  }
  let best: Staff | null = null;
  let bestCost = 99;
  let bestWork = 1e9;
  let bestDer: DerogaCode[] = [];
  for (const inf of ctx.staff) {
    const p = piano[inf.id];
    if (!p) continue;
    const c = p[day];
    if (!c || c.turno !== 'R' || c.locked) continue;
    const ev = evalCandidate(ctx, piano, inf, day, turn, rep, code, prevEdge, nextEdge);
    if (!ev) continue;
    const cost = ev.deroghe.length;
    const wk = countWork(piano, inf.id, dim);
    if (cost < bestCost || (cost === bestCost && wk < bestWork)) {
      best = inf;
      bestCost = cost;
      bestWork = wk;
      bestDer = ev.deroghe;
    }
  }
  if (!best) return null;
  piano[best.id][day] = { turno: turn, repartoId: rep.id, settore: code, locked: false, autoFilled: true, riposoForzato: false, deroghe: bestDer.slice() };
  return { inf: best, settore: code, deroghe: bestDer.slice() };
}

export function listDeroghe(ctx: EngineContext, piano: Piano): DerogaItem[] {
  const dim = daysInMonth(ctx.year, ctx.month);
  const out: DerogaItem[] = [];
  for (const inf of ctx.staff) {
    const p = piano[inf.id];
    if (!p) continue;
    for (let d = 1; d <= dim; d++) {
      const c = p[d];
      if (c && c.deroghe && c.deroghe.length) {
        out.push({ infId: inf.id, nome: inf.nome, day: d, turno: c.turno, settore: c.settore, deroghe: c.deroghe.slice() });
      }
    }
  }
  return out;
}

export function computeCoverage(ctx: EngineContext, piano: Piano): Coverage {
  const dim = daysInMonth(ctx.year, ctx.month);
  const res: Coverage = { byRep: {}, total: 0, covered: 0, uncovered: [], globalPct: 100 };
  const coverMap: Record<string, Record<number, boolean>> = {};
  for (const inf of ctx.staff) {
    const p = piano[inf.id];
    if (!p) continue;
    for (let d = 1; d <= dim; d++) {
      const c = p[d];
      if (c && isWork(c.turno) && c.settore) {
        if (!coverMap[c.settore]) coverMap[c.settore] = {};
        coverMap[c.settore][d] = true;
      }
    }
  }
  for (const rep of ctx.reparti) {
    const slots: Coverage['byRep'][string]['slots'] = [];
    const sumByTurn: Record<TurnoLavoro, number[]> = { M: [], P: [], N: [] };
    (['M', 'P', 'N'] as TurnoLavoro[]).forEach((t) => {
      const ns = rep.settori[t] || 0;
      for (let sn = 1; sn <= ns; sn++) {
        const code = secCode(t, rep.sigla, sn);
        const cov = coverMap[code] ? Object.keys(coverMap[code]).length : 0;
        const pct = dim ? Math.round((cov / dim) * 100) : 0;
        slots.push({ code, turn: t, n: sn, covered: cov, total: dim, pct });
        sumByTurn[t].push(pct);
        res.total += dim;
        res.covered += cov;
        for (let dd = 1; dd <= dim; dd++) {
          if (!(coverMap[code] && coverMap[code][dd])) {
            res.uncovered.push({ repId: rep.id, turn: t, code, day: dd } as UncoveredSlot);
          }
        }
      }
    });
    const avg: { M: number | null; P: number | null; N: number | null } = { M: null, P: null, N: null };
    (['M', 'P', 'N'] as TurnoLavoro[]).forEach((t) => {
      const a = sumByTurn[t];
      avg[t] = a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;
    });
    const hasProblemi = slots.some((s) => s.pct < 100);
    res.byRep[rep.id] = { slots, avg, hasProblemi };
  }
  res.globalPct = res.total ? Math.round((res.covered / res.total) * 100) : 100;
  return res;
}

export function getEmptyCell(): Cell {
  return emptyCell();
}

// ============================================================================
//  OTTIMIZZATORE DI EQUITÀ — "coordinatore infermieristico"
//  Dopo la generazione, ribilancia i carichi del mese tramite SCAMBI di intera
//  cella fra due operatori nello STESSO giorno. Uno scambio del genere lascia
//  INVARIATO il multiset dei turni del giorno → la copertura non cambia mai; e
//  viene applicato solo se NON viola il riposo 11h (anche ai bordi del mese).
//  Ricerca locale greedy DETERMINISTICA (ordine fisso, nessuna casualità) →
//  risultato riproducibile, compatibile con undo/redo e con i test.
// ============================================================================

interface Metrics { ore: number; notti: number; mattine: number; pom: number; weekend: number; festivi: number; riposi: number; smonti: number; }
const MKEYS: (keyof Metrics)[] = ['notti', 'weekend', 'festivi', 'riposi', 'smonti', 'ore', 'mattine', 'pom'];
const WCOST: Record<keyof Metrics, number> = { notti: 9, weekend: 6, festivi: 6, riposi: 3, smonti: 2, ore: 0.045, mattine: 1.4, pom: 1.4 };
const QTHR = { pomRun: 3, restRun: 3, workRun: 6, weekendRun: 2 };

function emptyMetrics(): Metrics { return { ore: 0, notti: 0, mattine: 0, pom: 0, weekend: 0, festivi: 0, riposi: 0, smonti: 0 }; }

function cellHours(ctx: EngineContext, c: Cell | undefined): number {
  if (!c || !isWork(c.turno)) return 0;
  const orari = c.repartoId ? (getRep(ctx.reparti, c.repartoId)?.orari || STD_ORARI) : STD_ORARI;
  return shiftHours(c.turno, orari);
}

function cellMetricInc(ctx: EngineContext, c: Cell | undefined, year: number, month: number, day: number, prevTurno: string | null = null): Metrics {
  const m = emptyMetrics();
  if (!c) return m;
  if (c.turno === 'S') { m.smonti = 1; return m; }                       // smonto esplicito
  if (c.turno === 'R') { if (prevTurno === 'N') m.smonti = 1; else m.riposi = 1; return m; } // R dopo N = smonto (non riposo)
  if (c.turno === 'F') return m; // assenza: non pesa sui carichi
  m.ore = cellHours(ctx, c);
  if (c.turno === 'N') m.notti = 1;
  else if (c.turno === 'M') m.mattine = 1;
  else if (c.turno === 'P') m.pom = 1;
  if (isWeekend(year, month, day)) m.weekend = 1;
  if (isHoliday(year, month, day)) m.festivi = 1;
  return m;
}

function addInc(m: Metrics, inc: Metrics, sign: number) {
  m.ore += sign * inc.ore; m.notti += sign * inc.notti; m.mattine += sign * inc.mattine;
  m.pom += sign * inc.pom; m.weekend += sign * inc.weekend; m.festivi += sign * inc.festivi; m.riposi += sign * inc.riposi; m.smonti += sign * inc.smonti;
}

// penalità di qualità per la sequenza di UN operatore (con eventuale override di un giorno, senza mutare)
function qualityPenaltyOp(ctx: EngineContext, piano: Piano, infId: string, dim: number, contratto: string, overrideDay = 0, overrideCell: Cell | null = null, weekendGroups: number[][] = [], repartiCount = 1): number {
  const p = piano[infId];
  if (!p) return 0;
  const infP = ctx.staff.find((s) => s.id === infId);
  const pr = infP ? prefsOf(infP) : {};
  const prefW = modeOf(ctx) === 'rigida' ? 1.6 : 0.5;
  const hasDes = !!(ctx.desiderata && ctx.desiderata.length);
  const giorniCons = Math.min(getCtr(contratto).giorniCons, QTHR.workRun);
  const at = (d: number): Cell | undefined => (d === overrideDay ? (overrideCell || undefined) : p[d]);
  let pen = 0;
  let runN = 0, runP = 0, runWork = 0, runRest = 0;
  let totN = 0;
  let lastSector: string | null = null;
  for (let d = 1; d <= dim; d++) {
    const c = at(d);
    const t = c ? c.turno : 'R';
    // più di 2 notti consecutive (penalità elevata)
    if (t === 'N') { runN++; totN++; if (runN >= 3) pen += 14 * (runN - 2); } else runN = 0;
    if (t === 'P') { runP++; if (runP > QTHR.pomRun) pen += 3 * (runP - QTHR.pomRun); } else runP = 0;
    // più di 6 giorni lavorativi consecutivi
    if (t === 'M' || t === 'P' || t === 'N') { runWork++; if (runWork > giorniCons) pen += 5 * (runWork - giorniCons); } else runWork = 0;
    // più di 3 riposi consecutivi (lo smonto NON è un riposo)
    if (t === 'R') { runRest++; if (runRest > QTHR.restRun) pen += 3 * (runRest - QTHR.restRun); } else runRest = 0;
    // eccessiva permanenza nello stesso settore in giorni lavorati consecutivi
    if (c && isWork(t) && c.settore) {
      if (lastSector && lastSector === c.settore) pen += 1.5;
      lastSector = c.settore;
    } else if (t === 'R' || t === 'S') {
      lastSector = null;
    }
    // C3: festivo MAGGIORE lavorato anche l'anno precedente → penalità elevata (alternanza)
    if (c && isWork(t)) {
      const mk = majorHolidayKey(ctx.year, ctx.month, d);
      if (mk && (ctx.festiviMajor?.[mk] || []).indexOf(infId) >= 0) pen += 30;
    }
    // PREFERENZE DEBOLI (peso modulato dalla modalità)
    if (c && isWork(t)) {
      if (pr.prefMattina && t !== 'M') pen += 1.2 * prefW;
      if (pr.prefPomeriggio && t !== 'P') pen += 1.2 * prefW;
      if (pr.prefWeekendLibero && isWeekend(ctx.year, ctx.month, d)) pen += 2 * prefW;
      if (pr.prefSettore && c.settore && c.settore !== pr.prefSettore) pen += 0.3 * prefW;
      if (pr.prefReparto && c.repartoId && c.repartoId !== pr.prefReparto) pen += 0.4 * prefW;
    }
    // DESIDERATA (peso per priorità)
    if (hasDes) {
      const ds = desForDay(ctx, infId, ctx.year, ctx.month, d);
      if (ds.length) {
        const working = !!c && isWork(t);
        for (const x of ds) {
          const w = PRIO_W[x.priorita] || 9;
          if (x.tipo === 'riposo' && working) pen += w;
          else if (x.tipo === 'lavoro' && !working) pen += w;
          else if (x.tipo === 'mattina' && working && t !== 'M') pen += w;
          else if (x.tipo === 'pomeriggio' && working && t !== 'P') pen += w;
          else if (x.tipo === 'evitaNotte' && t === 'N') pen += w;
        }
      }
    }
    // --- COERENZA DELLA MATRICE: transizioni innaturali, giorni isolati, alternanze ---
    const prev = at(d - 1); const pt = prev ? prev.turno : null;
    if (pt) {
      // notte seguita direttamente da lavoro (manca lo smonto) oppure giorno→notte brusco
      if (pt === 'N' && (t === 'M' || t === 'P')) pen += 6;
      else if ((pt === 'M' || pt === 'P') && t === 'N') pen += 3;
    }
    // giorno di lavoro ISOLATO (riposo/smonto su entrambi i lati) → frammentazione
    if (isWork(t)) {
      const nx = at(d + 1); const nt = nx ? nx.turno : null;
      const restLike = (x: string | null) => x === 'R' || x === 'S' || x === null;
      if (restLike(pt) && restLike(nt)) pen += 2;
      // alternanza a livello di turno (es. M P M / P M P)
      else if (pt && nt && isWork(pt as Turno) && isWork(nt as Turno) && pt !== t && nt !== t && pt === nt) pen += 1.5;
    }
  }
  // più di 2 weekend lavorati consecutivi
  if (weekendGroups.length) {
    let runWe = 0;
    for (const grp of weekendGroups) {
      let worked = false;
      for (const dd of grp) { const c = at(dd); if (c && isWork(c.turno)) { worked = true; break; } }
      if (worked) { runWe++; if (runWe > QTHR.weekendRun) pen += 8 * (runWe - QTHR.weekendRun); } else runWe = 0;
    }
  }
  // C1: superamento della quota notti mensile ∝ contratto (FTE) → penalità ELEVATA
  const nq = getCtr(contratto).nottiMax;
  if (totN > nq) pen += 25 * (totN - nq);
  // --- EQUITÀ SETTORE/REPARTO (anti-confinamento): nessuno sempre nello stesso settore/reparto ---
  const secCnt: Record<string, number> = {}; const repCnt: Record<string, number> = {}; let workDays = 0;
  for (let d = 1; d <= dim; d++) {
    const c = at(d);
    if (c && isWork(c.turno)) {
      workDays++;
      if (c.settore) secCnt[c.settore] = (secCnt[c.settore] || 0) + 1;
      if (c.repartoId) repCnt[c.repartoId] = (repCnt[c.repartoId] || 0) + 1;
    }
  }
  if (workDays >= 6) {
    let maxSec = 0; let distinctSec = 0;
    for (const k in secCnt) { distinctSec++; if (secCnt[k] > maxSec) maxSec = secCnt[k]; }
    if (distinctSec <= 1) pen += 6;                                   // confinato in un solo settore
    else if (maxSec > workDays * 0.75) pen += 3 * (maxSec - workDays * 0.75);
    if (repartiCount > 1) {
      let distinctRep = 0; for (const k in repCnt) distinctRep++;
      if (distinctRep <= 1) pen += 6;                                 // confinato in un solo reparto pur potendone fare più d'uno
    }
  }
  return pen;
}

function infEligibleForCell(ctx: EngineContext, inf: Staff, c: Cell): boolean {
  if (!isWork(c.turno)) return true; // riposo: sempre ammesso
  const t = c.turno as TurnoLavoro;
  if (!c.repartoId) return false;
  if (inf.reparti.indexOf(c.repartoId) < 0) return false;
  const rep = getRep(ctx.reparti, c.repartoId);
  if (!rep) return false;
  if ((rep.settori[t] || 0) <= 0) return false;
  const pr = inf.preferenze || {};
  if (pr.soloMattina && t !== 'M') return false;        // preferenza FORTE
  if (pr.soloPomeriggio && t !== 'P') return false;     // preferenza FORTE
  if (t === 'N' && roleExemptions(inf).noNight) return false; // esente notti (skill/ruolo)
  if (inf.esenzioniTurni.indexOf(t) >= 0) return false;
  if (c.settore && inf.esenzioniSettori.indexOf(c.settore) >= 0) return false;
  if (t === 'N' && inf.nottiPerCiclo === 0) return false;
  return true;
}

function restOkForCell(ctx: EngineContext, piano: Piano, infId: string, day: number, c: Cell, prevEdge: PrevEdge, nextEdge: PrevEdge): boolean {
  if (!isWork(c.turno)) return true; // un riposo non introduce vincoli di 11h
  const orari = c.repartoId ? (getRep(ctx.reparti, c.repartoId)?.orari || STD_ORARI) : STD_ORARI;
  return restOkBothSides(ctx, piano, infId, day, c.turno, orari, prevEdge, nextEdge);
}

const balPct = (vals: number[]): number => { const mx = Math.max(0, ...vals); const mn = Math.min(...vals); return mx <= 0 ? 100 : Math.round((mn / mx) * 100); };
const spread = (vals: number[]): number => (vals.length ? Math.max(...vals) - Math.min(...vals) : 0);

export interface EquityScore {
  score: number; // 0..100 (100 = perfettamente equo)
  diffOre: number; diffNotti: number; diffWeekend: number; diffFestivi: number; diffRiposi: number;
  cost: number;  // costo interno (più basso = meglio)
}

function talliesOf(ctx: EngineContext, piano: Piano, dim: number, ids: string[]): Record<string, Metrics> {
  const M: Record<string, Metrics> = {};
  for (const id of ids) {
    const m = emptyMetrics(); const p = piano[id];
    if (p) for (let d = 1; d <= dim; d++) addInc(m, cellMetricInc(ctx, p[d], ctx.year, ctx.month, d, p[d - 1] ? p[d - 1].turno : null), 1);
    M[id] = m;
  }
  return M;
}

function variance(vals: number[]): number {
  const n = vals.length; if (n < 2) return 0;
  let s1 = 0, s2 = 0; for (const v of vals) { s1 += v; s2 += v * v; }
  const mean = s1 / n; return s2 / n - mean * mean;
}

// raggruppa i giorni di weekend in unità consecutive (Sab+Dom) per misurare i weekend lavorati di fila
function weekendGroupsOf(ctx: EngineContext, dim: number): number[][] {
  const groups: number[][] = []; let cur: number[] = [];
  for (let d = 1; d <= dim; d++) {
    if (isWeekend(ctx.year, ctx.month, d)) cur.push(d);
    else if (cur.length) { groups.push(cur); cur = []; }
  }
  if (cur.length) groups.push(cur);
  return groups;
}

export function scoreMonth(ctx: EngineContext, piano: Piano, prevEdge: PrevEdge = {}, nextEdge: PrevEdge = {}): EquityScore {
  const dim = daysInMonth(ctx.year, ctx.month);
  const ids = ctx.staff.map((s) => s.id).filter((id) => piano[id]);
  const M = talliesOf(ctx, piano, dim, ids);
  const arr = (k: keyof Metrics) => ids.map((id) => M[id][k]);
  let cost = 0;
  for (const k of MKEYS) cost += WCOST[k] * variance(arr(k));
  const wg = weekendGroupsOf(ctx, dim);
  for (const inf of ctx.staff) if (piano[inf.id]) cost += qualityPenaltyOp(ctx, piano, inf.id, dim, inf.contratto, 0, null, wg, inf.reparti ? inf.reparti.length : 1);
  const score = ids.length < 2 ? 100 : Math.round((balPct(arr('notti')) * 1.2 + balPct(arr('weekend')) + balPct(arr('festivi')) + balPct(arr('ore')) * 1.2 + balPct(arr('riposi')) * 0.6) / 5.0);
  return {
    score,
    diffOre: Math.round(spread(arr('ore')) * 10) / 10,
    diffNotti: spread(arr('notti')),
    diffWeekend: spread(arr('weekend')),
    diffFestivi: spread(arr('festivi')),
    diffRiposi: spread(arr('riposi')),
    cost,
  };
}

// ricalcola le deroghe per cella sullo stato finale (coerenza con pin e validatore)
function recomputeDeroghe(ctx: EngineContext, piano: Piano, dim: number) {
  for (const inf of ctx.staff) {
    const p = piano[inf.id]; if (!p) continue;
    const ctr = getCtr(inf.contratto); const monte = monteTurni(inf);
    let work = 0, notti = 0, runWork = 0;
    for (let d = 1; d <= dim; d++) {
      const c = p[d]; if (!c) continue;
      if (isWork(c.turno)) {
        work++;
        const der: DerogaCode[] = [];
        if (work > monte) der.push('ore');
        if (c.turno === 'N') { notti++; if (notti > ctr.nottiMax) der.push('notti'); }
        runWork++; if (runWork > ctr.giorniCons) der.push('consec');
        if (!c.locked) c.deroghe = der; // non altera celle bloccate (assenze/manuali)
        else c.deroghe = der;
      } else {
        runWork = 0;
        if (!(c.turno === 'F')) c.deroghe = [];
      }
    }
  }
}

// SMONTO NOTTE — NORMALIZZAZIONE: ogni riposo che segue una notte diventa 'S'; ogni 'S'
// non preceduto da notte (es. dopo uno scambio dell'ottimizzatore) torna 'R'. Idempotente,
// rest-neutra (S e R sono entrambi non lavorativi) → copertura e 11h invariati.
function deriveSmonti(ctx: EngineContext, piano: Piano, prevEdge: PrevEdge = {}) {
  const dim = daysInMonth(ctx.year, ctx.month);
  for (const inf of ctx.staff) {
    const p = piano[inf.id]; if (!p) continue;
    for (let d = 1; d <= dim; d++) {
      const c = p[d]; if (!c || c.locked) continue;
      const prevNight = d > 1 ? (!!p[d - 1] && p[d - 1].turno === 'N') : (prevEdge[inf.id]?.turno === 'N');
      if (c.turno === 'R' && prevNight) p[d] = { ...c, turno: 'S', riposoForzato: true };
      else if (c.turno === 'S' && !prevNight) p[d] = { ...c, turno: 'R', riposoForzato: false };
    }
  }
}

export function optimizePiano(
  ctx: EngineContext, piano: Piano, prevEdge: PrevEdge = {}, nextEdge: PrevEdge = {}, maxPasses = 14,
): { piano: Piano; before: EquityScore; after: EquityScore; passes: number; swaps: number } {
  const dim = daysInMonth(ctx.year, ctx.month);
  const ids = ctx.staff.map((s) => s.id).filter((id) => piano[id]);
  const n = ids.length;
  const before = scoreMonth(ctx, piano, prevEdge, nextEdge);
  if (n < 2) return { piano, before, after: before, passes: 0, swaps: 0 };

  const infById: Record<string, Staff> = {}; ctx.staff.forEach((s) => { infById[s.id] = s; });
  const wg = weekendGroupsOf(ctx, dim);
  const M = talliesOf(ctx, piano, dim, ids);
  const Q: Record<string, number> = {};
  for (const id of ids) Q[id] = qualityPenaltyOp(ctx, piano, id, dim, infById[id].contratto, 0, null, wg, infById[id].reparti ? infById[id].reparti.length : 1);
  const S1: Record<string, number> = {}; const S2: Record<string, number> = {};
  for (const k of MKEYS) { let s1 = 0, s2 = 0; for (const id of ids) { const v = M[id][k]; s1 += v; s2 += v * v; } S1[k] = s1; S2[k] = s2; }

  // giorni rilevanti per metriche "di calendario"
  const weekendDays: number[] = []; const holidayDays: number[] = [];
  for (let d = 1; d <= dim; d++) { if (isWeekend(ctx.year, ctx.month, d)) weekendDays.push(d); if (isHoliday(ctx.year, ctx.month, d)) holidayDays.push(d); }

  // valuta e (se migliora il COSTO GLOBALE) applica lo scambio A<->B nel giorno d
  const trySwap = (A: string, B: string, d: number): boolean => {
    if (A === B) return false;
    const ca = piano[A][d], cb = piano[B][d];
    if (!ca || !cb || ca.locked || cb.locked) return false;
    if (ca.turno === 'S' || cb.turno === 'S') return false; // lo smonto resta ancorato alla sua notte
    if (ca.turno === cb.turno && ca.repartoId === cb.repartoId && ca.settore === cb.settore) return false;
    if (!infEligibleForCell(ctx, infById[A], cb)) return false;
    if (!infEligibleForCell(ctx, infById[B], ca)) return false;
    if (!restOkForCell(ctx, piano, A, d, cb, prevEdge, nextEdge)) return false;
    if (!restOkForCell(ctx, piano, B, d, ca, prevEdge, nextEdge)) return false;
    // VINCOLO FORTE: nessuno scambio può lasciare una notte senza recupero completo (smonto + riposi)
    if (!rowRecoveryOk(piano[A], dim, d, cb)) return false;
    if (!rowRecoveryOk(piano[B], dim, d, ca)) return false;
    // C2: nessun lavoro su un giorno esente (weekend/festivi/coordinatore) per chi riceve la cella
    if (isWork(cb.turno) && mustRestDay(infById[A], ctx.year, ctx.month, d)) return false;
    if (isWork(ca.turno) && mustRestDay(infById[B], ctx.year, ctx.month, d)) return false;
    // C1: nessuna notte oltre la quota mensile ∝ contratto
    const aN = countTurno(piano, A, 'N', dim) - (ca.turno === 'N' ? 1 : 0) + (cb.turno === 'N' ? 1 : 0);
    if (aN > nightQuota(infById[A])) return false;
    const bN = countTurno(piano, B, 'N', dim) - (cb.turno === 'N' ? 1 : 0) + (ca.turno === 'N' ? 1 : 0);
    if (bN > nightQuota(infById[B])) return false;
    // C5: nessun blocco > 6 giorni consecutivi (anche a cavallo di mese)
    if (isWork(cb.turno) && consecRunIfWork(piano[A], d, dim, prevEdge[A]?.runWork || 0) > maxConsec(infById[A])) return false;
    if (isWork(ca.turno) && consecRunIfWork(piano[B], d, dim, prevEdge[B]?.runWork || 0) > maxConsec(infById[B])) return false;
    const prevA = piano[A][d - 1] ? piano[A][d - 1].turno : null;
    const prevB = piano[B][d - 1] ? piano[B][d - 1].turno : null;
    const incAold = cellMetricInc(ctx, ca, ctx.year, ctx.month, d, prevA); // A perde ca (predecessore A)
    const incAnew = cellMetricInc(ctx, cb, ctx.year, ctx.month, d, prevA); // A prende cb (predecessore A)
    const incBold = cellMetricInc(ctx, cb, ctx.year, ctx.month, d, prevB); // B perde cb (predecessore B)
    const incBnew = cellMetricInc(ctx, ca, ctx.year, ctx.month, d, prevB); // B prende ca (predecessore B)
    let dVar = 0;
    const nS1: Record<string, number> = {}; const nS2: Record<string, number> = {};
    for (const k of MKEYS) {
      const aOld = M[A][k], bOld = M[B][k];
      const aNew = aOld - incAold[k] + incAnew[k];
      const bNew = bOld - incBold[k] + incBnew[k];
      const s1 = S1[k] + (aNew - aOld) + (bNew - bOld);
      const s2 = S2[k] - aOld * aOld - bOld * bOld + aNew * aNew + bNew * bNew;
      nS1[k] = s1; nS2[k] = s2;
      dVar += WCOST[k] * ((s2 / n - (s1 / n) * (s1 / n)) - (S2[k] / n - (S1[k] / n) * (S1[k] / n)));
    }
    const qAnew = qualityPenaltyOp(ctx, piano, A, dim, infById[A].contratto, d, cb, wg, infById[A].reparti ? infById[A].reparti.length : 1);
    const qBnew = qualityPenaltyOp(ctx, piano, B, dim, infById[B].contratto, d, ca, wg, infById[B].reparti ? infById[B].reparti.length : 1);
    const dQ = (qAnew - Q[A]) + (qBnew - Q[B]);
    if (dVar + dQ >= -1e-6) return false; // non migliora il costo globale
    piano[A][d] = cb; piano[B][d] = ca;   // scambio: copertura del giorno invariata
    const ma = emptyMetrics(); const pa = piano[A]; for (let dd = 1; dd <= dim; dd++) addInc(ma, cellMetricInc(ctx, pa[dd], ctx.year, ctx.month, dd, pa[dd - 1] ? pa[dd - 1].turno : null), 1); M[A] = ma;
    const mb = emptyMetrics(); const pb = piano[B]; for (let dd = 1; dd <= dim; dd++) addInc(mb, cellMetricInc(ctx, pb[dd], ctx.year, ctx.month, dd, pb[dd - 1] ? pb[dd - 1].turno : null), 1); M[B] = mb;
    // somme ricostruite ESATTAMENTE da M (lo scambio può spostare uno smonto sul giorno d+1: niente drift)
    for (const k of MKEYS) { let s1 = 0, s2 = 0; for (const id of ids) { const v = M[id][k]; s1 += v; s2 += v * v; } S1[k] = s1; S2[k] = s2; }
    Q[A] = qAnew; Q[B] = qBnew;
    return true;
  };

  // una passata mirata su una metrica: sposta quella metrica dagli operatori "alti" ai "bassi"
  const metricPass = (key: keyof Metrics, days: number[]): boolean => {
    let imp = false;
    for (const d of days) {
      const movable = ids.filter((id) => { const c = piano[id][d]; return !!c && !c.locked; });
      if (movable.length < 2) continue;
      movable.sort((a, b) => (M[b][key] - M[a][key]) || (a < b ? -1 : 1)); // alti prima; tie deterministico
      const T = Math.min(6, movable.length);
      for (let hi = 0; hi < T; hi++) {
        for (let lo = movable.length - 1; lo >= movable.length - T && lo > hi; lo--) {
          if (trySwap(movable[hi], movable[lo], d)) imp = true;
        }
      }
    }
    return imp;
  };

  const allDays: number[] = []; for (let d = 1; d <= dim; d++) allDays.push(d);
  let swaps = 0; let pass = 0;
  for (; pass < 20; pass++) {
    const s0 = swaps;
    // ordine: prima le metriche "pesanti" (notti, ore), poi weekend/festivi, infine M/P/riposi
    if (metricPass('notti', allDays)) swaps++;
    if (metricPass('ore', allDays)) swaps++;
    if (metricPass('weekend', weekendDays)) swaps++;
    if (metricPass('festivi', holidayDays)) swaps++;
    if (metricPass('mattine', allDays)) swaps++;
    if (metricPass('pom', allDays)) swaps++;
    if (metricPass('riposi', allDays)) swaps++;
    if (swaps === s0) break; // nessun miglioramento in tutta la passata
  }
  // 'swaps' qui conta le passate-con-miglioramento; il numero reale di scambi non è critico per il report
  recomputeDeroghe(ctx, piano, dim);
  const after = scoreMonth(ctx, piano, prevEdge, nextEdge);
  return { piano, before, after, passes: pass, swaps };
}

// ════════════════════════════════════════════════════════════════════════════
// BACKBONE DI VERIFICA (TURNOVER) — funzioni pure, additive, non alterano la
// generazione. Usate da audit e dal gate di pubblicazione.
// ════════════════════════════════════════════════════════════════════════════

// ── FASE 4 — FATIGUE SCORE (0-100) ───────────────────────────────────────────
export interface FatigueReport {
  infId: string; nome: string; score: number;
  notti: number; weekend: number; festivi: number; maxConsec: number;
}
export function fatigueScore(ctx: EngineContext, piano: Piano): FatigueReport[] {
  const dim = daysInMonth(ctx.year, ctx.month);
  const out: FatigueReport[] = [];
  for (const inf of ctx.staff) {
    const p = piano[inf.id]; if (!p) continue;
    let notti = 0, weekend = 0, festivi = 0, run = 0, maxRun = 0;
    for (let d = 1; d <= dim; d++) {
      const c = p[d]; if (!c) continue;
      if (c.turno === 'N') notti++;
      if (isWork(c.turno)) {
        run++; if (run > maxRun) maxRun = run;
        if (isWeekend(ctx.year, ctx.month, d)) weekend++;
        if (isHoliday(ctx.year, ctx.month, d)) festivi++;
      } else run = 0;
    }
    // normalizzazione su un mese "pesante" di riferimento, pesi su notti/weekend/festivi/concentrazione
    const raw = (notti / 8) * 0.40 + (weekend / 5) * 0.25 + (festivi / 3) * 0.15 + (maxRun / 7) * 0.20;
    const score = Math.max(0, Math.min(100, Math.round(raw * 100)));
    out.push({ infId: inf.id, nome: inf.nome, score, notti, weekend, festivi, maxConsec: maxRun });
  }
  return out;
}

// ── FASE 2 — SKILL MIX (rilevazione, non vincolo in generazione) ─────────────
export interface SkillRequirement { area: string; livelloMin?: SkillLevel; n: number; }
export interface SkillMixViolation { day: number; repartoId: string; turno: TurnoLavoro; area: string; richiesti: number; presenti: number; }
const LIVELLO_ORD: Record<SkillLevel, number> = { base: 1, intermedio: 2, esperto: 3 };
function hasSkill(inf: Staff, area: string, livelloMin?: SkillLevel): boolean {
  if (!inf.competenze) return false;
  return inf.competenze.some((c) => c.area === area && (!livelloMin || LIVELLO_ORD[c.livello] >= LIVELLO_ORD[livelloMin]));
}
// requisiti default ispirati alla specifica clinica (M = referente+tutor+NIV esperto; N = area critica esperto)
export const DEFAULT_SKILL_REQ: Partial<Record<TurnoLavoro, SkillRequirement[]>> = {
  M: [{ area: 'Referente turno', n: 1 }, { area: 'Tutor studenti', n: 1 }, { area: 'NIV', livelloMin: 'esperto', n: 1 }],
  P: [{ area: 'Referente turno', n: 1 }],
  N: [{ area: 'Referente turno', n: 1 }, { area: 'Area Critica', livelloMin: 'esperto', n: 1 }],
};
export function skillMixCheck(ctx: EngineContext, piano: Piano, req: Partial<Record<TurnoLavoro, SkillRequirement[]>> = DEFAULT_SKILL_REQ): { evaluated: boolean; violations: SkillMixViolation[] } {
  const anySkill = ctx.staff.some((s) => s.competenze && s.competenze.length);
  if (!anySkill) return { evaluated: false, violations: [] };  // niente skill matrix → non valutabile
  const dim = daysInMonth(ctx.year, ctx.month);
  const violations: SkillMixViolation[] = [];
  for (const rep of ctx.reparti) {
    for (let d = 1; d <= dim; d++) {
      for (const t of ['M', 'P', 'N'] as TurnoLavoro[]) {
        const team = ctx.staff.filter((s) => { const c = piano[s.id] && piano[s.id][d]; return c && c.turno === t && c.repartoId === rep.id; });
        for (const r of (req[t] || [])) {
          const n = team.filter((s) => hasSkill(s, r.area, r.livelloMin)).length;
          if (n < r.n) violations.push({ day: d, repartoId: rep.id, turno: t, area: r.area + (r.livelloMin ? ` (${r.livelloMin})` : ''), richiesti: r.n, presenti: n });
        }
      }
    }
  }
  return { evaluated: true, violations };
}

// ── FASE 10 — GATE DI PUBBLICAZIONE ──────────────────────────────────────────
export interface GateCheck { nome: string; esito: 'pass' | 'fail' | 'warn' | 'na'; dettaglio: string; }
export interface PublishGate { ok: boolean; checks: GateCheck[] }
export function publishGate(ctx: EngineContext, piano: Piano, opts: { coverageMin?: number; fatigueMax?: number; prevPiano?: Piano } = {}): PublishGate {
  const dim = daysInMonth(ctx.year, ctx.month);
  const coverageMin = opts.coverageMin ?? 100;
  const fatigueMax = opts.fatigueMax ?? 90;
  let h11 = 0, rec = 0, smonto = 0, maxRun = 0, coordViol = 0;
  for (const inf of ctx.staff) {
    const p = piano[inf.id]; if (!p) continue;
    const ex = roleExemptions(inf); let run = 0;
    const prevLast = opts.prevPiano && opts.prevPiano[inf.id] ? opts.prevPiano[inf.id][daysInMonth(ctx.month === 0 ? ctx.year - 1 : ctx.year, (ctx.month + 11) % 12)] : null;
    for (let d = 1; d <= dim; d++) {
      const c = p[d]; if (!c) continue;
      if (isWork(c.turno)) { run++; if (run > maxRun) maxRun = run; } else run = 0;
      // esenzioni di ruolo
      if (ex.noNight && c.turno === 'N') coordViol++;
      if (ex.noWeekend && isWork(c.turno) && isWeekend(ctx.year, ctx.month, d)) coordViol++;
      if (ex.noFestivi && isWork(c.turno) && isHoliday(ctx.year, ctx.month, d)) coordViol++;
      // smonto valido: S preceduto da N/S (giorno 1 verificato col mese precedente se disponibile)
      if (c.turno === 'S') { const prev = d > 1 ? (p[d - 1] && p[d - 1].turno) : (prevLast ? prevLast.turno : 'N'); if (prev !== 'N' && prev !== 'S') smonto++; }
      // recupero post-notte: notte → lavoro diurno senza smonto
      if (d < dim) { const nx = p[d + 1]; if (c.turno === 'N' && nx && (nx.turno === 'M' || nx.turno === 'P')) rec++; }
      // riposo 11h
      if (d < dim) { const nx = p[d + 1]; if (nx && isWork(c.turno) && isWork(nx.turno)) { const o1 = c.repartoId ? (getRep(ctx.reparti, c.repartoId)?.orari || STD_ORARI) : STD_ORARI; const o2 = nx.repartoId ? (getRep(ctx.reparti, nx.repartoId)?.orari || STD_ORARI) : STD_ORARI; if (restMinutes(c.turno, nx.turno, o1, o2) < 660) h11++; } }
    }
  }
  const cov = computeCoverage(ctx, piano).globalPct;
  const fat = fatigueScore(ctx, piano);
  const fatMax = fat.reduce((m, f) => Math.max(m, f.score), 0);
  const skill = skillMixCheck(ctx, piano);
  const checks: GateCheck[] = [
    { nome: 'Riposo 11 ore', esito: h11 === 0 ? 'pass' : 'fail', dettaglio: h11 + ' violazioni' },
    { nome: 'Recupero post-notte', esito: rec === 0 ? 'pass' : 'fail', dettaglio: rec + ' violazioni' },
    { nome: 'Smonto', esito: smonto === 0 ? 'pass' : 'fail', dettaglio: smonto + ' smonti non validi' },
    { nome: 'Massimo 6 consecutivi', esito: maxRun <= 6 ? 'pass' : 'fail', dettaglio: 'max ' + maxRun },
    { nome: 'Esenzioni di ruolo', esito: coordViol === 0 ? 'pass' : 'fail', dettaglio: coordViol + ' violazioni' },
    { nome: 'Copertura', esito: cov >= coverageMin ? 'pass' : (cov >= coverageMin - 5 ? 'warn' : 'fail'), dettaglio: cov + '% (min ' + coverageMin + '%)' },
    { nome: 'Fatigue score', esito: fatMax <= fatigueMax ? 'pass' : 'warn', dettaglio: 'max ' + fatMax + '/100 (soglia ' + fatigueMax + ')' },
    { nome: 'Skill mix', esito: !skill.evaluated ? 'na' : (skill.violations.length === 0 ? 'pass' : 'fail'), dettaglio: skill.evaluated ? (skill.violations.length + ' carenze') : 'skill matrix non popolata' },
  ];
  const ok = checks.every((c) => c.esito === 'pass' || c.esito === 'warn' || c.esito === 'na');
  return { ok, checks };
}

// ── FASE 3 — CLASSIFICAZIONE AUTOMATICA DEL PERSONALE ────────────────────────
// Heuristica basata sui dati disponibili (qualifica, competenze, contratto). NOTA: lo
// "storico" pluriennale e gli anni di esperienza NON sono modellati nei dati → la
// classificazione si basa su qualifica e skill matrix.
export type OperatorClass = 'Neoassunto' | 'Junior' | 'Senior' | 'Esperto' | 'Referente';
export function classifyOperator(inf: Staff): { categoria: OperatorClass; motivi: string[] } {
  const comp = inf.competenze || [];
  const motivi: string[] = [];
  const has = (a: string) => comp.some((c) => c.area === a);
  const lvl = (l: SkillLevel) => comp.filter((c) => c.livello === l).length;
  if (/coordinat/i.test(inf.qualifica || '') || has('Referente turno')) { motivi.push(has('Referente turno') ? 'competenza Referente turno' : 'ruolo di coordinamento'); return { categoria: 'Referente', motivi }; }
  if (/specialist/i.test(inf.qualifica || '') || lvl('esperto') >= 2) { motivi.push(lvl('esperto') >= 2 ? lvl('esperto') + ' competenze esperto' : 'qualifica specialistica'); return { categoria: 'Esperto', motivi }; }
  if (lvl('esperto') >= 1 || lvl('intermedio') >= 2) { motivi.push('competenze di livello intermedio/esperto'); return { categoria: 'Senior', motivi }; }
  if (comp.length >= 1) { motivi.push(comp.length + ' competenze di base'); return { categoria: 'Junior', motivi }; }
  motivi.push('nessuna competenza registrata'); return { categoria: 'Neoassunto', motivi };
}

// ── FASE 4 — PROPOSTA AUTOMATICA DELLA MATRICE (spiegata) ────────────────────
// L'AI propone la matrice operatore in base a profilo/contratto/notti/ruolo. Rispetta i
// vincoli forti (solo mattina/pomeriggio, esente notti). Ogni scelta è motivata.
export function proposeMatrice(inf: Staff, ctx?: EngineContext): { id: string; label: string; motivo: string } {
  const cat = catalogOf(ctx);
  const mx = (id: string) => cat.find((m) => m.id === id) || MATRICI.find((m) => m.id === id);
  const wrap = (id: string, motivo: string) => { const m = mx(id); return { id, label: (m && m.label) || id, motivo }; };
  const pr = prefsOf(inf);
  if (pr.soloMattina) return wrap('TM', 'preferenza forte: solo mattina');
  if (pr.soloPomeriggio) return wrap('TP', 'preferenza forte: solo pomeriggio');
  if (roleExemptions(inf).noNight) return wrap('TA', 'esente dalle notti: ciclo diurno');
  const pt = /^PT|^TDPT/.test(inf.contratto || '');
  if (pt) return wrap('QUINTA', 'part-time: ciclo leggero a una notte');
  const n = inf.nottiPerCiclo || 0;
  if (n >= 2) return wrap('DECIMA', 'full-time con due notti: recupero post-notte completo (N N S R R)');
  if (n === 1) return wrap('SESTA', 'una notte per ciclo: rotazione compatta');
  return wrap('TA', 'profilo diurno');
}
export function proposeAllMatrici(ctx: EngineContext): { infId: string; nome: string; classe: OperatorClass; matrice: string; label: string; motivo: string }[] {
  return ctx.staff.map((inf) => {
    const c = classifyOperator(inf); const p = proposeMatrice(inf, ctx);
    return { infId: inf.id, nome: inf.nome, classe: c.categoria, matrice: p.id, label: p.label, motivo: p.motivo };
  });
}
