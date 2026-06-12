// utils/helpers.ts — pure helpers

import { Cell, Contratto, Ferie, Matrice, OperatorClass, OrariSet, Piano, PianoStore, Reparto, Staff, Turno, TurnoLavoro, Season, SeasonRange, SeasonalConfig } from '../types';
import { AVATAR_COLORS, CONTRATTI, MATRICI, REPARTI_PREDEF, STD_ORARI, legacyAbsenceLabel } from './constants';

export function uid(prefix = 'id'): string {
  return prefix + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
}

export function initials(name: string): string {
  const p = (name || '').trim().split(/\s+/);
  if (!p[0]) return '?';
  return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

export function avatarColor(idx: number): string {
  return AVATAR_COLORS[((idx % AVATAR_COLORS.length) + AVATAR_COLORS.length) % AVATAR_COLORS.length];
}

export function toMin(hhmm: string): number {
  if (!hhmm || hhmm.indexOf(':') < 0) return 0;
  const p = hhmm.split(':');
  return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function jsDow(year: number, month: number, day: number): number {
  return new Date(year, month, day).getDay();
}

// Indice di giorno ASSOLUTO da un'epoca fissa: garantisce la continuità del ciclo
// di turnazione tra mesi e anni (il 1° del mese prosegue dall'ultimo del precedente).
export function absDayIndex(year: number, month: number, day: number): number {
  return Math.round((Date.UTC(year, month, day) - Date.UTC(2000, 0, 1)) / 86400000);
}

export function isWeekend(year: number, month: number, day: number): boolean {
  const d = jsDow(year, month, day);
  return d === 0 || d === 6;
}

export function monthKey(year: number, month: number): string {
  return year + '-' + month;
}

export function getRep(reparti: Reparto[], id: string | null): Reparto | null {
  if (!id) return null;
  for (const r of reparti) if (r.id === id) return r;
  return null;
}

export function getInf(staff: Staff[], id: string | null): Staff | null {
  if (!id) return null;
  for (const s of staff) if (s.id === id) return s;
  return null;
}

export function getCtr(id: string): Contratto {
  for (const c of CONTRATTI) if (c.id === id) return c;
  return CONTRATTI[0];
}

export function getMx(id: string): Matrice | null {
  for (const m of MATRICI) if (m.id === id) return m;
  return null;
}

export function siglaForNome(nome: string): string {
  for (const r of REPARTI_PREDEF) if (r[0] === nome) return r[1];
  return (nome || 'XX').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'XX';
}

export function staffIndex(staff: Staff[], id: string): number {
  for (let i = 0; i < staff.length; i++) if (staff[i].id === id) return i;
  return 0;
}

export function isWork(t: Turno): t is TurnoLavoro {
  return t === 'M' || t === 'P' || t === 'N';
}

export function secCode(turn: Turno, sigla: string, n: number): string {
  return turn + sigla + n;
}

// end of shift in absolute minutes from start-of-day on which it STARTS (N crosses midnight)
export function endAbs(turn: Turno, orari: OrariSet): number {
  const o = orari[turn as TurnoLavoro] || STD_ORARI[turn as TurnoLavoro] || STD_ORARI.M;
  const s = toMin(o.s);
  let e = toMin(o.e);
  if (e <= s) e += 1440;
  return e;
}

export function startMin(turn: Turno, orari: OrariSet): number {
  const o = orari[turn as TurnoLavoro] || STD_ORARI[turn as TurnoLavoro] || STD_ORARI.M;
  return toMin(o.s);
}

// rest minutes between prev turn (worked day d) and cur turn (worked day d+1)
export function restMinutes(prevTurn: Turno, curTurn: Turno, prevOrari: OrariSet, curOrari: OrariSet): number {
  return startMin(curTurn, curOrari) + 1440 - endAbs(prevTurn, prevOrari);
}

export function emptyCell(): Cell {
  return { turno: 'R', repartoId: null, settore: null, locked: false, autoFilled: false, riposoForzato: false, deroghe: [] };
}

export function cloneDeep<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

// --- Ruoli: normalizzazione per retrocompatibilità con dati salvati ---
export function normalizeQualifica(q: string | undefined): string {
  const v = (q || '').toLowerCase();
  if (v.includes('fuori')) return 'Fuori Turno';
  if (v.includes('specialist')) return 'Infermiere Specialista';
  if (v.includes('coordinat') || v.includes('caposala')) return 'Coordinatore';
  if (v.includes('oss')) return 'OSS';
  if (v.includes('inferm')) return 'Infermiere';
  return 'Infermiere';
}

// ── Matrici stagionali: risoluzione stagione/matrice per data (pura) ──────────
// month è 0-based (come nel motore). Le SeasonRange usano mesi 1-based.
function seasonKey(month1: number, day: number): number { return month1 * 100 + day; }
export function inSeasonRange(month0: number, day: number, r: SeasonRange | undefined): boolean {
  if (!r) return false;
  const k = seasonKey(month0 + 1, day);
  const s = seasonKey(r.startMonth, r.startDay);
  const e = seasonKey(r.endMonth, r.endDay);
  return s <= e ? (k >= s && k <= e) : (k >= s || k <= e); // wrap (es. inverno dic→feb)
}
const SEASON_ORDER: Season[] = ['primavera', 'estate', 'autunno', 'inverno'];
export function seasonForDay(cfg: SeasonalConfig | undefined, month0: number, day: number): Season | null {
  if (!cfg) return null;
  for (const s of SEASON_ORDER) if (inSeasonRange(month0, day, cfg[s])) return s;
  return null;
}
export function seasonalMatrice(cfg: SeasonalConfig | undefined, month0: number, day: number): string | null {
  if (!cfg) return null;
  const s = seasonForDay(cfg, month0, day);
  if (s && cfg[s] && cfg[s].matrice) return cfg[s].matrice;
  for (const k of SEASON_ORDER) if (cfg[k] && cfg[k].matrice) return cfg[k].matrice; // fallback: prima configurata
  return null;
}
// COORDINAMENTO/SUPPORTO (Coordinatore, Fuori Turno). Solo l'assistenziale
// partecipa a copertura, settori, scoperture, sostituzioni e fabbisogno minimo.
// Fonte di verità unica usata da motore, sostituzioni, report e assistente AI.
export function countsInCoverage(inf: Staff): boolean {
  if (typeof inf.countInCoverage === 'boolean') return inf.countInCoverage;
  const q = (inf.qualifica || '').toLowerCase();
  if (q.includes('coordinat') || q.includes('caposala') || q.includes('fuori')) return false;
  return true;
}

// Ricostruisce un membro dello staff scartando proprietà legacy non più previste
// dal modello dati (mantiene solo i campi validi) e applicando default sicuri.
export function sanitizeStaff(raw: any): Staff {
  const r = raw && typeof raw === 'object' ? raw : {};
  const notti = r.nottiPerCiclo === 1 ? 1 : r.nottiPerCiclo === 2 ? 2 : 0;
  const LIV = ['Neoassunto', 'Junior', 'Senior', 'Esperto', 'Referente'];
  const out: Staff = {
    id: typeof r.id === 'string' ? r.id : uid('inf'),
    nome: typeof r.nome === 'string' && r.nome.trim() ? r.nome : 'Senza nome',
    qualifica: normalizeQualifica(r.qualifica),
    contratto: CONTRATTI.some((c) => c.id === r.contratto) ? r.contratto : 'FT36',
    nottiPerCiclo: notti as 0 | 1 | 2,
    matrice: MATRICI.some((m) => m.id === r.matrice) ? r.matrice : 'M62',
    offset: Number.isFinite(r.offset) ? (((r.offset % 7) + 7) % 7) : 0,
    reparti: Array.isArray(r.reparti) ? r.reparti.filter((x: any) => typeof x === 'string') : [],
    esenzioniTurni: Array.isArray(r.esenzioniTurni) ? r.esenzioniTurni.filter((x: any) => x === 'M' || x === 'P' || x === 'N') : [],
    esenzioniSettori: Array.isArray(r.esenzioniSettori) ? r.esenzioniSettori.filter((x: any) => typeof x === 'string') : [],
  };
  // CAMPI OPZIONALI — PRESERVATI: in passato venivano scartati al caricamento, azzerando
  // esenzioni weekend/festivi, preferenze (es. coordinatore "solo mattina"), competenze e profilo.
  if (Array.isArray(r.templateCombo)) out.templateCombo = r.templateCombo.filter((x: any) => typeof x === 'string');
  if (typeof r.esenteWeekend === 'boolean') out.esenteWeekend = r.esenteWeekend;
  if (typeof r.esenteFestivi === 'boolean') out.esenteFestivi = r.esenteFestivi;
  if (r.preferenze && typeof r.preferenze === 'object') out.preferenze = r.preferenze;
  if (Array.isArray(r.competenze)) out.competenze = r.competenze.filter((c: any) => c && typeof c.area === 'string');
  if (Number.isFinite(r.anniEsperienza)) out.anniEsperienza = r.anniEsperienza;
  if (typeof r.livello === 'string' && LIV.indexOf(r.livello) >= 0) out.livello = r.livello as OperatorClass;
  if (Number.isFinite(r.oreSettimanali)) out.oreSettimanali = r.oreSettimanali;
  if (typeof r.countInCoverage === 'boolean') out.countInCoverage = r.countInCoverage;
  if (Number.isFinite(r.ferieAnnue)) out.ferieAnnue = r.ferieAnnue;
  return out;
}

// Durata in ore di un turno lavorativo secondo gli orari del reparto.
export function shiftHours(turn: Turno, orari: OrariSet): number {
  if (turn === 'G') return 12; // giornata lunga 12h (ciclo 12 ore)
  if (!isWork(turn)) return 0;
  return Math.max(0, (endAbs(turn, orari) - startMin(turn, orari)) / 60);
}

// === Migrazione assenze: vecchie tipologie → modello unico 'ASS' + motivazione libera ===
// Idempotente: non tocca le voci che hanno già `motivo`. Nessun dato viene perso.
export function migrateFerie(ferie: Ferie[] | undefined): Ferie[] {
  return (ferie || []).map((f) => {
    if (f.motivo && String(f.motivo).trim()) return f;
    const fromLegacy = legacyAbsenceLabel(f.tipo);
    const fromNote = f.note && String(f.note).trim() ? String(f.note).trim() : '';
    return { ...f, motivo: fromLegacy || fromNote || 'Assenza' };
  });
}

export function migratePianos(pianos: PianoStore | undefined): PianoStore {
  const out: PianoStore = {};
  const src = pianos || {};
  for (const key of Object.keys(src)) {
    const piano: Piano = src[key] || {};
    const np: Piano = {};
    for (const infId of Object.keys(piano)) {
      const days = piano[infId] || {};
      const nd: Record<number, Cell> = {};
      for (const dk of Object.keys(days)) {
        const d = Number(dk);
        const c = days[d] as Cell;
        if (c && c.turno === 'F' && !(c.motivo && String(c.motivo).trim())) {
          nd[d] = { ...c, motivo: legacyAbsenceLabel(c.assenza) || 'Assenza' };
        } else {
          nd[d] = c;
        }
      }
      np[infId] = nd;
    }
    out[key] = np;
  }
  return out;
}

// === Festività italiane (fisse + Pasquetta) — spostate qui per uso anche dal motore ===
const FIXED_HOLIDAYS = new Set([
  '0-1', '0-6', '3-25', '4-1', '5-2', '7-15', '10-1', '11-8', '11-25', '11-26',
]); // mese(0-based)-giorno

export function easter(year: number): { m: number; d: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const dd = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - dd - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const mm = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * mm + 114) / 31);
  const day = ((h + l - 7 * mm + 114) % 31) + 1;
  return { m: month - 1, d: day };
}

