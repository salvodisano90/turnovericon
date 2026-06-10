// services/engine.ts — AI scheduling engine (pure, framework-agnostic)

import {
  BuildStats, Cell, Coverage, DerogaCode, DerogaItem, EngineContext,
  OrariSet, Piano, Reparto, Staff, Turno, TurnoLavoro, UncoveredSlot,
  Preferenze, Desiderata, Deroga, GenerationMode, Matrice, Competenza, SkillLevel, OperatorClass, ApprovalRequest, SeasonalConfig, Season, Postazione, StationPriority, StationStatusKind, StationCoverageItem, StationReq,
} from '../types';
import { requestLabel } from '../utils/requests';
import { ROTATION_TEMPLATES, STD_ORARI, MATRICI } from '../utils/constants';
import {
  cloneDeep, daysInMonth, emptyCell, getCtr, getMx, getRep,
  isWork, restMinutes, secCode, absDayIndex, shiftHours, isWeekend, isHoliday, easter, countsInCoverage, seasonalMatrice, seasonForDay,
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
  if (!countsInCoverage(inf)) return null;                                       // coordinamento/supporto: mai per copertura/sostituzioni
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

// Determina se l'operatore usa una matrice STAGIONALE e con quale configurazione.
// Precedenza: config a livello operatore > config del reparto (se la matrice op/reparto è 'STAGIONALE').
// Le preferenze forti (solo mattina/pomeriggio) e i combo espliciti hanno priorità e disattivano la stagionalità.
function seasonalConfigFor(inf: Staff, ctx: EngineContext): SeasonalConfig | null {
  const pr = prefsOf(inf);
  if (pr.soloMattina || pr.soloPomeriggio) return null;
  if (inf.templateCombo && inf.templateCombo.length) return null;
  if (inf.matrice === 'STAGIONALE') {
    if (inf.seasonal) return inf.seasonal;
    for (const rid of inf.reparti || []) { const r = ctx.reparti.find((x) => x.id === rid); if (r && r.seasonal) return r.seasonal; }
    return null;
  }
  if (!inf.matrice) { // nessuna matrice operatore → eredita dal reparto se è stagionale
    for (const rid of inf.reparti || []) { const r = ctx.reparti.find((x) => x.id === rid); if (r && r.matrice === 'STAGIONALE' && r.seasonal) return r.seasonal; }
  }
  return null;
}

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

// Configurazione operativa stagionale: quando il reparto usa una matrice STAGIONALE e la
// stagione attiva (dominante nel mese, valutata al giorno 15) definisce settori specifici,
// sostituisce rep.settori così che generazione E copertura usino i fabbisogni della stagione.
// Retro-compatibile: senza override, il contesto resta invariato.
function resolveSeasonalOps(ctx: EngineContext): EngineContext {
  if (!ctx.reparti.some((r) => r.matrice === 'STAGIONALE' && r.seasonal)) return ctx;
  const reparti = ctx.reparti.map((rep) => {
    if (rep.matrice === 'STAGIONALE' && rep.seasonal) {
      const s = seasonForDay(rep.seasonal, ctx.month, 15);
      const range = s ? rep.seasonal[s] : null;
      const op = range && range.op;
      if (op && op.settori) {
        return { ...rep, settori: { M: op.settori.M != null ? op.settori.M : rep.settori.M, P: op.settori.P != null ? op.settori.P : rep.settori.P, N: op.settori.N != null ? op.settori.N : rep.settori.N } };
      }
    }
    return rep;
  });
  return { ...ctx, reparti };
}

export function buildPiano(ctx: EngineContext, prev: Piano, keepLocked: boolean, prevEdge: PrevEdge = {}, nextEdge: PrevEdge = {}, optimize = false): { piano: Piano; stats: BuildStats } {
  ctx = resolveSeasonalOps(ctx);
  const dim = daysInMonth(ctx.year, ctx.month);
  const piano: Piano = keepLocked ? cloneDeep(prev) : {};
  const stats: BuildStats = { filled: 0, deroghe: 0, before: 0, after: 0 };

  // STEP 1 — base costruita dai TEMPLATE DI ROTAZIONE (STEP 0), ANCORATA AL CALENDARIO
  // ASSOLUTO → la sequenza compatta scorre senza salti tra un mese e l'altro.
  let _ti = 0;
  for (const inf of ctx.staff) {
    const p = ensurePiano(piano, inf.id);
    const seasonalCfg = seasonalConfigFor(inf, ctx);
    const seq = operatorCycle(inf, ctx, _ti++);
    const L = seq.length || 7;
    for (let d = 1; d <= dim; d++) {
      if (keepLocked && p[d] && p[d].locked) continue;
      let useSeq = seq; let useL = L;
      if (seasonalCfg) {
        const mid = seasonalMatrice(seasonalCfg, ctx.month, d);     // matrice della stagione del giorno
        const ss = mid ? seqOf(mid, ctx) : null;
        if (ss && ss.length) { useSeq = ss; useL = ss.length; }     // CONTINUITÀ: stesso contatore assoluto, cambia solo la lunghezza
      }
      const pos = (((absDayIndex(ctx.year, ctx.month, d) + (inf.offset || 0)) % useL) + useL) % useL;
      let turno = useSeq[pos];
      if (mustRestDay(inf, ctx.year, ctx.month, d) && isWork(turno)) turno = 'R'; // C2: esenzione weekend/festivi
      if (roleExemptions(inf).noNight && (turno === 'N')) turno = 'R';            // esenzione ruolo: mai notti (vincolo assoluto)
      if (isCoordinator(inf) && turno === 'P') turno = 'R';                       // coordinatore: solo M/R/F (mai pomeriggio)
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
          if (!countsInCoverage(inf)) {
            // coordinamento/supporto: visibile nel piano col proprio turno ma SENZA settore assistenziale
            p[d] = { turno: t, repartoId: rep.id, settore: null, locked: c.locked, autoFilled: false, riposoForzato: false, deroghe: [] };
            assigned = true; break;
          }
          occupied[d][code] = inf.id;
          p[d] = { turno: t, repartoId: rep.id, settore: code, locked: c.locked, autoFilled: false, riposoForzato: false, deroghe: [] };
          assigned = true;
        }
        if (!assigned && !countsInCoverage(inf) && (rep.settori[t] || 0) >= 0) {
          // nessun settore disponibile da occupare, ma la figura non assistenziale lavora comunque senza settore
          p[d] = { turno: t, repartoId: rep.id, settore: null, locked: c.locked, autoFilled: false, riposoForzato: false, deroghe: [] };
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
  ctx = resolveSeasonalOps(ctx);
  const dim = daysInMonth(ctx.year, ctx.month);
  const res: Coverage = { byRep: {}, total: 0, covered: 0, uncovered: [], globalPct: 100 };
  const coverMap: Record<string, Record<number, boolean>> = {};
  for (const inf of ctx.staff) {
    if (!countsInCoverage(inf)) continue; // coordinamento/supporto escluso dalla copertura
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
  const ids = ctx.staff.filter((s) => piano[s.id] && countsInCoverage(s)).map((s) => s.id); // solo personale assistenziale
  const n = ids.length;
  const before = scoreMonth(ctx, piano, prevEdge, nextEdge);
  if (n < 2) return { piano, before, after: before, passes: 0, swaps: 0 };

  const infById: Record<string, Staff> = {}; ctx.staff.forEach((s) => { infById[s.id] = s; });
  const stationsActive = anyStations(ctx);
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
    // postazioni operative come vincolo: misuro il delta applicando temporaneamente lo scambio
    const sBefore = stationsActive ? stationPenaltyDay(ctx, piano, d) : 0;
    piano[A][d] = cb; piano[B][d] = ca;   // scambio (tentativo): copertura del giorno invariata
    const dStation = stationsActive ? (stationPenaltyDay(ctx, piano, d) - sBefore) : 0;
    if (dVar + dQ + dStation >= -1e-6) { piano[A][d] = ca; piano[B][d] = cb; return false; } // non migliora il costo globale → revert
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

  // pass dedicato alle POSTAZIONI: per ogni giorno con postazioni critiche/alte non verdi,
  // prova scambi mirati per portare un operatore idoneo nel turno scoperto (solo scambi legali).
  const stationPass = (): boolean => {
    if (!stationsActive) return false;
    let imp = false;
    for (let d = 1; d <= dim; d++) {
      const st = _stationsOnDay(ctx, piano, d).filter((x) => x.status !== 'verde' && (x.priorita === 'critica' || x.priorita === 'alta'));
      if (!st.length) continue;
      const movable = ids.filter((id) => { const c = piano[id][d]; return !!c && !c.locked; });
      // prova tutte le coppie (T limitato) finché la penalità del giorno scende
      const T = Math.min(10, movable.length);
      for (let i = 0; i < T; i++) for (let j = 0; j < movable.length; j++) {
        if (i === j) continue;
        if (trySwap(movable[i], movable[j], d)) { imp = true; }
      }
    }
    return imp;
  };

  const allDays: number[] = []; for (let d = 1; d <= dim; d++) allDays.push(d);
  let swaps = 0; let pass = 0;
  for (; pass < 20; pass++) {
    const s0 = swaps;
    // PRIORITÀ: prima la copertura delle postazioni critiche/alte, poi equità/preferenze
    if (stationPass()) swaps++;
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
  const neo = checkNeoassunti(ctx, piano);
  const checks: GateCheck[] = [
    { nome: 'Riposo 11 ore', esito: h11 === 0 ? 'pass' : 'fail', dettaglio: h11 + ' violazioni' },
    { nome: 'Recupero post-notte', esito: rec === 0 ? 'pass' : 'fail', dettaglio: rec + ' violazioni' },
    { nome: 'Smonto', esito: smonto === 0 ? 'pass' : 'fail', dettaglio: smonto + ' smonti non validi' },
    { nome: 'Massimo 6 consecutivi', esito: maxRun <= 6 ? 'pass' : 'fail', dettaglio: 'max ' + maxRun },
    { nome: 'Esenzioni di ruolo', esito: coordViol === 0 ? 'pass' : 'fail', dettaglio: coordViol + ' violazioni' },
    { nome: 'Copertura', esito: cov >= coverageMin ? 'pass' : (cov >= coverageMin - 5 ? 'warn' : 'fail'), dettaglio: cov + '% (min ' + coverageMin + '%)' },
    { nome: 'Fatigue score', esito: fatMax <= fatigueMax ? 'pass' : 'warn', dettaglio: 'max ' + fatMax + '/100 (soglia ' + fatigueMax + ')' },
    { nome: 'Skill mix', esito: !skill.evaluated ? 'na' : (skill.violations.length === 0 ? 'pass' : 'fail'), dettaglio: skill.evaluated ? (skill.violations.length + ' carenze') : 'skill matrix non popolata' },
    { nome: 'Alert neoassunti', esito: neo.length === 0 ? 'pass' : 'warn', dettaglio: neo.length === 0 ? 'nessun turno solo-neoassunti' : (neo.length + ' turni a rischio (non bloccante)') },
  ];
  if (anyStations(ctx)) {
    const sc = stationCoverage(ctx, piano);
    const critUncovered = sc.filter((p) => p.priorita === 'critica' && p.rosso > 0);
    checks.push({ nome: 'Postazioni critiche', esito: critUncovered.length === 0 ? 'pass' : 'fail', dettaglio: critUncovered.length === 0 ? 'tutte coperte' : (critUncovered.length + ' critiche scoperte: ' + critUncovered.map((p) => p.nome).join(', ')) });
    const guar = stationGuarantee(ctx, piano);
    if (guar.grave) checks.push({ nome: 'Copertura minima garantita', esito: 'fail', dettaglio: 'CRITICITÀ GRAVE: ' + guar.problemi.join('; ') });
  }
  const ok = checks.every((c) => c.esito === 'pass' || c.esito === 'warn' || c.esito === 'na');
  return { ok, checks };
}

// ── FASE 3 — CLASSIFICAZIONE AUTOMATICA DEL PERSONALE ────────────────────────
// Heuristica basata sui dati disponibili (qualifica, competenze, contratto). NOTA: lo
// "storico" pluriennale e gli anni di esperienza NON sono modellati nei dati → la
// classificazione si basa su qualifica e skill matrix.
export function classifyOperator(inf: Staff): { categoria: OperatorClass; motivi: string[] } {
  const comp = inf.competenze || [];
  const motivi: string[] = [];
  const has = (a: string) => comp.some((c) => c.area === a);
  const lvl = (l: SkillLevel) => comp.filter((c) => c.livello === l).length;
  // ruolo prioritario: coordinatore o referente di turno
  if (/coordinat/i.test(inf.qualifica || '') || has('Referente turno')) { motivi.push(has('Referente turno') ? 'competenza Referente turno' : 'ruolo di coordinamento'); return { categoria: 'Referente', motivi }; }
  // 1) livello esplicito dal profilo
  if (inf.livello) { motivi.push('livello impostato manualmente'); return { categoria: inf.livello, motivi }; }
  // 2) anni di esperienza
  if (typeof inf.anniEsperienza === 'number') {
    const y = inf.anniEsperienza;
    if (y < 1) { motivi.push('meno di 1 anno di esperienza'); return { categoria: 'Neoassunto', motivi }; }
    if (y < 3) { motivi.push(y + ' anni di esperienza'); return { categoria: 'Junior', motivi }; }
    if (y < 8) { motivi.push(y + ' anni di esperienza'); return { categoria: 'Senior', motivi }; }
    motivi.push(y + ' anni di esperienza'); return { categoria: 'Esperto', motivi };
  }
  // 3) competenze (skill matrix)
  if (/specialist/i.test(inf.qualifica || '') || lvl('esperto') >= 2) { motivi.push(lvl('esperto') >= 2 ? lvl('esperto') + ' competenze esperto' : 'qualifica specialistica'); return { categoria: 'Esperto', motivi }; }
  if (lvl('esperto') >= 1 || lvl('intermedio') >= 2) { motivi.push('competenze di livello intermedio/esperto'); return { categoria: 'Senior', motivi }; }
  if (comp.length >= 1) { motivi.push(comp.length + ' competenze di base'); return { categoria: 'Junior', motivi }; }
  motivi.push('nessun profilo/competenza registrati'); return { categoria: 'Neoassunto', motivi };
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

// ── ALERT NEOASSUNTI (non bloccante) ─────────────────────────────────────────
export interface NeoAlert { day: number; repartoId: string; turno: TurnoLavoro; neo: number; nomi: string[]; }
export function checkNeoassunti(ctx: EngineContext, piano: Piano): NeoAlert[] {
  const dim = daysInMonth(ctx.year, ctx.month);
  const cls: Record<string, OperatorClass> = {};
  for (const s of ctx.staff) cls[s.id] = classifyOperator(s).categoria;
  const senior = (c: OperatorClass) => c === 'Senior' || c === 'Esperto' || c === 'Referente';
  const out: NeoAlert[] = [];
  for (const rep of ctx.reparti) {
    for (let d = 1; d <= dim; d++) {
      for (const t of ['M', 'P', 'N'] as TurnoLavoro[]) {
        const team = ctx.staff.filter((s) => { const c = piano[s.id] && piano[s.id][d]; return c && c.turno === t && c.repartoId === rep.id; });
        const neo = team.filter((s) => cls[s.id] === 'Neoassunto');
        const hasSenior = team.some((s) => senior(cls[s.id]));
        if (neo.length >= 2 && !hasSenior) out.push({ day: d, repartoId: rep.id, turno: t, neo: neo.length, nomi: neo.map((s) => s.nome) });
      }
    }
  }
  return out;
}

// ── NORMATIVA LOCALE (offline) — sintesi accurate e generali ─────────────────
export interface NormaTopic { id: string; titolo: string; keywords: string[]; testo: string; }
export const NORMATIVA: NormaTopic[] = [
  { id: 'riposo11', titolo: 'Riposo minimo 11 ore', keywords: ['11 ore', 'riposo', 'riposo minimo', 'd.lgs 66', 'dlgs 66', '66/2003'],
    testo: 'Il D.Lgs 66/2003 (e il CCNL Sanità) prevede almeno 11 ore di riposo consecutivo ogni 24 ore tra la fine di un turno e l\u2019inizio del successivo. TURNOVER tratta questo limite come inviolabile e blocca la pubblicazione se violato.' },
  { id: 'notte', titolo: 'Recupero post-notte e smonto', keywords: ['smonto', 'recupero', 'post-notte', 'dopo la notte', 'dopo notte', 'notturno seguito'],
    testo: 'Dopo il turno di notte è previsto il riposo compensativo: il giorno immediatamente successivo (smonto) non è lavorabile e NON può essere usato per la copertura. I riposi reali seguono lo smonto. In TURNOVER questo è un vincolo assoluto.' },
  { id: 'maxconsec', titolo: 'Giorni consecutivi', keywords: ['consecutiv', 'troppi giorni', 'di fila', 'massimo giorni'],
    testo: 'Va evitato un numero eccessivo di giornate lavorative consecutive. TURNOVER applica il limite di 6 giorni consecutivi di lavoro.' },
  { id: 'notturno', titolo: 'Lavoro notturno', keywords: ['lavoro notturno', 'notti consentite', 'puo fare notti', 'idoneo notti', 'idoneità notte'],
    testo: 'Il lavoro notturno è soggetto a tutele specifiche (limiti e sorveglianza sanitaria). Alcune categorie (es. per condizioni di salute, ruolo di coordinamento, gravidanza) possono esserne esentate: TURNOVER rispetta le esenzioni notti.' },
  { id: 'ferie', titolo: 'Ferie', keywords: ['ferie', 'congedo ordinario'],
    testo: 'Le ferie sono un diritto irrinunciabile; la pianificazione deve garantirne il godimento assicurando la continuità del servizio. In TURNOVER le ferie sono gestite come assenze e la copertura viene ricalcolata.' },
  { id: 'l104', titolo: 'Permessi Legge 104', keywords: ['104', 'legge 104', 'permesso assistenza'],
    testo: 'I permessi ex Legge 104/1992 per l\u2019assistenza a familiari con disabilità sono tutelati e vanno considerati tra le assenze nella pianificazione.' },
  { id: 'maternita', titolo: 'Maternità', keywords: ['maternit', 'gravidanza', 'gestazione', 'puerperio'],
    testo: 'In gravidanza e nei periodi tutelati si applicano specifiche protezioni, tra cui il divieto di lavoro notturno nei termini previsti dalla legge.' },
  { id: 'infermiere', titolo: 'Profilo professionale infermiere', keywords: ['profilo infermiere', 'dm 739', 'mansioni infermiere', 'cosa fa infermiere'],
    testo: 'Il profilo professionale dell\u2019infermiere (DM 739/1994) ne definisce autonomia e responsabilità nell\u2019assistenza infermieristica, in coerenza con il codice deontologico.' },
  { id: 'oss', titolo: 'Profilo OSS', keywords: ['oss', 'operatore socio sanitario', 'profilo oss'],
    testo: 'L\u2019OSS opera in supporto all\u2019assistenza secondo il proprio profilo, in collaborazione con l\u2019infermiere e sotto la sua supervisione per le attività delegate.' },
  { id: 'coordinatore', titolo: 'Ruolo del coordinatore', keywords: ['coordinatore', 'caposala', 'coordinamento'],
    testo: 'Il Coordinatore infermieristico ha funzioni organizzative e gestionali. In TURNOVER è esente da notti, weekend e festivi (configurabile) e lavora di norma in giornata feriale.' },
];
export function normaLookup(q: string): NormaTopic | null {
  const s = q.toLowerCase();
  for (const n of NORMATIVA) if (n.keywords.some((k) => s.indexOf(k) >= 0)) return n;
  return null;
}

// ── ASSISTENTE COORDINATORE AI (offline, su dati reali) ──────────────────────
export interface AssistantAnswer { intent: string; answer: string; items?: { nome: string; valore: string }[]; }
interface OpStat { id: string; nome: string; notti: number; weekend: number; festivi: number; ore: number; assenze: number; maxRun: number; }
function opStats(ctx: EngineContext, piano: Piano): OpStat[] {
  const dim = daysInMonth(ctx.year, ctx.month);
  return ctx.staff.map((s) => {
    const p = piano[s.id] || {}; let notti = 0, weekend = 0, festivi = 0, ore = 0, assenze = 0, run = 0, maxRun = 0;
    for (let d = 1; d <= dim; d++) {
      const c = p[d]; if (!c) { run = 0; continue; }
      if (c.turno === 'N') notti++;
      if (c.turno === 'F') assenze++;
      if (isWork(c.turno)) {
        run++; if (run > maxRun) maxRun = run;
        if (isWeekend(ctx.year, ctx.month, d)) weekend++;
        if (isHoliday(ctx.year, ctx.month, d)) festivi++;
        const o = c.repartoId ? (getRep(ctx.reparti, c.repartoId)?.orari || STD_ORARI) : STD_ORARI;
        ore += shiftHours(c.turno, o);
      } else run = 0;
    }
    return { id: s.id, nome: s.nome, notti, weekend, festivi, ore, assenze, maxRun };
  });
}
function topBy(stats: OpStat[], key: keyof OpStat, asc: boolean) {
  const arr = stats.slice().sort((a, b) => (asc ? (a[key] as number) - (b[key] as number) : (b[key] as number) - (a[key] as number)) || a.nome.localeCompare(b.nome));
  return arr;
}
export interface RequestAssessment { approvabile: boolean; coperturaPrima: number; coperturaResidua: number; sostituto: string | null; impatto: 'basso' | 'medio' | 'critico'; nota: string; }

// Valutazione AI di una singola richiesta: simula l'assenza del richiedente nei giorni
// richiesti e misura la copertura residua reale, proponendo un sostituto. (Fase 9 multiutente)
export function assessRequest(ctx: EngineContext, piano: Piano, req: ApprovalRequest): RequestAssessment {
  const end = req.to && req.to >= req.day ? req.to : req.day;
  const sim = cloneDeep(piano);
  if (sim[req.infId]) for (let d = req.day; d <= end; d++) if (sim[req.infId][d]) sim[req.infId][d] = { ...sim[req.infId][d], turno: 'F', settore: null };
  const coperturaPrima = computeCoverage(ctx, piano).globalPct;
  const coperturaResidua = computeCoverage(ctx, sim).globalPct;
  let sostituto: string | null = null;
  for (let d = req.day; d <= end && !sostituto; d++) {
    const cell = piano[req.infId] && piano[req.infId][d];
    if (cell && isWork(cell.turno) && cell.settore && cell.repartoId) {
      const rep = getRep(ctx.reparti, cell.repartoId);
      if (rep) for (const cand of ctx.staff) {
        if (cand.id === req.infId) continue;
        const occ = sim[cand.id] && sim[cand.id][d];
        const libero = !occ || occ.turno === 'R';
        if (!libero) continue;
        const ev = evalCandidate(ctx, sim, cand, d, cell.turno, rep, cell.settore);
        if (ev) { sostituto = cand.nome; break; }
      }
    }
  }
  const impatto: 'basso' | 'medio' | 'critico' = coperturaResidua >= 90 ? 'basso' : coperturaResidua >= 80 ? 'medio' : 'critico';
  const approvabile = coperturaResidua >= 85;
  const nota = approvabile
    ? `Richiesta approvabile. Copertura residua ${coperturaResidua}%.` + (sostituto ? ` Sostituto consigliato: ${sostituto}.` : '') + ' Impatto ' + impatto + '.'
    : `Richiesta critica: la copertura scenderebbe al ${coperturaResidua}%.` + (sostituto ? ` Possibile sostituto: ${sostituto}.` : ' Valuta un\u2019altra data.');
  return { approvabile, coperturaPrima, coperturaResidua, sostituto, impatto, nota };
}

// Copertura di un singolo giorno (% slot-settore coperti). Usa il contesto già risolto.
function dayCoverage(ctx: EngineContext, piano: Piano, day: number): number {
  let req = 0, cov = 0;
  for (const rep of ctx.reparti) {
    (['M', 'P', 'N'] as TurnoLavoro[]).forEach((t) => {
      const ns = rep.settori[t] || 0;
      for (let sn = 1; sn <= ns; sn++) {
        req++; const code = secCode(t, rep.sigla, sn); let filled = false;
        for (const inf of ctx.staff) { if (!countsInCoverage(inf)) continue; const c = piano[inf.id] && piano[inf.id][day]; if (c && isWork(c.turno) && c.settore === code) { filled = true; break; } }
        if (filled) cov++;
      }
    });
  }
  return req ? Math.round((cov / req) * 100) : 100;
}

function nightSpread(ctx: EngineContext, piano: Piano): number {
  const dim = daysInMonth(ctx.year, ctx.month); const counts: number[] = [];
  for (const inf of ctx.staff) { if (!countsInCoverage(inf)) continue; const p = piano[inf.id]; if (!p) continue; let n = 0; for (let d = 1; d <= dim; d++) if (p[d] && p[d].turno === 'N') n++; counts.push(n); }
  if (counts.length < 2) return 0; const m = counts.reduce((a, b) => a + b, 0) / counts.length;
  return Math.sqrt(counts.reduce((a, b) => a + (b - m) * (b - m), 0) / counts.length);
}

export type ScenarioType = 'ferie' | 'malattia' | 'assunzione' | 'dimissione' | 'chiusuraSettore' | 'aperturaSettore' | 'postiLettoUp' | 'postiLettoDown';
export interface ScenarioInput { tipo: ScenarioType; infId?: string; dayFrom?: number; dayTo?: number; repId?: string; turn?: TurnoLavoro; nuovoInf?: Partial<Staff>; delta?: number; }
export interface ScenarioResult { coperturaAttuale: number; coperturaPrevista: number; giorniCritici: number; turniScoperti: number; impatto: 'basso' | 'medio' | 'alto'; sostituti: { infId: string; nome: string }[]; vincoli: string[]; stazioniScoperte: string[]; indiceSicurezzaPrima: number; indiceSicurezzaDopo: number; postazioniRecuperate: string[]; postazioniPerse: string[]; nota: string; }

// Simulatore di scenario: applica una modifica TEMPORANEA e misura l'impatto sulla copertura,
// SENZA toccare il piano reale. (Fasi 4-5)
export function simulateScenario(ctx: EngineContext, piano: Piano, sc: ScenarioInput): ScenarioResult {
  const rctx = resolveSeasonalOps(ctx);
  const dim = daysInMonth(rctx.year, rctx.month);
  const coperturaAttuale = computeCoverage(rctx, piano).globalPct;
  let simCtx: EngineContext = rctx; let simPiano: Piano = cloneDeep(piano);
  const vincoli: string[] = []; const sostituti: { infId: string; nome: string }[] = [];
  const from = sc.dayFrom || 1; const to = sc.dayTo && sc.dayTo >= from ? sc.dayTo : (sc.dayFrom || dim);

  if (sc.tipo === 'ferie' || sc.tipo === 'malattia') {
    if (sc.infId && simPiano[sc.infId]) for (let d = from; d <= to; d++) if (simPiano[sc.infId][d]) simPiano[sc.infId][d] = { ...simPiano[sc.infId][d], turno: 'F', settore: null };
    // sostituti per i settori lasciati scoperti
    for (let d = from; d <= to && sostituti.length < 3; d++) {
      const cell = sc.infId ? (piano[sc.infId] && piano[sc.infId][d]) : null;
      if (cell && isWork(cell.turno) && cell.settore && cell.repartoId) {
        const rep = getRep(rctx.reparti, cell.repartoId);
        if (rep) for (const cand of rctx.staff) { if (cand.id === sc.infId) continue; if (sostituti.find((x) => x.infId === cand.id)) continue; const occ = simPiano[cand.id] && simPiano[cand.id][d]; if (occ && occ.turno !== 'R') continue; const ev = evalCandidate(rctx, simPiano, cand, d, cell.turno, rep, cell.settore); if (ev) { sostituti.push({ infId: cand.id, nome: cand.nome }); break; } }
      }
    }
  } else if (sc.tipo === 'chiusuraSettore' || sc.tipo === 'aperturaSettore') {
    const delta = (sc.delta || 1) * (sc.tipo === 'aperturaSettore' ? 1 : -1);
    const reparti = rctx.reparti.map((r) => { if (sc.repId && r.id !== sc.repId) return r; const t = sc.turn || 'M'; const cur = r.settori[t] || 0; return { ...r, settori: { ...r.settori, [t]: Math.max(0, cur + delta) } }; });
    simCtx = { ...rctx, reparti };
  } else if (sc.tipo === 'assunzione') {
    const nn: Staff = { id: 'sim_new', nome: (sc.nuovoInf && sc.nuovoInf.nome) || 'Nuovo operatore', qualifica: (sc.nuovoInf && sc.nuovoInf.qualifica) || 'Infermiere', contratto: (sc.nuovoInf && (sc.nuovoInf as any).contratto) || 'FT36', nottiPerCiclo: 2, offset: 0, reparti: (sc.nuovoInf && sc.nuovoInf.reparti) || (rctx.reparti[0] ? [rctx.reparti[0].id] : []), esenzioniTurni: [], esenzioniSettori: [], ...(sc.nuovoInf || {}) } as Staff;
    simCtx = { ...rctx, staff: [...rctx.staff, nn] };
    simPiano = buildPiano(simCtx, {}, false, {}, {}, true).piano;
  } else if (sc.tipo === 'dimissione') {
    simCtx = { ...rctx, staff: rctx.staff.filter((p) => p.id !== sc.infId) };
    simPiano = buildPiano(simCtx, {}, false, {}, {}, true).piano;
  } else if (sc.tipo === 'postiLettoUp' || sc.tipo === 'postiLettoDown') {
    vincoli.push('Variazione posti letto: impatto informativo (i posti letto non modificano la turnazione).');
  }

  const cov = computeCoverage(simCtx, simPiano);
  const coperturaPrevista = cov.globalPct;
  let giorniCritici = 0; for (let d = 1; d <= dim; d++) if (dayCoverage(simCtx, simPiano, d) < 100) giorniCritici++;
  const turniScoperti = cov.uncovered.length;
  const drop = coperturaAttuale - coperturaPrevista;
  const impatto: 'basso' | 'medio' | 'alto' = coperturaPrevista >= 90 && drop <= 3 ? 'basso' : coperturaPrevista >= 80 ? 'medio' : 'alto';
  if (coperturaPrevista < 85) vincoli.push('Rischio copertura insufficiente.');
  if (nightSpread(simCtx, simPiano) > 2.5) vincoli.push('Rischio sbilanciamento notti.');
  if (!vincoli.length) vincoli.push('Nessuna violazione rilevata.');
  const refDay = (sc.tipo === 'ferie' || sc.tipo === 'malattia') ? from : Math.min(15, dim);
  const stazioniScoperte = _stationsOnDay(simCtx, simPiano, refDay).filter((s) => s.status === 'rosso').map((s) => s.nome);
  const scBefore = stationCoverage(rctx, piano); const scAfter = stationCoverage(simCtx, simPiano);
  const wasRed: Record<string, boolean> = {}; scBefore.forEach((p) => { wasRed[p.repId + '|' + p.postazioneId] = p.status === 'rosso'; });
  const isRed: Record<string, boolean> = {}; scAfter.forEach((p) => { isRed[p.repId + '|' + p.postazioneId] = p.status === 'rosso'; });
  const nameOf: Record<string, string> = {}; scAfter.forEach((p) => { nameOf[p.repId + '|' + p.postazioneId] = p.nome; }); scBefore.forEach((p) => { nameOf[p.repId + '|' + p.postazioneId] = p.nome; });
  const postazioniRecuperate = Object.keys(wasRed).filter((k) => wasRed[k] && !isRed[k]).map((k) => nameOf[k]);
  const postazioniPerse = Object.keys(isRed).filter((k) => isRed[k] && !wasRed[k]).map((k) => nameOf[k]);
  const indiceSicurezzaPrima = safetyIndex(rctx, piano).score; const indiceSicurezzaDopo = safetyIndex(simCtx, simPiano).score;
  const nota = `Copertura ${coperturaAttuale}% → ${coperturaPrevista}% · sicurezza ${indiceSicurezzaPrima} → ${indiceSicurezzaDopo} · ${giorniCritici} giorni critici · ${turniScoperti} turni scoperti · impatto ${impatto}.`;
  return { coperturaAttuale, coperturaPrevista, giorniCritici, turniScoperti, impatto, sostituti, vincoli, stazioniScoperte, indiceSicurezzaPrima, indiceSicurezzaDopo, postazioniRecuperate, postazioniPerse, nota };
}

export interface DashboardData {
  coperturaMese: number; coperturaSettimana: number; coperturaOggi: number;
  ferieAttesa: number; ferieApprovate: number; ferieRespinte: number;
  criticita: string[];
  indicatori: { piuNotti?: string; piuWeekend?: string; piuFestivi?: string; piuOre?: string; menoOre?: string };
  distribuzione: { notti: { nome: string; val: number }[]; weekend: { nome: string; val: number }[]; festivi: { nome: string; val: number }[] };
  postazioni: StationCoverageItem[];
  indiceSicurezza: SafetyIndex;
  stagioneAttiva?: string;
}

// Dati reali per la Dashboard Coordinatore. (Fase 3)
export function dashboardData(ctx: EngineContext, piano: Piano, today = 1): DashboardData {
  const rctx = resolveSeasonalOps(ctx);
  const dim = daysInMonth(rctx.year, rctx.month);
  const d0 = Math.min(Math.max(1, today), dim);
  const coperturaMese = computeCoverage(rctx, piano).globalPct;
  const coperturaOggi = dayCoverage(rctx, piano, d0);
  const wkStart = Math.max(1, d0 - 3), wkEnd = Math.min(dim, d0 + 3); let ws = 0, wc = 0;
  for (let d = wkStart; d <= wkEnd; d++) { ws++; wc += dayCoverage(rctx, piano, d); }
  const coperturaSettimana = ws ? Math.round(wc / ws) : coperturaMese;
  const reqs = rctx.richieste || [];
  const ferieAttesa = reqs.filter((r) => r.stato === 'pending').length;
  const ferieApprovate = reqs.filter((r) => r.stato === 'approved').length;
  const ferieRespinte = reqs.filter((r) => r.stato === 'rejected').length;

  // conteggi per operatore
  const notti: Record<string, number> = {}, wknd: Record<string, number> = {}, fest: Record<string, number> = {}, ore: Record<string, number> = {};
  const nomeOf = (id: string) => (rctx.staff.find((p) => p.id === id)?.nome) || id;
  for (const inf of rctx.staff) {
    if (!countsInCoverage(inf)) continue; const p = piano[inf.id]; if (!p) continue;
    let n = 0, w = 0, f = 0, h = 0;
    const rep = getRep(rctx.reparti, (inf.reparti || [])[0] || '');
    for (let d = 1; d <= dim; d++) { const c = p[d]; if (!c) continue; if (c.turno === 'N') n++; if (isWork(c.turno)) { if (isWeekend(rctx.year, rctx.month, d)) w++; if (isHoliday(rctx.year, rctx.month, d)) f++; h += shiftHours(c.turno, rep ? rep.orari : undefined); } }
    notti[inf.id] = n; wknd[inf.id] = w; fest[inf.id] = f; ore[inf.id] = h;
  }
  const top = (m: Record<string, number>, max = true) => { const k = Object.keys(m); if (!k.length) return undefined; k.sort((a, b) => max ? m[b] - m[a] : m[a] - m[b]); return nomeOf(k[0]); };
  const indicatori = { piuNotti: top(notti), piuWeekend: top(wknd), piuFestivi: top(fest), piuOre: top(ore), menoOre: top(ore, false) };
  const arr = (m: Record<string, number>) => Object.keys(m).map((id) => ({ nome: nomeOf(id), val: m[id] })).sort((a, b) => b.val - a.val).slice(0, 12);
  const distribuzione = { notti: arr(notti), weekend: arr(wknd), festivi: arr(fest) };

  // criticità
  const criticita: string[] = [];
  const stationsAgg = stationCoverage(rctx, piano);
  const critRed = stationsAgg.filter((p) => p.priorita === 'critica' && p.rosso > 0);
  if (critRed.length) criticita.push(`${critRed.length} postazioni critiche scoperte in alcuni giorni: ${critRed.map((p) => p.nome).join(', ')}`);
  let scoperti = 0; for (let d = 1; d <= dim; d++) if (dayCoverage(rctx, piano, d) < 100) scoperti++;
  if (scoperti) criticita.push(`${scoperti} giorni con copertura sotto il 100%`);
  if (coperturaMese < 90) criticita.push(`Copertura mensile bassa (${coperturaMese}%)`);
  if (nightSpread(rctx, piano) > 2.5) criticita.push('Carico notti sbilanciato fra gli operatori');
  const neo = rctx.staff.filter((p) => countsInCoverage(p) && ((p as any).anniEsperienza != null ? (p as any).anniEsperienza < 1 : false));
  if (neo.length >= 2) criticita.push(`${neo.length} neoassunti in organico: verificare gli abbinamenti`);
  const oreMax = Object.keys(ore).filter((id) => ore[id] > 180);
  if (oreMax.length) criticita.push(`${oreMax.length} operatori oltre soglia ore nel mese`);
  if (!criticita.length) criticita.push('Nessuna criticità rilevante');

  let stagioneAttiva: string | undefined;
  const sr = rctx.reparti.find((r) => r.matrice === 'STAGIONALE' && r.seasonal);
  if (sr && sr.seasonal) { const s = seasonForDay(sr.seasonal, rctx.month, d0); if (s) stagioneAttiva = s; }

  return { coperturaMese, coperturaSettimana, coperturaOggi, ferieAttesa, ferieApprovate, ferieRespinte, criticita, indicatori, distribuzione, postazioni: stationsAgg, indiceSicurezza: safetyIndex(rctx, piano), stagioneAttiva };
}

// Suggerimenti proattivi: l'AI propone senza che l'utente chieda. (Fase 7)
export function proactiveSuggestions(ctx: EngineContext, piano: Piano): string[] {
  const rctx = resolveSeasonalOps(ctx); const out: string[] = [];
  const reqs = (rctx.richieste || []).filter((r) => r.stato === 'pending');
  for (const r of reqs.slice(0, 5)) { const a = assessRequest(rctx, piano, r); const nome = (rctx.staff.find((p) => p.id === r.infId)?.nome) || r.infId; out.push(a.approvabile ? `Conviene approvare la richiesta di ${nome} (copertura residua ${a.coperturaResidua}%).` : `Attenzione: la richiesta di ${nome} è critica (copertura ${a.coperturaResidua}%).`); }
  const dim = daysInMonth(rctx.year, rctx.month);
  for (let d = 1; d <= dim; d++) { if (dayCoverage(rctx, piano, d) < 80) { out.push(`Il reparto sarà scoperto il giorno ${d}.`); break; } }
  const dd = dashboardData(rctx, piano);
  if (dd.indicatori.piuNotti && nightSpread(rctx, piano) > 2.5) out.push(`${dd.indicatori.piuNotti} ha accumulato troppe notti rispetto agli altri.`);
  if (dd.coperturaMese >= 95 && !reqs.length) out.push('Il mese è ben coperto e bilanciato.');
  if (!out.length) out.push('Nessun suggerimento: la pianificazione è in equilibrio.');
  return out;
}

// ── Postazioni operative: copertura assistenziale reale ──────────────────────
function isOSSRole(inf: Staff): boolean { return /\boss\b|socio.?sanitar|o\.?s\.?s/i.test(inf.qualifica || ''); }
function isSeniorRole(inf: Staff): boolean {
  if (inf.livello && (inf.livello === 'Senior' || inf.livello === 'Esperto' || inf.livello === 'Referente')) return true;
  if ((inf.anniEsperienza || 0) >= 5) return true;
  const cat = classifyOperator(inf).categoria; return cat === 'Senior' || cat === 'Esperto' || cat === 'Referente';
}
function isReferenteRole(inf: Staff): boolean {
  if (inf.livello === 'Referente') return true;
  if ((inf.competenze || []).some((c) => /referent/i.test(c.area || ''))) return true;
  return classifyOperator(inf).categoria === 'Referente';
}
// Idoneità a una postazione: ok = requisiti hard soddisfatti; full = anche i soft (senior/referente).
function eligibleForStation(inf: Staff, req: StationReq): { ok: boolean; full: boolean } {
  if (req.ruolo === 'oss' && !isOSSRole(inf)) return { ok: false, full: false };
  if (req.ruolo === 'infermiere' && (isOSSRole(inf) || isCoordinator(inf))) return { ok: false, full: false };
  if (req.anniMin != null && (inf.anniEsperienza || 0) < req.anniMin) return { ok: false, full: false };
  let full = true;
  if (req.senior && !isSeniorRole(inf)) full = false;
  if (req.referente && !isReferenteRole(inf)) full = false;
  return { ok: true, full };
}
const PRIO_ORDER: Record<StationPriority, number> = { critica: 0, alta: 1, media: 2, bassa: 3 };

// Allocazione greedy delle postazioni di un turno: prima le priorità più alte.
function allocateShiftStations(rep: Reparto, pool: Staff[], shift: TurnoLavoro): Record<string, StationStatusKind> {
  const stations = (rep.postazioni || []).filter((s) => s.turni.indexOf(shift) >= 0).slice().sort((a, b) => PRIO_ORDER[a.priorita] - PRIO_ORDER[b.priorita]);
  const avail = pool.slice(); const res: Record<string, StationStatusKind> = {};
  for (const st of stations) {
    const need = st.quantita || 1; const req = st.requisiti || {}; let got = 0; let partial = false;
    for (let k = 0; k < need; k++) {
      let idx = avail.findIndex((inf) => { const e = eligibleForStation(inf, req); return e.ok && e.full; });
      if (idx < 0) { idx = avail.findIndex((inf) => eligibleForStation(inf, req).ok); if (idx >= 0) partial = true; }
      if (idx >= 0) { avail.splice(idx, 1); got++; }
    }
    res[st.id] = got >= need ? (partial ? 'giallo' : 'verde') : (got > 0 ? 'giallo' : 'rosso');
  }
  return res;
}
const worse = (a: StationStatusKind, b: StationStatusKind): StationStatusKind => { const r = { verde: 0, giallo: 1, rosso: 2 } as const; return r[a] >= r[b] ? a : b; };

// Stato di ogni postazione in un singolo giorno (ctx già risolto).
function _stationsOnDay(rctx: EngineContext, piano: Piano, day: number): { repId: string; postazioneId: string; nome: string; priorita: StationPriority; status: StationStatusKind }[] {
  const out: { repId: string; postazioneId: string; nome: string; priorita: StationPriority; status: StationStatusKind }[] = [];
  for (const rep of rctx.reparti) {
    if (!rep.postazioni || !rep.postazioni.length) continue;
    const poolByShift: Record<TurnoLavoro, Staff[]> = { M: [], P: [], N: [] };
    for (const inf of rctx.staff) {
      if (!countsInCoverage(inf)) continue; const c = piano[inf.id] && piano[inf.id][day]; if (!c || !isWork(c.turno)) continue;
      const inRep = c.repartoId === rep.id || (!c.repartoId && (inf.reparti || []).indexOf(rep.id) >= 0); if (!inRep) continue;
      poolByShift[c.turno as TurnoLavoro].push(inf);
    }
    const perShift: Record<TurnoLavoro, Record<string, StationStatusKind>> = { M: allocateShiftStations(rep, poolByShift.M, 'M'), P: allocateShiftStations(rep, poolByShift.P, 'P'), N: allocateShiftStations(rep, poolByShift.N, 'N') };
    for (const st of rep.postazioni) {
      let status: StationStatusKind | null = null;
      for (const t of st.turni) { const s = perShift[t][st.id]; if (s) status = status == null ? s : worse(status, s); }
      out.push({ repId: rep.id, postazioneId: st.id, nome: st.nome, priorita: st.priorita, status: status || 'verde' });
    }
  }
  return out;
}
export function stationsOnDay(ctx: EngineContext, piano: Piano, day: number) { return _stationsOnDay(resolveSeasonalOps(ctx), piano, day); }

// Penalità di copertura postazioni per un giorno (per l'ottimizzatore). Pesi per priorità.
const STATION_PRIO_W: Record<StationPriority, number> = { critica: 1000, alta: 120, media: 12, bassa: 2 };
function stationPenaltyDay(rctx: EngineContext, piano: Piano, day: number): number {
  let pen = 0;
  for (const s of _stationsOnDay(rctx, piano, day)) { if (s.status === 'rosso') pen += STATION_PRIO_W[s.priorita]; else if (s.status === 'giallo') pen += STATION_PRIO_W[s.priorita] * 0.3; }
  return pen;
}
function anyStations(ctx: EngineContext): boolean { return ctx.reparti.some((r) => r.postazioni && r.postazioni.length > 0); }

// Copertura assistenziale reale aggregata sul mese (per postazione).
export function stationCoverage(ctx: EngineContext, piano: Piano): StationCoverageItem[] {
  const rctx = resolveSeasonalOps(ctx); const dim = daysInMonth(rctx.year, rctx.month);
  const acc: Record<string, StationCoverageItem> = {};
  for (const rep of rctx.reparti) for (const st of rep.postazioni || []) acc[rep.id + '|' + st.id] = { repId: rep.id, repNome: rep.nome, postazioneId: st.id, nome: st.nome, priorita: st.priorita, status: 'verde', verde: 0, giallo: 0, rosso: 0, giorni: [] };
  for (let d = 1; d <= dim; d++) {
    const day = _stationsOnDay(rctx, piano, d);
    for (const s of day) { const key = s.repId + '|' + s.postazioneId; const it = acc[key]; if (!it) continue; it.giorni.push({ day: d, status: s.status }); if (s.status === 'verde') it.verde++; else if (s.status === 'giallo') it.giallo++; else it.rosso++; }
  }
  const out = Object.keys(acc).map((k) => acc[k]);
  for (const it of out) it.status = it.rosso > 0 ? 'rosso' : it.giallo > 0 ? 'giallo' : 'verde';
  return out;
}

// Indice di sicurezza assistenziale (0-100) — Dashboard direzionale.
export interface SafetyIndex { score: number; livello: 'sicuro' | 'attenzione' | 'critico'; dettaglio: string[]; }
export function safetyIndex(ctx: EngineContext, piano: Piano): SafetyIndex {
  const rctx = resolveSeasonalOps(ctx);
  const sc = stationCoverage(rctx, piano);
  const dettaglio: string[] = [];
  const crit = sc.filter((p) => p.priorita === 'critica');
  const alte = sc.filter((p) => p.priorita === 'alta');
  const ratio = (arr: StationCoverageItem[]) => { if (!arr.length) return 1; let g = 0, t = 0; for (const p of arr) { g += p.verde + p.giallo * 0.5; t += p.verde + p.giallo + p.rosso; } return t ? g / t : 1; };
  const critR = ratio(crit), alteR = ratio(alte);
  // presenza media senior/OSS sui giorni
  const dim = daysInMonth(rctx.year, rctx.month);
  let seniorDays = 0, ossDays = 0;
  for (let d = 1; d <= dim; d++) { let hs = false, ho = false; for (const inf of rctx.staff) { if (!countsInCoverage(inf)) continue; const c = piano[inf.id] && piano[inf.id][d]; if (!c || !isWork(c.turno)) continue; if (isSeniorRole(inf)) hs = true; if (isOSSRole(inf)) ho = true; } if (hs) seniorDays++; if (ho) ossDays++; }
  const seniorR = dim ? seniorDays / dim : 1, ossR = dim ? ossDays / dim : 1;
  const openCrit = crit.reduce((a, p) => a + p.rosso, 0);
  let score = Math.round(critR * 45 + alteR * 25 + seniorR * 15 + ossR * 15);
  score = Math.max(0, Math.min(100, score - Math.min(20, openCrit)));
  if (critR < 1) dettaglio.push(`Postazioni critiche non sempre coperte (${Math.round(critR * 100)}%)`);
  if (seniorR < 0.9) dettaglio.push(`Senior assente in alcuni giorni (${Math.round(seniorR * 100)}%)`);
  if (ossR < 0.9) dettaglio.push(`OSS assente in alcuni giorni (${Math.round(ossR * 100)}%)`);
  if (openCrit) dettaglio.push(`${openCrit} giorni-postazione critici scoperti`);
  if (!dettaglio.length) dettaglio.push('Tutti gli indicatori assistenziali nella norma');
  const livello: 'sicuro' | 'attenzione' | 'critico' = score >= 85 ? 'sicuro' : score >= 65 ? 'attenzione' : 'critico';
  return { score, livello, dettaglio };
}

// Garanzia di copertura minima (vincolo direzionale): segnala CRITICITÀ GRAVE se i minimi non sono rispettati.
export interface StationGuarantee { grave: boolean; problemi: string[]; }
export function stationGuarantee(ctx: EngineContext, piano: Piano): StationGuarantee {
  const rctx = resolveSeasonalOps(ctx); const dim = daysInMonth(rctx.year, rctx.month); const problemi: string[] = [];
  for (const rep of rctx.reparti) {
    const min = rep.minimi; if (!min) continue;
    let critBad = 0, alteBad = 0, ossBad = 0, infBad = 0;
    for (let d = 1; d <= dim; d++) {
      const day = _stationsOnDay(rctx, piano, d).filter((s) => s.repId === rep.id);
      const critCov = day.filter((s) => s.priorita === 'critica' && s.status !== 'rosso').length;
      const alteCov = day.filter((s) => s.priorita === 'alta' && s.status !== 'rosso').length;
      if (min.criticheMin != null && critCov < min.criticheMin) critBad++;
      if (min.alteMin != null && alteCov < min.alteMin) alteBad++;
      if (min.ossMin != null || min.infMin != null) {
        let oss = 0, inf = 0; for (const p of rctx.staff) { if (!countsInCoverage(p)) continue; const c = piano[p.id] && piano[p.id][d]; if (!c || !isWork(c.turno)) continue; const inRep = c.repartoId === rep.id || (!c.repartoId && (p.reparti || []).indexOf(rep.id) >= 0); if (!inRep) continue; if (isOSSRole(p)) oss++; else inf++; }
        if (min.ossMin != null && oss < min.ossMin) ossBad++;
        if (min.infMin != null && inf < min.infMin) infBad++;
      }
    }
    if (critBad) problemi.push(`${rep.nome}: postazioni critiche sotto il minimo in ${critBad} giorni`);
    if (alteBad) problemi.push(`${rep.nome}: postazioni alte sotto il minimo in ${alteBad} giorni`);
    if (ossBad) problemi.push(`${rep.nome}: OSS sotto il minimo in ${ossBad} giorni`);
    if (infBad) problemi.push(`${rep.nome}: infermieri sotto il minimo in ${infBad} giorni`);
  }
  return { grave: problemi.length > 0, problemi };
}

// Quanti infermieri senior mancano (giorni senza senior).
function seniorShortfall(ctx: EngineContext, piano: Piano): number {
  const rctx = resolveSeasonalOps(ctx); const dim = daysInMonth(rctx.year, rctx.month); let miss = 0;
  for (let d = 1; d <= dim; d++) { let hs = false; for (const inf of rctx.staff) { if (!countsInCoverage(inf)) continue; const c = piano[inf.id] && piano[inf.id][d]; if (c && isWork(c.turno) && isSeniorRole(inf)) { hs = true; break; } } if (!hs) miss++; }
  return miss;
}
// Spiega perché un giorno è scoperto, usando ESCLUSIVAMENTE i dati reali inseriti
// (operatori, ferie, malattie/permessi via motivo, postazioni, reparti). Nessun nome di esempio.
export interface WhyUncovered { day: number; copertura: number; mancano: string[]; postazioniScoperte: string[]; cause: { nome: string; motivo: string }[]; causeStrutturali: string[]; soluzioni: string[]; }
// Previsione scoperture sui prossimi giorni (7/14/30). Riporta solo i giorni a rischio medio/alto.
export interface ForecastRisk { day: number; livello: 'basso' | 'medio' | 'alto'; copertura: number; postazioniScoperte: string[]; motivi: string[]; }
export function forecastCoverage(ctx: EngineContext, piano: Piano, horizon = 7, fromDay = 1): ForecastRisk[] {
  const rctx = resolveSeasonalOps(ctx); const dim = daysInMonth(rctx.year, rctx.month);
  const start = Math.max(1, fromDay); const end = Math.min(dim, start + horizon - 1); const out: ForecastRisk[] = [];
  for (let d = start; d <= end; d++) {
    const cov = dayCoverage(rctx, piano, d); const day0 = _stationsOnDay(rctx, piano, d);
    const critRed = day0.filter((s) => s.priorita === 'critica' && s.status === 'rosso');
    const highRed = day0.filter((s) => s.priorita === 'alta' && s.status === 'rosso');
    const anyRed = day0.filter((s) => s.status === 'rosso');
    let livello: 'basso' | 'medio' | 'alto' = 'basso';
    if (critRed.length || cov < 80) livello = 'alto'; else if (highRed.length || anyRed.length || cov < 95) livello = 'medio';
    if (livello === 'basso') continue;
    const motivi: string[] = [];
    const fer = (rctx.ferie || []).filter((f) => f.month === rctx.month && f.year === rctx.year && d >= f.from && d <= f.to);
    if (fer.length) motivi.push(`${fer.length} assenze approvate`);
    let hasSenior = false; for (const inf of rctx.staff) { if (countsInCoverage(inf)) { const c = piano[inf.id] && piano[inf.id][d]; if (c && isWork(c.turno) && isSeniorRole(inf)) { hasSenior = true; break; } } }
    if (!hasSenior) motivi.push('nessun senior in servizio');
    if (anyRed.length) motivi.push(`${anyRed.length} postazioni a rischio`);
    if (!motivi.length) motivi.push(`copertura ${cov}%`);
    out.push({ day: d, livello, copertura: cov, postazioniScoperte: anyRed.map((s) => s.nome), motivi });
  }
  return out;
}

// Cause strutturali (non solo assenze giornaliere).
export function structuralCauses(ctx: EngineContext, piano: Piano): string[] {
  const rctx = resolveSeasonalOps(ctx); const dim = daysInMonth(rctx.year, rctx.month); const out: string[] = [];
  let sum = 0; for (let d = 1; d <= dim; d++) sum += dayCoverage(rctx, piano, d); const avg = Math.round(sum / dim);
  const assistivi = rctx.staff.filter((s) => countsInCoverage(s)).length;
  if (avg < 90) out.push(`Organico sottodimensionato (copertura media ${avg}%)`);
  const ferieByDay = new Array(dim + 1).fill(0); for (const f of rctx.ferie || []) if (f.month === rctx.month && f.year === rctx.year) for (let d = Math.max(1, f.from); d <= Math.min(dim, f.to); d++) ferieByDay[d]++;
  const maxConc = ferieByDay.slice(1).reduce((a, b) => Math.max(a, b), 0);
  if (assistivi && maxConc / assistivi > 0.2) out.push('Troppe assenze concentrate negli stessi giorni');
  const seniorN = rctx.staff.filter((s) => countsInCoverage(s) && isSeniorRole(s)).length;
  if (assistivi && seniorN / assistivi < 0.2) out.push('Pochi operatori senior in organico');
  const ossN = rctx.staff.filter((s) => isOSSRole(s)).length;
  if (rctx.reparti.some((r) => (r.postazioni || []).some((p) => p.requisiti && p.requisiti.ruolo === 'oss')) && ossN === 0) out.push('Nessun OSS in organico, ma richiesto dalle postazioni');
  if (nightSpread(rctx, piano) > 2.5) out.push('Distribuzione delle notti squilibrata fra gli operatori');
  if (!out.length) out.push('Nessuna criticità strutturale evidente');
  return out;
}

// Fragilità per reparto (giorni-postazione scoperti pesati per priorità + bassa copertura).
export function repartoFragility(ctx: EngineContext, piano: Piano): { repId: string; nome: string; score: number }[] {
  const rctx = resolveSeasonalOps(ctx); const dim = daysInMonth(rctx.year, rctx.month);
  const acc: Record<string, number> = {}; rctx.reparti.forEach((r) => { acc[r.id] = 0; });
  for (let d = 1; d <= dim; d++) for (const s of _stationsOnDay(rctx, piano, d)) { if (s.status === 'rosso') acc[s.repId] = (acc[s.repId] || 0) + STATION_PRIO_W[s.priorita]; else if (s.status === 'giallo') acc[s.repId] = (acc[s.repId] || 0) + STATION_PRIO_W[s.priorita] * 0.3; }
  return rctx.reparti.map((r) => ({ repId: r.id, nome: r.nome, score: Math.round(acc[r.id] || 0) })).sort((a, b) => b.score - a.score);
}

export function whyUncovered(ctx: EngineContext, piano: Piano, day?: number): WhyUncovered {
  const rctx = resolveSeasonalOps(ctx); const dim = daysInMonth(rctx.year, rctx.month);
  let d = day && day >= 1 && day <= dim ? day : 0;
  if (!d) { let worst = 1, wc = 101; for (let x = 1; x <= dim; x++) { const c = dayCoverage(rctx, piano, x); if (c < wc) { wc = c; worst = x; } } d = worst; }
  const copertura = dayCoverage(rctx, piano, d);
  const cause: { nome: string; motivo: string }[] = [];
  for (const inf of rctx.staff) {
    if (!countsInCoverage(inf)) continue;
    const c = piano[inf.id] && piano[inf.id][d];
    if (c && c.turno === 'F') {
      let motivo = 'assenza';
      const fer = (rctx.ferie || []).find((f) => f.infId === inf.id && f.month === rctx.month && f.year === rctx.year && d >= f.from && d <= f.to);
      if (fer && fer.motivo) motivo = fer.motivo; else if (fer) motivo = 'ferie';
      cause.push({ nome: inf.nome, motivo });
    }
  }
  const day0 = _stationsOnDay(rctx, piano, d);
  const postazioniScoperte = day0.filter((s) => s.status === 'rosso').map((s) => s.nome);
  let mancaInf = 0, mancaOss = 0, mancaGen = 0;
  for (const rep of rctx.reparti) for (const st of (rep.postazioni || [])) { const s = day0.find((x) => x.repId === rep.id && x.postazioneId === st.id); if (s && s.status === 'rosso') { const r = st.requisiti && st.requisiti.ruolo; if (r === 'oss') mancaOss++; else if (r === 'infermiere') mancaInf++; else mancaGen++; } }
  const mancano: string[] = [];
  if (mancaInf) mancano.push(`${mancaInf} infermieri`); if (mancaOss) mancano.push(`${mancaOss} OSS`); if (mancaGen) mancano.push(`${mancaGen} operatori`);
  const soluzioni: string[] = [];
  for (const s of day0.filter((x) => x.status === 'rosso')) {
    const nome = substituteForStation(rctx, piano, s.repId, s.postazioneId, d);
    if (nome) soluzioni.push(`Assegnare ${nome} a ${s.nome}`);
  }
  if (soluzioni.length < 3) {
    for (const inf of rctx.staff) {
      if (soluzioni.length >= 3) break;
      if (!countsInCoverage(inf)) continue;
      const c = piano[inf.id] && piano[inf.id][d];
      if (c && c.turno === 'R') soluzioni.push(`Richiamare ${inf.nome} (a riposo)`);
    }
  }
  if (!soluzioni.length) soluzioni.push('Nessun operatore idoneo disponibile fra quelli inseriti: valutare un\u2019assunzione.');
  return { day: d, copertura, mancano, postazioniScoperte, cause, causeStrutturali: structuralCauses(rctx, piano), soluzioni };
}

// ── Correzione automatica delle criticità ────────────────────────────────────
export interface AutoFixAction { tipo: 'richiamo' | 'spostamento' | 'chiusura'; infId?: string; day: number; turno?: TurnoLavoro; repId: string; settore?: string; fromSettore?: string; postazioneId?: string; }
export interface AutoFixSolution { titolo: string; descrizione: string; operatori: string[]; turni: string[]; coperturaPrima: number; coperturaDopo: number; impattoEquita: 'nullo' | 'basso' | 'medio' | 'alto'; impattoFatigue: 'nullo' | 'basso' | 'medio' | 'alto'; impattoEconomico: 'nullo' | 'basso' | 'medio' | 'alto'; rischioLegale: 'assente' | 'attenzione' | 'critico'; azione: AutoFixAction; }

// Proposte di correzione (max 3), ordinate per guadagno di copertura. Nessuna soluzione viola
// i vincoli legali: i richiami sono validati con evalCandidate; gli spostamenti non cambiano i turni.
export function proposeAutoFix(ctx: EngineContext, piano: Piano, day?: number): AutoFixSolution[] {
  const rctx = resolveSeasonalOps(ctx); const dim = daysInMonth(rctx.year, rctx.month);
  let d = day && day >= 1 && day <= dim ? day : 0;
  if (!d) { let worst = 1, wc = 101; for (let x = 1; x <= dim; x++) { const c = dayCoverage(rctx, piano, x); if (c < wc) { wc = c; worst = x; } } d = worst; }
  const coperturaPrima = computeCoverage(rctx, piano).globalPct;
  const red = _stationsOnDay(rctx, piano, d).filter((s) => s.status !== 'verde').sort((a, b) => PRIO_ORDER[a.priorita] - PRIO_ORDER[b.priorita]);
  const nomeOf = (id: string) => (rctx.staff.find((p) => p.id === id)?.nome) || id;
  const sols: AutoFixSolution[] = [];
  const covAfter = (mutate: (p: Piano) => void): number => { const c = cloneDeep(piano); mutate(c); return computeCoverage(rctx, c).globalPct; };

  for (const target of red) {
    if (sols.length >= 3) break;
    const rep = getRep(rctx.reparti, target.repId); if (!rep) continue;
    const st = (rep.postazioni || []).find((x) => x.id === target.postazioneId); if (!st) continue;
    const shift = st.turni[0] || 'M'; const code = secCode(shift, rep.sigla, 1);

    // SOLUZIONE 1 — richiamo da riposo (validato legalmente)
    if (!sols.some((s) => s.azione.tipo === 'richiamo')) {
      for (const inf of rctx.staff) {
        if (!countsInCoverage(inf)) continue; const c = piano[inf.id] && piano[inf.id][d]; if (!(c && c.turno === 'R')) continue;
        if (!eligibleForStation(inf, st.requisiti || {}).ok) continue;
        const ev = evalCandidate(rctx, piano, inf, d, shift, rep, code); if (!ev) continue; // solo se LEGALE
        const dopo = covAfter((p) => { p[inf.id][d] = { ...p[inf.id][d], turno: shift, repartoId: rep.id, settore: code, autoFilled: true }; });
        sols.push({ titolo: 'Richiamo da riposo', descrizione: `Richiamare ${nomeOf(inf.id)} (a riposo) per coprire ${target.nome} nel turno ${shift}.`, operatori: [nomeOf(inf.id)], turni: [shift], coperturaPrima, coperturaDopo: dopo, impattoEquita: 'basso', impattoFatigue: 'basso', impattoEconomico: 'medio', rischioLegale: 'assente', azione: { tipo: 'richiamo', infId: inf.id, day: d, turno: shift, repId: rep.id, settore: code } });
        break;
      }
    }
    // SOLUZIONE 2 — spostamento interno (nessun cambio di turno → nessun rischio legale)
    if (!sols.some((s) => s.azione.tipo === 'spostamento')) {
      for (const inf of rctx.staff) {
        if (!countsInCoverage(inf)) continue; const c = piano[inf.id] && piano[inf.id][d];
        if (!(c && c.turno === shift && c.settore && c.settore !== code)) continue;
        if (!eligibleForStation(inf, st.requisiti || {}).ok) continue;
        const from = c.settore;
        const dopo = covAfter((p) => { p[inf.id][d] = { ...p[inf.id][d], settore: code, repartoId: rep.id }; });
        sols.push({ titolo: 'Spostamento interno', descrizione: `Spostare ${nomeOf(inf.id)} da ${from} a ${target.nome} (turno ${shift}).`, operatori: [nomeOf(inf.id)], turni: [shift], coperturaPrima, coperturaDopo: dopo, impattoEquita: 'nullo', impattoFatigue: 'nullo', impattoEconomico: 'nullo', rischioLegale: 'assente', azione: { tipo: 'spostamento', infId: inf.id, day: d, turno: shift, repId: rep.id, settore: code, fromSettore: from } });
        break;
      }
    }
  }
  // SOLUZIONE 3 — chiusura postazione (ultima risorsa, solo se nessuna soluzione assistenziale)
  if (sols.length === 0 && red.length) {
    const target = red[0];
    sols.push({ titolo: 'Chiusura postazione', descrizione: `Chiudere temporaneamente ${target.nome}: nessuna soluzione assistenziale disponibile fra il personale inserito.`, operatori: [], turni: [], coperturaPrima, coperturaDopo: coperturaPrima, impattoEquita: 'nullo', impattoFatigue: 'nullo', impattoEconomico: 'nullo', rischioLegale: 'assente', azione: { tipo: 'chiusura', day: d, repId: target.repId, postazioneId: target.postazioneId } });
  }
  return sols.sort((a, b) => (b.coperturaDopo - b.coperturaPrima) - (a.coperturaDopo - a.coperturaPrima)).slice(0, 3);
}

// Applica una soluzione al piano (richiamo/spostamento). La chiusura agisce sul reparto (gestita dalla UI).
export function applyAutoFix(ctx: EngineContext, piano: Piano, sol: AutoFixSolution): { piano: Piano; coperturaPrima: number; coperturaDopo: number } {
  const rctx = resolveSeasonalOps(ctx);
  const coperturaPrima = computeCoverage(rctx, piano).globalPct;
  const p = cloneDeep(piano); const a = sol.azione;
  if ((a.tipo === 'richiamo' || a.tipo === 'spostamento') && a.infId && p[a.infId] && p[a.infId][a.day]) {
    p[a.infId][a.day] = { ...p[a.infId][a.day], turno: a.turno || p[a.infId][a.day].turno, repartoId: a.repId, settore: a.settore || null, locked: true, autoFilled: true };
  }
  const coperturaDopo = computeCoverage(rctx, p).globalPct;
  return { piano: p, coperturaPrima, coperturaDopo };
}

export function substituteForStation(ctx: EngineContext, piano: Piano, repId: string, postazioneId: string, day: number, excludeId?: string): string | null {
  const rctx = resolveSeasonalOps(ctx); const rep = getRep(rctx.reparti, repId); if (!rep) return null;
  const st = (rep.postazioni || []).find((s) => s.id === postazioneId); if (!st) return null;
  const req = st.requisiti || {}; const shift = st.turni[0] || 'M';
  let partial: string | null = null;
  for (const inf of rctx.staff) {
    if (!countsInCoverage(inf) || inf.id === excludeId) continue;
    const e = eligibleForStation(inf, req); if (!e.ok) continue;
    const c = piano[inf.id] && piano[inf.id][day]; const libero = !c || c.turno === 'R' || c.turno === 'F';
    const ev = evalCandidate(rctx, piano, inf, day, shift, rep, secCode(shift, rep.sigla, 1));
    if (libero && ev) { if (e.full) return inf.nome; if (!partial) partial = inf.nome; }
  }
  return partial;
}

export function assistantQuery(ctx: EngineContext, piano: Piano, q: string): AssistantAnswer {
  const s = (q || '').toLowerCase().trim();
  // "perché sono scoperto oggi?" — analisi su DATI REALI (assenti, ferie/malattie via motivo, postazioni reali)
  if (/perch[ée]/.test(s) && /(scopert|scopert|manca|mancano|copert|buc)/.test(s)) {
    const md = s.match(/\b(\d{1,2})\b/); const w = whyUncovered(ctx, piano, md ? parseInt(md[1], 10) : undefined);
    const head = `Giorno ${w.day}: copertura ${w.copertura}%.` + (w.postazioniScoperte.length ? ` Postazioni scoperte: ${w.postazioniScoperte.join(', ')}.` : (w.copertura >= 100 ? ' Nessuna postazione scoperta.' : '')) + (w.cause.length ? '' : ' Nessun operatore risulta assente quel giorno.');
    const items = [...w.cause.map((c) => ({ nome: c.nome, valore: c.motivo })), ...w.soluzioni.map((x) => ({ nome: 'Soluzione', valore: x }))];
    return { intent: 'percheScoperto', answer: head, items };
  }
  // previsione scoperture future
  if (/(rischia di scoprirsi|cosa rischia|scoprirsi|criticità future|criticita future|previsione copertur|prossimi giorni)/.test(s)) {
    const hz = /(14|due settimane|quindici)/.test(s) ? 14 : /(mese|30|trenta)/.test(s) ? 31 : 7;
    const fc = forecastCoverage(ctx, piano, hz, 1);
    if (!fc.length) return { intent: 'forecast', answer: `Nessun rischio rilevante nei prossimi ${hz} giorni.`, items: [] };
    return { intent: 'forecast', answer: `${fc.length} giorni a rischio nei prossimi ${hz} giorni:`, items: fc.map((r) => ({ nome: `Giorno ${r.day} · ${r.livello}`, valore: (r.postazioniScoperte.join(', ') || (r.copertura + '%')) + ' — ' + r.motivi.join(', ') })) };
  }
  // proponi correzione / come aumentare la copertura
  if (/(proponi.*corre|correzione automatica|come correggere|come risolvere|aumentare la copertura|come aumentare|migliorare la copertura)/.test(s)) {
    const sols = proposeAutoFix(ctx, piano);
    if (!sols.length) return { intent: 'autofix', answer: 'Nessuna criticità da correggere: la copertura è adeguata.', items: [] };
    return { intent: 'autofix', answer: 'Proposte di correzione (ordinate per efficacia):', items: sols.map((x) => ({ nome: `${x.titolo} (${x.coperturaPrima}%→${x.coperturaDopo}%)`, valore: x.descrizione })) };
  }
  // applica correzione (l'applicazione effettiva avviene dalla UI con il pulsante "Applica")
  if (/(applica.*corre|applica la correzione)/.test(s)) {
    const sols = proposeAutoFix(ctx, piano);
    return { intent: 'autofixApply', answer: sols.length ? `Soluzione consigliata: ${sols[0].titolo}. ${sols[0].descrizione} Usa il pulsante «Applica» per confermare.` : 'Nessuna correzione necessaria.', items: [] };
  }
  // chi posso richiamare
  if (/(chi.*richiamare|chi posso richiamare)/.test(s)) {
    const w = whyUncovered(ctx, piano); const rich = w.soluzioni.filter((x) => /richiamare/i.test(x));
    return { intent: 'richiamo', answer: rich.length ? `Operatori richiamabili (giorno ${w.day}):` : 'Nessun operatore a riposo idoneo da richiamare.', items: rich.map((x) => ({ nome: x.replace('Richiamare ', '').replace(' (a riposo)', ''), valore: 'a riposo' })) };
  }
  // cosa manca oggi
  if (/(cosa manca|cosa serve oggi|che cosa manca)/.test(s)) {
    const w = whyUncovered(ctx, piano);
    return { intent: 'cosaManca', answer: `Giorno ${w.day}: copertura ${w.copertura}%.` + (w.mancano.length ? ` Mancano: ${w.mancano.join(', ')}.` : ' Nessuna carenza di postazioni.'), items: w.cause.map((c) => ({ nome: c.nome, valore: c.motivo })) };
  }
  // reparto più fragile
  if (/reparto/.test(s) && /(fragile|più critic|piu critic|più debole|piu debole)/.test(s)) {
    const fr = repartoFragility(ctx, piano);
    if (!fr.length || fr[0].score === 0) return { intent: 'repartoFragile', answer: 'Nessun reparto mostra fragilità rilevanti.', items: [] };
    return { intent: 'repartoFragile', answer: `Reparto più fragile: ${fr[0].nome} (indice ${fr[0].score}).`, items: fr.slice(0, 5).map((r) => ({ nome: r.nome, valore: String(r.score) })) };
  }
  // quale matrice genera più criticità
  if (/matric/.test(s) && /(critic|fragil|problem)/.test(s) && !/stagional/.test(s)) {
    const fr = repartoFragility(ctx, piano); const byMat: Record<string, number> = {};
    for (const r of fr) { const rep = ctx.reparti.find((x) => x.id === r.repId); const m = rep ? rep.matrice : '—'; byMat[m] = (byMat[m] || 0) + r.score; }
    const arr = Object.keys(byMat).map((m) => ({ m, v: byMat[m] })).sort((a, b) => b.v - a.v);
    if (!arr.length || arr[0].v === 0) return { intent: 'matriceCritica', answer: 'Nessuna matrice genera criticità rilevanti.', items: [] };
    return { intent: 'matriceCritica', answer: `Matrice associata a più criticità: ${arr[0].m} (indice ${arr[0].v}).`, items: arr.slice(0, 5).map((x) => ({ nome: x.m, valore: String(x.v) })) };
  }
  const stats = opStats(ctx, piano);
  const list = (arr: OpStat[], key: keyof OpStat, unit: string) => arr.slice(0, 5).map((o) => ({ nome: o.nome, valore: o[key] + ' ' + unit }));
  const least = /\b(meno|minor|piu pochi|pochi|fewest)\b/.test(s);
  const isAction = /(sostitu|rimpiazz|coprire|chi puo fare|chi può fare)/.test(s);
  const isNormaNotte = /(smonto|recupero|dopo la notte|dopo notte|11 ore)/.test(s);
  // quanti infermieri senior mancano
  if (/senior/.test(s) && /(manca|mancano|servono|quanti)/.test(s)) {
    const miss = seniorShortfall(ctx, piano);
    return { intent: 'seniorMancanti', answer: miss ? `Ci sono ${miss} giorni nel mese senza alcun infermiere senior in servizio.` : 'In ogni giorno del mese è presente almeno un infermiere senior.', items: [] };
  }
  // collo di bottiglia del reparto
  if (/(collo di bottiglia|bottleneck|punto debole|criticità maggiore)/.test(s)) {
    const sc = stationCoverage(ctx, piano);
    if (!sc.length) { const miss = seniorShortfall(ctx, piano); return { intent: 'bottleneck', answer: miss ? `Il collo di bottiglia è la presenza senior: ${miss} giorni senza senior.` : 'Nessun collo di bottiglia evidente sulle postazioni.', items: [] }; }
    const worst = sc.slice().sort((a, b) => (PRIO_ORDER[a.priorita] - PRIO_ORDER[b.priorita]) || ((b.rosso + b.giallo) - (a.rosso + a.giallo)))[0];
    return { intent: 'bottleneck', answer: `Collo di bottiglia: ${worst.nome} (${worst.repNome}, priorità ${worst.priorita}) — ${worst.rosso} giorni scoperti, ${worst.giallo} con criticità.`, items: [] };
  }
  // ── AI clinica: postazioni operative ─────────────────────────────────────
  if (/(postazion|copertura assistenzial|copertura reale|area monitorat|fast track|holding|triage)/.test(s)) {
    const sc = stationCoverage(ctx, piano);
    if (!sc.length) return { intent: 'postazioni', answer: 'Nessuna postazione operativa configurata nei reparti.', items: [] };
    // postazione che impedisce la pubblicazione (critica scoperta)
    if (/(impedisce|pubblic|bloccа|blocca)/.test(s)) {
      const block = sc.filter((p) => p.priorita === 'critica' && p.rosso > 0).sort((a, b) => b.rosso - a.rosso);
      return { intent: 'postazionePubblicazione', answer: block.length ? `Impedisce la pubblicazione: ${block[0].nome} (${block[0].repNome}) — critica scoperta in ${block[0].rosso} giorni.` : 'Nessuna postazione critica scoperta: nessun blocco alla pubblicazione lato postazioni.', items: block.slice(0, 6).map((p) => ({ nome: p.nome, valore: '🔴 ' + p.rosso + 'gg' })) };
    }
    // postazioni critiche non garantite
    if (/(critic)/.test(s) && /(garant|non.*copert|non.*garant)/.test(s)) {
      const ng = sc.filter((p) => p.priorita === 'critica' && p.status !== 'verde');
      return { intent: 'criticheNonGarantite', answer: ng.length ? `Postazioni critiche non garantite: ${ng.map((p) => p.nome).join(', ')}.` : 'Tutte le postazioni critiche sono garantite.', items: ng.map((p) => ({ nome: p.nome, valore: p.status === 'rosso' ? '🔴 ' + p.rosso + 'gg' : '🟡 ' + p.giallo + 'gg' })) };
    }
    // postazione che genera più criticità
    if (/genera/.test(s) || /criticità|criticita/.test(s)) {
      const worst = sc.slice().sort((a, b) => (b.rosso * 3 + b.giallo) - (a.rosso * 3 + a.giallo))[0];
      return { intent: 'postazionePiuCriticita', answer: `Genera più criticità: ${worst.nome} (${worst.repNome}) — ${worst.rosso} giorni scoperti, ${worst.giallo} con criticità.`, items: [] };
    }
    // sostituto per una postazione nominata
    if (/(sostitut|chi copre|chi può coprire)/.test(s)) {
      const named = sc.find((p) => s.indexOf(p.nome.toLowerCase()) >= 0) || sc.slice().sort((a, b) => PRIO_ORDER[a.priorita] - PRIO_ORDER[b.priorita])[0];
      const nome = substituteForStation(ctx, piano, named.repId, named.postazioneId, Math.min(15, daysInMonth(ctx.year, ctx.month)));
      return { intent: 'postazioneSostituto', answer: nome ? `Per «${named.nome}» può coprire: ${nome}.` : `Nessun sostituto idoneo per «${named.nome}».`, items: [] };
    }
    // più critica
    if (/(più critic|piu critic|critica|rischi)/.test(s)) {
      const problem = sc.filter((p) => p.status !== 'verde').sort((a, b) => PRIO_ORDER[a.priorita] - PRIO_ORDER[b.priorita] || b.rosso - a.rosso);
      if (!problem.length) return { intent: 'postazioneCritica', answer: 'Tutte le postazioni risultano coperte.', items: [] };
      const top = problem[0];
      return { intent: 'postazioneCritica', answer: `Postazione più a rischio: ${top.nome} (${top.repNome}, priorità ${top.priorita}) — ${top.rosso} giorni scoperti, ${top.giallo} con criticità.`, items: problem.slice(0, 8).map((p) => ({ nome: p.nome + ' · ' + p.priorita, valore: p.status === 'rosso' ? '🔴 ' + p.rosso + 'gg' : '🟡 ' + p.giallo + 'gg' })) };
    }
    // scoperte / stato generale
    const scop = sc.filter((p) => p.status === 'rosso');
    const items = sc.map((p) => ({ nome: p.nome + ' · ' + p.priorita, valore: p.status === 'verde' ? '🟢' : p.status === 'giallo' ? '🟡 ' + p.giallo + 'gg' : '🔴 ' + p.rosso + 'gg' }));
    return { intent: 'postazioniScoperte', answer: scop.length ? `${scop.length} postazioni con giorni scoperti: ${scop.map((p) => p.nome).join(', ')}.` : 'Nessuna postazione completamente scoperta nel mese.', items };
  }
  // ── scenario / simulazione operativa ─────────────────────────────────────
  if (/(se apro|se aggiungo|aprire un settore|apertura settore)/.test(s) && /settor/.test(s)) {
    const r = simulateScenario(ctx, piano, { tipo: 'aperturaSettore', delta: 1 });
    return { intent: 'scenarioApri', answer: 'Aprendo un settore in più: ' + r.nota, items: r.vincoli.map((v) => ({ nome: v, valore: '' })) };
  }
  if (/(se chiudo|chiudere un settore|chiusura settore)/.test(s) && /settor/.test(s)) {
    const r = simulateScenario(ctx, piano, { tipo: 'chiusuraSettore', delta: 1 });
    return { intent: 'scenarioChiudi', answer: 'Chiudendo un settore: ' + r.nota, items: r.vincoli.map((v) => ({ nome: v, valore: '' })) };
  }
  if (/(quanti operatori mancano|mancano per|arrivare al 100|per il 100|al 100%)/.test(s)) {
    const cov0 = computeCoverage(ctx, piano).globalPct;
    if (cov0 >= 100) return { intent: 'mancanti', answer: 'La copertura è già al 100%.', items: [] };
    const rctx = ctx; if (!rctx.reparti.length) return { intent: 'mancanti', answer: 'Nessun reparto configurato.', items: [] };
    let simStaff = [...rctx.staff]; let added = 0; let cov = cov0;
    while (cov < 100 && added < 8) { added++; simStaff = [...simStaff, { id: 'sim' + added, nome: 'Agg ' + added, qualifica: 'Infermiere', contratto: 'FT36', nottiPerCiclo: 2, offset: added, reparti: [rctx.reparti[0].id], esenzioniTurni: [], esenzioniSettori: [] } as Staff]; const sc = { ...rctx, staff: simStaff }; const pp = buildPiano(sc, {}, false, {}, {}, true).piano; cov = computeCoverage(sc, pp).globalPct; }
    return { intent: 'mancanti', answer: cov >= 100 ? `Servono circa ${added} operatori full-time aggiuntivi per arrivare al 100% (stima da simulazione, copertura attuale ${cov0}%).` : `Con ${added} operatori aggiuntivi la copertura arriva al ${cov}% (oltre serve più organico).`, items: [] };
  }
  if (/(chi posso assumere|chi assumere|assunzione|quale assunzione)/.test(s) && /(copertur|migliorar|sicurezza|maggiormente)/.test(s)) {
    const opts: { label: string; inf: Partial<Staff> }[] = [
      { label: 'infermiere senior', inf: { qualifica: 'Infermiere', livello: 'Senior', anniEsperienza: 8 } },
      { label: 'OSS', inf: { qualifica: 'OSS' } },
      { label: 'infermiere', inf: { qualifica: 'Infermiere', anniEsperienza: 3 } },
    ];
    let best: { label: string; gain: number; cov: number; prima: number; secPrima: number; secDopo: number } | null = null;
    for (const o of opts) { const r = simulateScenario(ctx, piano, { tipo: 'assunzione', nuovoInf: o.inf }); const gain = (r.indiceSicurezzaDopo - r.indiceSicurezzaPrima) * 2 + (r.coperturaPrevista - r.coperturaAttuale); if (!best || gain > best.gain) best = { label: o.label, gain, cov: r.coperturaPrevista, prima: r.coperturaAttuale, secPrima: r.indiceSicurezzaPrima, secDopo: r.indiceSicurezzaDopo }; }
    return { intent: 'assunzioneBest', answer: best ? `L'assunzione che migliora di più la copertura: ${best.label} — indice di sicurezza ${best.secPrima} → ${best.secDopo}, copertura ${best.prima}% → ${best.cov}%.` : 'Nessuna stima disponibile.', items: [] };
  }
  // ── matrici stagionali ───────────────────────────────────────────────────
  if (/(stagional|stagione|primavera|estate|autunno|inverno)/.test(s) || (/configurazione/.test(s) && /attiv/.test(s)) || (/(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/.test(s) && /matric/.test(s))) {
    const seasReps = ctx.reparti.filter((r) => r.matrice === 'STAGIONALE' && r.seasonal);
    if (seasReps.length) {
      const mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
      const pad = (n: number) => String(n).padStart(2, '0');
      const seasonNames: Season[] = ['primavera', 'estate', 'autunno', 'inverno'];
      const namedSeason = seasonNames.find((k) => s.indexOf(k) >= 0) || null;
      // stagione attiva
      if (/(stagione attiva|stagione è attiva|stagione e attiva|che stagione)/.test(s)) {
        const r0 = seasReps[0]; const act = seasonForDay(r0.seasonal, ctx.month, 15);
        return { intent: 'stagioneAttiva', answer: act ? `Stagione attiva (${r0.nome}): ${act} → matrice ${r0.seasonal[act].matrice}.` : 'Nessuna stagione attiva per il mese corrente.', items: [] };
      }
      // configurazione operativa attiva
      if (/(configurazione attiva|configurazione è attiva|configurazione e attiva|config attiva)/.test(s)) {
        const r0 = seasReps[0]; const act = seasonForDay(r0.seasonal, ctx.month, 15);
        const op = act && r0.seasonal[act] ? r0.seasonal[act].op : null;
        const items = op && op.settori ? (['M', 'P', 'N'] as TurnoLavoro[]).map((t) => ({ nome: 'Settori ' + t, valore: String(op.settori![t] != null ? op.settori![t] : '—') })) : [];
        return { intent: 'configAttiva', answer: act ? `Configurazione attiva (${r0.nome} · ${act})` + (op ? ':' : ': nessun override operativo, si usano i settori base del reparto.') : 'Nessuna stagione attiva.', items };
      }
      // settori chiusi in una stagione
      if (/(settor)/.test(s) && /(chius|chiud)/.test(s)) {
        const r0 = seasReps[0]; const sk = namedSeason || seasonForDay(r0.seasonal, ctx.month, 15);
        const op = sk && r0.seasonal[sk] ? r0.seasonal[sk].op : null;
        const chiusi = op && op.settoriChiusi != null ? op.settoriChiusi : 0;
        return { intent: 'settoriChiusi', answer: sk ? `Settori chiusi in ${sk} (${r0.nome}): ${chiusi}.` : 'Stagione non riconosciuta.', items: [] };
      }
      const mIdx = mesi.findIndex((m) => s.includes(m));
      if (mIdx >= 0) {
        const items = seasReps.map((r) => ({ nome: r.nome, valore: seasonalMatrice(r.seasonal, mIdx, 15) || '—' }));
        return { intent: 'stagionaleMese', answer: 'Matrice usata a ' + mesi[mIdx] + ':', items };
      }
      if (/operator/.test(s)) {
        const ops = ctx.staff.filter((p) => p.matrice === 'STAGIONALE' || (!p.matrice && seasReps.some((r) => (p.reparti || []).indexOf(r.id) >= 0)));
        return { intent: 'stagionaleOperatori', answer: ops.length + ' operatori usano matrici stagionali.', items: ops.slice(0, 40).map((p) => ({ nome: p.nome, valore: p.qualifica })) };
      }
      if (/(prossima|quando cambia)/.test(s)) {
        const starts: { s: string; key: number; mx: string }[] = [];
        for (const r of seasReps) { const cfg = r.seasonal; (['primavera', 'estate', 'autunno', 'inverno'] as const).forEach((k) => { if (cfg[k]) starts.push({ s: k, key: cfg[k].startMonth * 100 + cfg[k].startDay, mx: cfg[k].matrice }); }); }
        const nowKey = (ctx.month + 1) * 100 + 1;
        const future = starts.filter((x) => x.key > nowKey).sort((a, b) => a.key - b.key);
        const next = future.length ? future[0] : starts.sort((a, b) => a.key - b.key)[0];
        return { intent: 'stagionaleProssima', answer: next ? `Prossimo cambio: ${next.s} (${pad(next.key % 100)}/${pad(Math.floor(next.key / 100))}) → ${next.mx}.` : 'Nessuna stagione configurata.', items: [] };
      }
      const r0 = seasReps[0]; const cfg = r0.seasonal;
      const items = (['primavera', 'estate', 'autunno', 'inverno'] as const).filter((k) => cfg[k]).map((k) => ({ nome: k + ' · ' + cfg[k].matrice, valore: `${pad(cfg[k].startDay)}/${pad(cfg[k].startMonth)}–${pad(cfg[k].endDay)}/${pad(cfg[k].endMonth)}` }));
      return { intent: 'stagionaleConfig', answer: 'Configurazione stagionale · ' + r0.nome + ':', items };
    }
    return { intent: 'stagionale', answer: 'Nessun reparto con matrice stagionale configurata.', items: [] };
  }
  // ── richieste / desiderate (multiutente) ─────────────────────────────────
  if (/(richiest|in attesa|da approvare|conflitt|incompatibil|se approvo|chi ha chiesto|chi ha richiesto|combinazione)/.test(s)) {
    const reqs = ctx.richieste || [];
    const pend = reqs.filter((r) => r.stato === 'pending');
    const nomeOf = (id: string) => (ctx.staff.find((p) => p.id === id)?.nome) || id;
    const required = ctx.reparti.reduce((a, rep) => a + (rep.settori.M || 0) + (rep.settori.P || 0) + (rep.settori.N || 0), 0);
    const absentOn = (infId: string, d: number) => (ctx.ferie || []).some((f) => f.infId === infId && f.month === ctx.month && f.year === ctx.year && d >= f.from && d <= f.to);
    const availOn = (d: number) => ctx.staff.filter((p) => countsInCoverage(p) && !absentOn(p.id, d)).length;
    const conflictDays = (r: ApprovalRequest) => { const out: number[] = []; const end = r.to && r.to >= r.day ? r.to : r.day; for (let d = r.day; d <= end; d++) { if (availOn(d) - 1 < required) out.push(d); } return out; };
    if (/ferie/.test(s) && /(chi ha chiesto|chi ha richiesto|richiest)/.test(s)) {
      const fr = reqs.filter((r) => r.tipo === 'ferie');
      return { intent: 'reqFerie', answer: fr.length ? 'Richieste di ferie:' : 'Nessuna richiesta di ferie.', items: fr.map((r) => ({ nome: nomeOf(r.infId) + ' · g.' + (r.to && r.to > r.day ? r.day + '–' + r.to : r.day), valore: r.stato })) };
    }
    if (/(quant.*attesa|in attesa|da approvare|pending|quanti operator)/.test(s)) {
      return { intent: 'reqPending', answer: pend.length + ' richieste in attesa di approvazione.', items: pend.map((r) => ({ nome: nomeOf(r.infId), valore: requestLabel(r) })) };
    }
    // conflitti / incompatibili / "se approvo" / combinazione
    const withConf = pend.map((r) => ({ r, c: conflictDays(r) })).filter((x) => x.c.length > 0);
    if (/(combinazione|quale approvare|cosa approvare)/.test(s)) {
      const safe = pend.filter((r) => conflictDays(r).length === 0);
      return { intent: 'reqCombinazione', answer: safe.length ? 'Richieste approvabili senza compromettere la copertura:' : 'Nessuna richiesta approvabile senza rischio copertura.', items: safe.map((r) => ({ nome: nomeOf(r.infId), valore: requestLabel(r) })) };
    }
    return { intent: 'reqConflitti', answer: withConf.length ? 'Richieste a rischio copertura (approvarle lascerebbe giorni scoperti):' : 'Nessun conflitto di copertura tra le richieste in attesa.', items: withConf.map((x) => ({ nome: nomeOf(x.r.infId) + ' · ' + requestLabel(x.r), valore: 'giorni critici: ' + x.c.join(', ') })) };
  }
  // conteggio unità assistenziali (esclude coordinamento/supporto)
  if (/(unit[aà]|quante unit|personale assistenzial|quanti infermier|quanti oss|organico|quante persone|quanti present)/.test(s)) {
    const ass = ctx.staff.filter((p) => countsInCoverage(p));
    const sup = ctx.staff.filter((p) => !countsInCoverage(p));
    const byQ: Record<string, number> = {};
    for (const p of ass) { const q = p.qualifica || 'Infermiere'; byQ[q] = (byQ[q] || 0) + 1; }
    const items = Object.keys(byQ).map((q) => ({ nome: q, valore: String(byQ[q]) }));
    if (sup.length) { const bySup: Record<string, number> = {}; for (const p of sup) { const q = p.qualifica || 'Supporto'; bySup[q] = (bySup[q] || 0) + 1; } for (const q of Object.keys(bySup)) items.push({ nome: 'Escluso dal conteggio · ' + q, valore: String(bySup[q]) }); }
    return { intent: 'unitaAssistenziali', answer: 'Unità assistenziali totali: ' + ass.length + (sup.length ? ' (coordinamento/supporto escluso).' : '.'), items };
  }
  // classificazione: elenco operatori per livello ("chi è referente", "chi sono i neoassunti")
  const isClassQ = /(chi (e|è|sono)|quali sono|elenca|lista|mostra)/.test(s) || (/\bchi\b/.test(s) && !isAction);
  if (isClassQ && !/turn/.test(s)) {
    const classKw: [RegExp, OperatorClass][] = [[/referent/, 'Referente'], [/espert/, 'Esperto'], [/senior/, 'Senior'], [/junior/, 'Junior'], [/neoass|neo assunt|nuovi assunt/, 'Neoassunto']];
    for (const [re, cls] of classKw) {
      if (re.test(s)) {
        const ops = ctx.staff.filter((p) => classifyOperator(p).categoria === cls);
        return { intent: 'classe:' + cls, answer: ops.length ? ('Operatori classificati come ' + cls + ':') : ('Nessun operatore classificato come ' + cls + '.'), items: ops.map((p) => ({ nome: p.nome, valore: (classifyOperator(p).motivi[0] || '') })) };
      }
    }
  }
  // ranking metriche
  if (/(straordinari|overtime|sforament|ore in più|ore in piu|più ore|piu ore|monte ore)/.test(s)) { const a = topBy(stats, 'ore', least); return { intent: 'ore', answer: (least ? 'Operatori con meno ore:' : 'Operatori con più ore (carico/straordinari):'), items: list(a, 'ore', 'h') }; }
  if (!isAction && !isNormaNotte && /(notti|notte)/.test(s)) { const a = topBy(stats, 'notti', least); return { intent: 'notti', answer: (least ? 'Operatori con meno notti:' : 'Operatori con più notti:'), items: list(a, 'notti', 'notti') }; }
  if (/(weekend|week end|fine settimana)/.test(s)) { const a = topBy(stats, 'weekend', least); return { intent: 'weekend', answer: (least ? 'Operatori con meno weekend:' : 'Operatori con più weekend:'), items: list(a, 'weekend', 'weekend') }; }
  if (/(festiv)/.test(s)) { const a = topBy(stats, 'festivi', least); return { intent: 'festivi', answer: (least ? 'Operatori con meno festivi:' : 'Operatori con più festivi:'), items: list(a, 'festivi', 'festivi') }; }
  if (/(ferie|assenz|malatt|permess)/.test(s)) { const a = topBy(stats, 'assenze', least); return { intent: 'assenze', answer: (least ? 'Operatori con meno assenze:' : 'Operatori con più assenze (ferie/malattia/permessi):'), items: list(a, 'assenze', 'giorni') }; }
  if (/(sovracc|stress|fatic|burnout|caric)/.test(s)) {
    const fat = fatigueScore(ctx, piano).slice().sort((a, b) => b.score - a.score);
    return { intent: 'fatigue', answer: 'Operatori più sovraccarichi (fatigue score):', items: fat.slice(0, 5).map((f) => ({ nome: f.nome, valore: f.score + '/100' })) };
  }
  if (/(consecutiv|di fila|piu giorni)/.test(s)) { const a = topBy(stats, 'maxRun', false); return { intent: 'consecutivi', answer: 'Chi lavora da più giorni consecutivi:', items: list(a, 'maxRun', 'gg') }; }
  // copertura
  if (/(scopert|scoperto|non copert|buchi|carenz)/.test(s)) {
    const dim = daysInMonth(ctx.year, ctx.month); const gaps: { nome: string; valore: string }[] = [];
    for (const rep of ctx.reparti) for (let d = 1; d <= dim && gaps.length < 8; d++) {
      for (const t of ['M', 'P', 'N'] as TurnoLavoro[]) {
        const req = rep.settori[t] || 0; if (req <= 0) continue;
        const assigned = ctx.staff.filter((p) => { const c = piano[p.id] && piano[p.id][d]; return c && c.turno === t && c.repartoId === rep.id; }).length;
        if (assigned < req) gaps.push({ nome: rep.nome + ' g.' + d, valore: t + ': mancano ' + (req - assigned) });
        if (gaps.length >= 8) break;
      }
    }
    return { intent: 'scoperti', answer: gaps.length ? 'Turni scoperti (primi risultati):' : 'Nessun turno scoperto rilevato.', items: gaps };
  }
  // neoassunti
  if (/neoass/.test(s)) {
    const al = checkNeoassunti(ctx, piano);
    return { intent: 'neoassunti', answer: al.length ? '⚠ Turni a rischio (≥2 neoassunti, nessun senior):' : 'Nessun turno composto solo da neoassunti.', items: al.slice(0, 8).map((a) => ({ nome: (getRep(ctx.reparti, a.repartoId)?.nome || a.repartoId) + ' g.' + a.day + ' ' + a.turno, valore: a.nomi.join(', ') })) };
  }
  // perché non pubblicabile / quali vincoli CCNL violo / quali criticità
  if (/(pubblic|publish|non viene|perche.*piano|perché.*piano|blocc|vincol|ccnl|violand|violazion|critic|cosa sto sbagliand)/.test(s)) {
    const g = publishGate(ctx, piano, { coverageMin: 90 });
    const fails = g.checks.filter((c) => c.esito === 'fail'); const warns = g.checks.filter((c) => c.esito === 'warn');
    const head = g.ok ? 'Nessun vincolo inviolabile violato: il piano è pubblicabile.' : 'Vincoli/controlli non superati:';
    return { intent: 'publishGate', answer: head, items: (fails.length ? fails : warns).map((c) => ({ nome: c.nome, valore: c.dettaglio })) };
  }
  // sostituto per <nome> / chi può fare una notte
  if (/(sostitu|rimpiazz|coprire|chi puo fare|chi può fare)/.test(s)) {
    const dim = daysInMonth(ctx.year, ctx.month);
    const notte = /(notte|notturn)/.test(s);
    const named = ctx.staff.find((p) => s.indexOf(p.nome.toLowerCase()) >= 0);
    let day = 1, turno: TurnoLavoro = notte ? 'N' : 'M', repId = ctx.reparti[0] ? ctx.reparti[0].id : '';
    if (named) { const p = piano[named.id] || {}; for (let d = 1; d <= dim; d++) { const c = p[d]; if (c && isWork(c.turno)) { day = d; turno = (c.turno as TurnoLavoro); repId = c.repartoId || repId; break; } } }
    const rep = repId ? getRep(ctx.reparti, repId) : null;
    if (!rep) return { intent: 'sostituto', answer: 'Nessun reparto configurato.' };
    const code = secForTurno(rep, turno);
    const cls: Record<string, OperatorClass> = {}; for (const p of ctx.staff) cls[p.id] = classifyOperator(p).categoria;
    const stm = opStats(ctx, piano); const oreMax = Math.max(1, ...stm.map((o) => o.ore));
    const lvlRank: Record<OperatorClass, number> = { Referente: 5, Esperto: 4, Senior: 3, Junior: 2, Neoassunto: 1 };
    const cand: { nome: string; cls: OperatorClass; score: number; der: number }[] = [];
    for (const p of ctx.staff) {
      if (named && p.id === named.id) continue;
      const cell = getCell(piano, p.id, day); const libero = !cell || cell.turno === 'R';
      if (!libero) continue;
      const ev = evalCandidate(ctx, piano, p, day, turno, rep, code); if (!ev) continue; // null = vincolo (es. 11h) → escluso
      const st = stm.find((o) => o.id === p.id)!;
      const score = Math.round(lvlRank[cls[p.id]] * 12 + (1 - st.ore / oreMax) * 20 + (ev.deroghe.length ? -10 * ev.deroghe.length : 10));
      cand.push({ nome: p.nome, cls: cls[p.id], score, der: ev.deroghe.length });
    }
    cand.sort((x, y) => (lvlRank[y.cls] - lvlRank[x.cls]) || (y.score - x.score) || x.nome.localeCompare(y.nome));
    return { intent: 'sostituto', answer: (named ? 'Possibili sostituti per ' + named.nome : 'Possibili candidati') + ' (g.' + day + ' ' + turno + '), per idoneità e livello:', items: cand.slice(0, 5).map((c) => ({ nome: c.nome + ' · ' + c.cls, valore: c.score + (c.der ? ' · ⚠ deroghe' : ' · ok') })) };
  }
  // normativa
  const n = normaLookup(s);
  if (n) return { intent: 'norma:' + n.id, answer: n.titolo, items: [{ nome: '', valore: n.testo }] };
  // fallback
  return { intent: 'help', answer: 'Posso rispondere su: notti, weekend, festivi, assenze, sovraccarico/fatigue, giorni consecutivi, turni scoperti, neoassunti, sostituti, motivo del blocco pubblicazione e normativa (riposo 11h, smonto, ferie, 104, maternità, profili).', items: [] };
}
function secForTurno(rep: Reparto, t: TurnoLavoro): string {
  // codice del primo settore disponibile per il turno (per il targeting della sostituzione)
  if ((rep.settori[t] || 0) <= 0) return '';
  return secCode(t, rep.sigla, 1);
}
