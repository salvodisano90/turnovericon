// types/index.ts — domain model for TURNOVER

export type Turno = 'M' | 'P' | 'N' | 'R' | 'F' | 'S' | 'G';

// FASE 1 — SKILL MATRIX: competenza di un operatore (area + livello + date)
export type SkillLevel = 'base' | 'intermedio' | 'esperto';
export interface Competenza {
  area: string;            // es. 'Triage', 'NIV', 'Area Critica', 'Referente turno', 'Tutor studenti'
  livello: SkillLevel;
  acquisita?: string;      // ISO 'YYYY-MM-DD'
  aggiornata?: string;     // ISO 'YYYY-MM-DD'
}
export type TurnoLavoro = 'M' | 'P' | 'N';
// LEGACY: vecchie tipologie, conservate solo per la migrazione automatica verso il modello unico 'ASS'.
export type AssenzaTipo = 'ferie' | 'malattia' | 'permesso' | 'legge104' | 'formazione' | 'congedo' | 'infortunio' | 'aspettativa';
export type DerogaCode = 'ore' | 'notti' | 'consec' | 'weekend' | 'festivo' | 'preferenza' | 'desiderata';

export type GenerationMode = 'rigida' | 'operativa';
// FASE 10 — modalità di pianificazione: rapida (solo matrice) · equa (ottimizzata) · coordinatore (AI completa)
export type PlanMode = 'rapida' | 'equa' | 'coordinatore';

// Preferenze personali dell'operatore (le "forti" no-notti/no-weekend/no-festivi usano i
// campi esenzioniTurni/esenteWeekend/esenteFestivi già esistenti).
export interface Preferenze {
  soloMattina?: boolean;        // forte: solo turni di mattina
  soloPomeriggio?: boolean;     // forte: solo turni di pomeriggio
  prefMattina?: boolean;        // debole
  prefPomeriggio?: boolean;     // debole
  prefWeekendLibero?: boolean;  // debole
  prefSettore?: string;         // debole: codice base settore preferito (es. 'MDA1')
  prefReparto?: string;         // debole: id reparto preferito
}

export type DesiderataTipo = 'lavoro' | 'riposo' | 'mattina' | 'pomeriggio' | 'evitaNotte';
export type DesiderataPriorita = 'bassa' | 'media' | 'alta';
export interface Desiderata {
  id?: string;
  infId: string;
  dateStart: string;   // ISO 'YYYY-MM-DD'
  dateEnd?: string;     // opzionale: intervallo
  tipo: DesiderataTipo;
  priorita: DesiderataPriorita;
}

// Registro deroghe controllate (modalità operativa)
export interface Deroga {
  infId: string;
  day: number;          // giorno del mese
  repartoId: string | null;
  motivo: string;       // descrizione leggibile
  regola: DerogaCode;   // regola derogata
}
export type ThemeMode = 'light' | 'dark';

export interface Orario {
  s: string; // "HH:MM"
  e: string; // "HH:MM"
}

export interface OrariSet {
  M: Orario;
  P: Orario;
  N: Orario;
}

export interface Cell {
  turno: Turno;
  repartoId: string | null;
  settore: string | null;
  locked: boolean;
  autoFilled: boolean;
  riposoForzato: boolean;
  deroghe: DerogaCode[];
  motivo?: string;            // assenza unificata: motivazione libera (es. "Ferie", "Malattia", …)
  assenza?: AssenzaTipo;      // LEGACY: sola lettura per migrazione
}

export type DayMap = Record<number, Cell>;
export type Piano = Record<string, DayMap>; // infId -> day -> cell
export type PianoStore = Record<string, Piano>; // "YYYY-M" -> piano

export interface Reparto {
  id: string;
  nome: string;
  sigla: string;
  orari: OrariSet;
  matrice: string;
  settori: { M: number; P: number; N: number };
}

export interface Staff {
  id: string;
  nome: string;
  qualifica: string;
  contratto: string;
  nottiPerCiclo: 0 | 1 | 2;
  matrice: string;
  templateCombo?: string[]; // STEP 0: lista di template da concatenare nel ciclo (combinabili)
  offset: number;
  reparti: string[];
  esenzioniTurni: TurnoLavoro[];
  esenzioniSettori: string[];
  esenteWeekend?: boolean; // C2: esclusione automatica/configurabile dai weekend
  esenteFestivi?: boolean; // C2: esclusione automatica/configurabile dai festivi
  preferenze?: Preferenze;  // preferenze personali (forti/deboli)
  competenze?: Competenza[]; // FASE 1 — skill matrix dell'operatore
  oreSettimanali?: number; // override contratto personalizzato (ore/settimana)
}

export interface Ferie {
  infId: string;
  from: number;
  to: number;
  month: number;
  year: number;
  motivo?: string;            // assenza unificata: motivazione libera
  tipo?: AssenzaTipo;         // LEGACY: sola lettura per migrazione
  note?: string;              // LEGACY: nota aggiuntiva
}

export interface Contratto {
  id: string;
  label: string;
  oreSett: number;
  oreMese: number;
  nottiMax: number;
  giorniCons: number;
}

