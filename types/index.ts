// types/index.ts — domain model for TURNOVER

export type Turno = 'M' | 'P' | 'N' | 'R' | 'F' | 'S' | 'G';

// FASE 1 — SKILL MATRIX: competenza di un operatore (area + livello + date)
export type SkillLevel = 'base' | 'intermedio' | 'esperto';
// Livello professionale (classificazione automatica o manuale)
export type OperatorClass = 'Neoassunto' | 'Junior' | 'Senior' | 'Esperto' | 'Referente';

// ── Multiutente (fondazione lato-app, pronta per backend) ────────────────────
export type UserRole = 'OWNER' | 'STAFF';
export type RbacAction = 'view' | 'editTurni' | 'editPersonale' | 'editReparti' | 'publish' | 'approve' | 'invite' | 'export';
export type RequestType = 'ferie' | 'riposo' | 'mattina' | 'pomeriggio' | 'evitaNotte';
export type RequestStatus = 'pending' | 'approved' | 'rejected';
export interface ApprovalRequest {
  id: string;
  infId: string;        // operatore richiedente (Staff.id nel modello single-device)
  day: number;          // giorno di inizio (1..31)
  to?: number;          // giorno di fine (per le ferie)
  month: number;        // 0-based
  year: number;
  tipo: RequestType;
  stato: RequestStatus;
  motivo?: string;      // motivazione dello staff
  commento?: string;    // commento dell'owner
  createdAt: string;    // ISO
}
// ── Matrici stagionali ───────────────────────────────────────────────────────
export type Season = 'primavera' | 'estate' | 'autunno' | 'inverno';
export type MatriceMode = 'standard' | 'custom' | 'seasonal';
export interface SeasonRange {
  matrice: string;     // id matrice (standard o personalizzata) usata nella stagione
  startMonth: number;  // 1-based (1=gennaio)
  startDay: number;
  endMonth: number;    // 1-based
  endDay: number;
  op?: SeasonOps;      // configurazione operativa (copertura/settori/posti letto/vincoli)
}
// Configurazione operativa per stagione (Fase enterprise avanzata).
export interface SeasonOps {
  settori?: { M?: number; P?: number; N?: number }; // settori attivi per turno (applicato a generazione e copertura)
  oss?: { M?: number; P?: number; N?: number };      // OSS richiesti per turno (informativo)
  settoriChiusi?: number;
  postiLetto?: number;
  postiChiusi?: number;
  coperturaMin?: number;  // % copertura minima accettabile
  personaleMin?: number;  // personale minimo giornaliero
}
export type SeasonalConfig = Record<Season, SeasonRange>;

// ── Postazioni operative (copertura assistenziale reale) ─────────────────────
export type StationPriority = 'critica' | 'alta' | 'media' | 'bassa';
export interface StationReq {
  ruolo?: 'infermiere' | 'oss'; // ruolo richiesto
  senior?: boolean;             // richiede operatore senior/esperto/referente
  referente?: boolean;          // richiede referente di turno
  anniMin?: number;             // anzianità minima (anni)
}
export interface Postazione {
  id: string;
  nome: string;
  turni: TurnoLavoro[];         // turni in cui la postazione è attiva (M/P/N)
  priorita: StationPriority;
  requisiti?: StationReq;
  quantita?: number;            // operatori richiesti (default 1)
}
export type StationStatusKind = 'verde' | 'giallo' | 'rosso';
export interface RepartoMinimi {
  criticheMin?: number; // n. minimo di postazioni critiche da coprire (in giornata)
  alteMin?: number;     // n. minimo di postazioni alte
  ossMin?: number;      // n. minimo OSS presenti
  infMin?: number;      // n. minimo infermieri presenti
}
export interface StationDayStatus { day: number; status: StationStatusKind; }
export interface StationCoverageItem {
  repId: string; repNome: string; postazioneId: string; nome: string; priorita: StationPriority;
  status: StationStatusKind;          // stato aggregato (rosso se almeno un giorno scoperto, ecc.)
  verde: number; giallo: number; rosso: number; // conteggio giorni
  giorni: StationDayStatus[];
}

export interface Membership {
  id: string;
  infId?: string;       // collegamento all'operatore (se già presente nello staff)
  nome: string;
  cognome?: string;
  email: string;
  ruolo: string;        // qualifica
  stato: 'invitato' | 'attivo' | 'revocato';
}
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
  seasonal?: SeasonalConfig; // se matrice==='STAGIONALE', configurazione stagione→matrice
  matriceMode?: MatriceMode;  // 'standard' | 'custom' | 'seasonal' (default dedotto)
  postazioni?: Postazione[]; // postazioni operative reali (copertura assistenziale)
  minimi?: RepartoMinimi;    // copertura minima garantita (vincolo direzionale)
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
  anniEsperienza?: number;   // profilo professionale: anni di esperienza
  livello?: OperatorClass;   // profilo professionale: livello (override della classificazione automatica)
  oreSettimanali?: number; // override contratto personalizzato (ore/settimana)
  ferieAnnue?: number;     // monte ferie annuo (giorni); default se assente
  countInCoverage?: boolean; // false = figura non assistenziale (coordinamento/supporto): esclusa da copertura/settori/sostituzioni
  seasonal?: SeasonalConfig; // se matrice==='STAGIONALE' a livello operatore
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
  richieste?: ApprovalRequest[];                  // richieste ferie/desiderate (per analisi AI)
}

export type AvatarKind = 'initials' | 'icon' | 'man' | 'woman' | 'emoji';
export interface ProfileConfig {
  kind: AvatarKind;
  color: string;
  initials?: string;   // iniziali personalizzate (override)
  icon?: string;       // chiave icona dalla libreria locale
  emoji?: string;      // glyph emoji locale (animali/personaggi)
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
  role?: UserRole;            // ruolo locale corrente (OWNER/STAFF) — switch in-app
  members?: Membership[];     // personale autorizzato (scaffold, pronto per backend)
  richieste?: ApprovalRequest[]; // richieste ferie/desiderate
  profile?: ProfileConfig;    // personalizzazione avatar/profilo
  currentEmail?: string;      // sessione corrente (email loggata)
}

export interface AuditEntry {
  id: string;
  ts: string;        // ISO datetime
  op: string;        // create | update | delete | regen | undo | redo | import
  entity: string;    // turno | assenza | personale | reparto | mese | backup
  before: string | null;
  after: string | null;
  actor?: string;    // ruolo/utente che ha eseguito l'azione
  motivo?: string;   // motivazione (es. commento di rifiuto, correzione AI applicata)
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

// Reperibilità — modulo separato (overlay), NON gestito dal motore di generazione.
export interface RepAssignment {
  id: string;
  infId: string;
  day: number;     // 1..31
  month: number;   // 0-based
  year: number;
  richiamato?: boolean;     // se la reperibilità è stata convertita in presenza
  richiamoTurno?: Turno;    // turno effettuato in caso di richiamo
  note?: string;
}

export type StatoReperibilita = 'attesa' | 'approvata' | 'rifiutata';
export interface ReperibilitaOperatore {
  id: string;
  staffId: string;
  data: string;        // ISO 'YYYY-MM-DD' (visualizzata GG/MM/AAAA via fmtDataIt)
  fascia: string;      // '' = tutto il giorno, oppure 'HH:MM-HH:MM'
  telefono: string;
  note?: string;
  stato: StatoReperibilita;
}