export function isHoliday(year: number, month: number, day: number): boolean {
  if (FIXED_HOLIDAYS.has(month + '-' + day)) return true;
  const e = easter(year);
  const monday = new Date(year, e.m, e.d + 1);
  return monday.getMonth() === month && monday.getDate() === day;
}

export function fmtDataIt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Spezza un'assenza che attraversa i mesi (es. maternità) in voci Ferie mensili.
// from/to inclusivi; supporta il passaggio d'anno. Il motore resta mono-mese per contesto.
export function splitAssenzaRange(
  infId: string,
  fromY: number, fromM0: number, fromD: number,
  toY: number, toM0: number, toD: number,
  motivo?: string
): { infId: string; from: number; to: number; month: number; year: number; motivo?: string }[] {
  const out: { infId: string; from: number; to: number; month: number; year: number; motivo?: string }[] = [];
  if (toY < fromY || (toY === fromY && (toM0 < fromM0 || (toM0 === fromM0 && toD < fromD)))) return out;
  let y = fromY, m = fromM0;
  for (;;) {
    const dim = daysInMonth(y, m);
    const a = y === fromY && m === fromM0 ? Math.max(1, fromD) : 1;
    const b = y === toY && m === toM0 ? Math.min(dim, toD) : dim;
    if (a <= b) out.push({ infId, from: a, to: b, month: m, year: y, motivo });
    if (y === toY && m === toM0) break;
    m += 1; if (m > 11) { m = 0; y += 1; }
  }
  return out;
}