export interface Matrice {
  id: string;
  label: string;            // nome
  seq: Turno[];             // sequenza
  notti: number;
  descrizione?: string;     // descrizione catalogo
  durata?: number;          // durata ciclo (default seq.length)
  compatReparto?: string[]; // id reparti compatibili (vuoto = tutti)
  compatRuolo?: string[];   // qualifiche compatibili (vuoto = tutte)
  custom?: boolean;         // creata dall'utente (catalogo persistente)
}

export interface BuildStats {
  filled: number;
  deroghe: number;
  before: number;
  after: number;
  equityBefore?: number;  // punteggio equità 0..100 prima dell'ottimizzazione
  equityAfter?: number;   // punteggio equità 0..100 dopo l'ottimizzazione
  optSwaps?: number;      // scambi applicati dall'ottimizzatore
  optPasses?: number;     // passate di ricerca locale eseguite
  derogheList?: Deroga[]; // registro deroghe controllate (modalità operativa)
  prefPct?: number;       // % preferenze soddisfatte
  desPct?: number;        // % desiderata soddisfatti
}

export interface SlotCoverage {
  code: string;
  turn: TurnoLavoro;
  n: number;
  covered: number;
  total: number;
  pct: number;
}

export interface RepCoverage {
  slots: SlotCoverage[];
  avg: { M: number | null; P: number | null; N: number | null };
  hasProblemi: boolean;
}

export interface UncoveredSlot {
  repId: string;
  turn: TurnoLavoro;
  code: string;
  day: number;
}

export interface Coverage {
  byRep: Record<string, RepCoverage>;
  total: number;
  covered: number;
  uncovered: UncoveredSlot[];
  globalPct: number;
}

export interface DerogaItem {
  infId: string;
  nome: string;
  day: number;
  turno: Turno;
  settore: string | null;
  deroghe: DerogaCode[];
}

export interface EngineContext {
  reparti: Reparto[];
  staff: Staff[];
  ferie: Ferie[];
  month: number;
  year: number;
  // C3 — memoria storica festivi (opzionali, popolati dall'app)
  festiviCount?: Record<string, number>;        // infId → festivi già lavorati nell'anno (equa distribuzione)
  festiviMajor?: Record<string, string[]>;       // chiave festivo maggiore → infId che l'hanno lavorato (alternanza annuale)
  mode?: GenerationMode;                          // modalità di generazione (default 'operativa')
  desiderata?: Desiderata[];                      // desiderata degli operatori
  matrici?: Matrice[];                            // catalogo completo (built-in + personalizzate)
  matriceMese?: string;                           // matrice di livello MESE (gerarchia: op > reparto > mese)
}

export interface PersistedData {
  reparti: Reparto[];
  staff: Staff[];
  ferie: Ferie[];
  pianos: PianoStore;
  month: number;
  year: number;
  audit?: AuditEntry[];
  history?: Snapshot[];
  future?: Snapshot[];
  desiderata?: Desiderata[];   // persistenza desiderata
  mode?: GenerationMode;       // persistenza modalità motore
  aiMode?: PlanMode;           // persistenza modalità di pianificazione (Fase 10)
  matriciCustom?: Matrice[];   // catalogo matrici personalizzate
  matriceMese?: Record<string, string>; // matrice mensile per chiave 'YYYY-M'
}

export interface AuditEntry {
  id: string;
  ts: string;        // ISO datetime
  op: string;        // create | update | delete | regen | undo | redo | import
  entity: string;    // turno | assenza | personale | reparto | mese | backup
  before: string | null;
  after: string | null;
}

export interface Snapshot {
  reparti: Reparto[];
  staff: Staff[];
  ferie: Ferie[];
  pianos: PianoStore;
  month: number;
  year: number;
}

export interface Backup {
  app: string;
  version: number;
  createdAt: string;
  checksum: number;
  data: PersistedData;
}

// --- Sostituzione automatica assenze ---
export interface SubBreakdown {
  disponibile: boolean;
  reparto: boolean;
  settore: boolean;
  riposo11h: boolean;
  monteOreResiduo: number; // turni residui rispetto al monte
  notti: number;
  weekend: number;
  caricoOre: number;
}
export interface SubCandidate {
  infId: string;
  nome: string;
  score: number;       // 0..100 (compatibilità %)
  eligible: boolean;
  deroghe: DerogaCode[];
  motivo: string;
  breakdown: SubBreakdown;
}

// --- Monte ore contrattuale ---
export interface OperatorHours {
  infId: string;
  nome: string;
  contratto: string;
  oreSett: number;
  expected: number;   // ore previste nel periodo
  assigned: number;   // ore effettive (turni + assenze giustificate)
  worked: number;     // solo ore da turni lavorati
  diff: number;       // assigned - expected
  overtime: number;   // max(0, diff)
  debt: number;       // max(0, -diff)
}
export interface HoursAlert {
  level: 'warning' | 'error' | 'info';
  infId?: string;
  message: string;
}
export interface MonthlyHours {
  month: number;
  year: number;
  perOperator: OperatorHours[];
  alerts: HoursAlert[];
}
export interface AnnualHours {
  label: string;
  months: number;
  perOperator: OperatorHours[];
  trend: { label: string; expected: number; assigned: number }[];
  alerts: HoursAlert[];
}
