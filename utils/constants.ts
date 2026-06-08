// utils/constants.ts — domain constants

import { Contratto, Matrice, OrariSet, Turno, DerogaCode } from '../types';

export const DOW = ['D', 'L', 'M', 'M', 'G', 'V', 'S']; // JS getDay 0=Sun..6=Sat
export const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

export interface TurnoInfo {
  label: string;
  col: string;
}
export const TURNI: Record<Turno, TurnoInfo> = {
  M: { label: 'Mattina', col: '#3B82F6' },
  P: { label: 'Pomeriggio', col: '#F59E0B' },
  N: { label: 'Notte', col: '#8B5CF6' },
  R: { label: 'Riposo', col: '#9CA3AF' },
  S: { label: 'Smonto notte', col: '#0EA5E9' },
  F: { label: 'Ferie', col: '#10B981' },
  G: { label: 'Giornata 12h', col: '#F97316' },
};

export interface AssenzaInfo {
  label: string;
  code: string;
  color: string; // testo/accento
  soft: string;  // sfondo badge
}

// === ASSENZA UNIFICATA ===
// Tutte le assenze sono rappresentate con un'unica sigla "ASS" e un colore unico
// configurabile (basta cambiare ASS_COLOR / ASS_SOFT qui sotto). La causale è testo libero.
export const ASS_COLOR = '#6D28D9'; // accento/testo (viola) — configurabile
export const ASS_SOFT = '#EFE9FC';  // sfondo badge — configurabile
export const ASSENZA: AssenzaInfo = { label: 'Assenza', code: 'ASS', color: ASS_COLOR, soft: ASS_SOFT };

// Etichette delle vecchie tipologie: usate SOLO dalla migrazione automatica.
export const LEGACY_ABSENCE_LABEL: Record<string, string> = {
  ferie: 'Ferie', malattia: 'Malattia', permesso: 'Permesso', legge104: 'Legge 104',
  formazione: 'Formazione', congedo: 'Congedo', infortunio: 'Infortunio', aspettativa: 'Aspettativa',
};

export function legacyAbsenceLabel(tipo: string | undefined): string {
  if (!tipo) return '';
  return LEGACY_ABSENCE_LABEL[tipo] || (tipo.charAt(0).toUpperCase() + tipo.slice(1));
}

// L'assenza è unica: getAssenza restituisce sempre il descrittore ASS (codice/colore),
// indipendentemente dall'argomento (mantenuto per compatibilità con i call site).
export function getAssenza(_tipo?: string): AssenzaInfo {
  return ASSENZA;
}

export const CONTRATTI: Contratto[] = [
  { id: 'FT36', label: 'Full Time 36h/sett.', oreSett: 36, oreMese: 156, nottiMax: 5, giorniCons: 6 },
  { id: 'FT4GG', label: 'Full Time 36h – 4 giorni/sett.', oreSett: 36, oreMese: 156, nottiMax: 4, giorniCons: 4 },
  { id: 'PT75', label: 'Part Time 75% – 27h/sett.', oreSett: 27, oreMese: 117, nottiMax: 3, giorniCons: 5 },
  { id: 'PT50', label: 'Part Time 50% – 18h/sett.', oreSett: 18, oreMese: 78, nottiMax: 2, giorniCons: 4 },
  { id: 'PT30', label: 'Part Time 30% – 10.8h/sett.', oreSett: 10.8, oreMese: 47, nottiMax: 1, giorniCons: 3 },
  { id: 'TDFT', label: 'Tempo Determinato FT', oreSett: 36, oreMese: 156, nottiMax: 5, giorniCons: 6 },
  { id: 'TDPT', label: 'Tempo Determinato PT 50%', oreSett: 18, oreMese: 78, nottiMax: 2, giorniCons: 4 },
  { id: 'LP', label: 'Libero Professionale', oreSett: 20, oreMese: 86, nottiMax: 0, giorniCons: 5 },
];

export const MATRICI: Matrice[] = [
  { id: 'M62', label: '6g/2R (solo M/P)', seq: ['M', 'M', 'M', 'P', 'P', 'P', 'R'], notti: 0 },
  { id: 'M52', label: '5g/2R+1N', seq: ['M', 'P', 'M', 'P', 'N', 'R', 'R'], notti: 1 },
  { id: 'MN1', label: '4g/3R + 1N', seq: ['M', 'P', 'R', 'N', 'R', 'R', 'P'], notti: 1 },
  { id: 'MN2', label: '5g + 2N consecutive', seq: ['M', 'P', 'R', 'N', 'N', 'R', 'R'], notti: 2 },
  { id: 'M12', label: '12h alternati', seq: ['M', 'R', 'P', 'R', 'M', 'R', 'R'], notti: 0 },
  { id: 'M12N', label: '12h + 1N', seq: ['M', 'R', 'R', 'N', 'R', 'R', 'R'], notti: 1 },
  { id: 'M4GG', label: '4gg/3R (4-day week)', seq: ['M', 'M', 'P', 'P', 'R', 'R', 'R'], notti: 0 },
  { id: 'MN2L', label: '2N long cycle', seq: ['R', 'N', 'N', 'R', 'R', 'M', 'P'], notti: 2 },
  // STEP 0 — TEMPLATE DI ROTAZIONE compatti (blocchi logici, smonto incluso). Configurabili e combinabili.
  { id: 'TA', label: 'Template A · M M P P R', seq: ['M', 'M', 'P', 'P', 'R'], notti: 0 },
  { id: 'TB', label: 'Template B · M M M P P R', seq: ['M', 'M', 'M', 'P', 'P', 'R'], notti: 0 },
  { id: 'TC', label: 'Template C · P P M M R', seq: ['P', 'P', 'M', 'M', 'R'], notti: 0 },
  { id: 'TD', label: 'Template D · N N S R R', seq: ['N', 'N', 'S', 'R', 'R'], notti: 2 },
  { id: 'TE', label: 'Template E · M M P P P R', seq: ['M', 'M', 'P', 'P', 'P', 'R'], notti: 0 },
  { id: 'TN1', label: 'Template · N S R (1 notte)', seq: ['N', 'S', 'R'], notti: 1 },
  { id: 'TM', label: 'Template · solo mattina', seq: ['M', 'M', 'M', 'M', 'R'], notti: 0 },
  { id: 'TP', label: 'Template · solo pomeriggio', seq: ['P', 'P', 'P', 'P', 'R'], notti: 0 },
  // ── CATALOGO MATRICI CONTRATTUALI REALI (la matrice è la regola; smonto incorporato) ──
  {
    id: 'QUINTA', label: 'Turno in Quinta', seq: ['M', 'P', 'N', 'S', 'R'], notti: 1, durata: 5,
    descrizione: 'Ciclo a 5 giorni con una notte e smonto. Mattina, pomeriggio, notte, smonto, riposo.',
    compatReparto: [], compatRuolo: ['Infermiere', 'OSS'],
  },
  {
    id: 'SESTA', label: 'Turno in Sesta', seq: ['M', 'M', 'P', 'P', 'N', 'S'], notti: 1, durata: 6,
    descrizione: 'Ciclo a 6 giorni: due mattine, due pomeriggi, una notte e smonto.',
    compatReparto: [], compatRuolo: ['Infermiere', 'OSS'],
  },
  {
    id: 'DECIMA', label: 'Turno in Decima', seq: ['M', 'M', 'P', 'P', 'R', 'N', 'N', 'S', 'R', 'R'], notti: 2, durata: 10,
    descrizione: 'Ciclo a 10 giorni con due notti consecutive, smonto e riposi. Recupero post-notte completo.',
    compatReparto: [], compatRuolo: ['Infermiere', 'OSS'],
  },
  {
    id: 'OTTAVA', label: 'Turno in Ottava', seq: ['M', 'M', 'P', 'P', 'N', 'N', 'S', 'R'], notti: 2, durata: 8,
    descrizione: 'Ciclo a 8 giorni con due notti consecutive, smonto e riposo.',
    compatReparto: [], compatRuolo: ['Infermiere', 'OSS'],
  },
  {
    id: 'D12H', label: 'Turni 12 ore', seq: ['G', 'N', 'S', 'R', 'R'], notti: 1, durata: 5,
    descrizione: 'Turnazione a 12 ore: giornata lunga, notte lunga, smonto e due riposi. Solo reparti a 12h.',
    compatReparto: [], compatRuolo: ['Infermiere', 'OSS'],
  },
];

// Pool curato di template compatti usato dall'assegnazione automatica dello STEP 0.
export const ROTATION_TEMPLATES = {
  day: ['TB', 'TA', 'TC', 'TE'],   // solo mattina/pomeriggio, blocchi compatti
  night1: 'TN1',                    // notte singola + smonto + riposo
  night2: 'TD',                     // doppia notte + smonto + doppio riposo
};

// Ruoli del personale (unico set valido in tutta l'app).
export const QUALIFICHE: string[] = [
  'Infermiere',
  'Coordinatore',
  'OSS',
  'Infermiere Specialista',
  'Fuori Turno',
];

export const REPARTI_PREDEF: [string, string][] = [
  ['Pronto Soccorso', 'PS'], ['OBI', 'OB'], ['Medicina Interna', 'MI'], ['Chirurgia Generale', 'CG'],
  ['Cardiologia', 'CA'], ['UTIC', 'UT'], ['ICU Terapia Intensiva', 'IC'], ['NICU', 'NI'], ['PICU', 'PI'],
  ['Stroke Unit', 'SU'], ['Neurologia', 'NE'], ['Ortopedia', 'OR'], ['Urologia', 'UR'], ['Ginecologia', 'GI'],
  ['Ostetricia', 'OS'], ['Pediatria', 'PE'], ['Geriatria', 'GE'], ['Oncologia', 'ON'], ['Ematologia', 'EM'],
  ['Pneumologia', 'PN'], ['Gastroenterologia', 'GA'], ['Nefrologia', 'NF'], ['Endocrinologia', 'EN'],
  ['Reumatologia', 'RE'], ['Dermatologia', 'DE'], ['Oftalmologia', 'OF'], ['ORL', 'OL'], ['Blocco Operatorio', 'BO'],
  ['Day Surgery', 'DS'], ['Recovery Room', 'RR'], ['Radiologia Interventistica', 'RI'], ['Dialisi', 'DI'],
  ['Riabilitazione', 'RB'], ['Lungodegenza', 'LU'], ['Psichiatria', 'PY'], ['Tossicologia', 'TO'],
  ['Infettivologia', 'IF'], ['Medicina Urgenza', 'MU'], ['Sub-Intensiva', 'SI'], ['Cure Palliative', 'CP'],
];

export const AVATAR_COLORS = [
  '#7C6AF7', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#EC4899', '#06B6D4', '#8B5CF6', '#F97316', '#14B8A6',
];

export const STD_ORARI: OrariSet = {
  M: { s: '07:00', e: '13:00' },
  P: { s: '13:00', e: '20:00' },
  N: { s: '20:00', e: '07:00' },
};

export const PRESETS: Record<string, OrariSet> = {
  classico: { M: { s: '06:00', e: '14:00' }, P: { s: '14:00', e: '22:00' }, N: { s: '22:00', e: '06:00' } },
  ps: { M: { s: '07:00', e: '13:00' }, P: { s: '13:00', e: '19:00' }, N: { s: '19:00', e: '07:00' } },
  h12: { M: { s: '07:00', e: '19:00' }, P: { s: '07:00', e: '19:00' }, N: { s: '19:00', e: '07:00' } },
};

export const DEROGA_LABEL: Record<DerogaCode, string> = {
  ore: 'Straordinario',
  notti: 'Notte extra',
  consec: 'Giorni consecutivi',
  weekend: 'Weekend extra',
  festivo: 'Festivo extra',
  preferenza: 'Preferenza non rispettata',
  desiderata: 'Desiderata non rispettato',
};

export const APP_NAME = 'TURNOVER';
export const STORAGE_KEY = 'turnover_data_v1';
export const LEGACY_STORAGE_KEY = 'turniai_data_v1'; // migrazione dati storici
export const THEME_KEY = 'turnover_theme_v1';
export const LEGACY_THEME_KEY = 'turniai_theme_v1'; // migrazione tema storico

// Profilo professionale — aree di competenza (enterprise) e livelli (per la UI).
// Le competenze NON bloccano la generazione: sono informative/di supporto.
export const COMPETENZE_AREE: string[] = [
  'Triage', 'OBI', "Medicina d'Urgenza", 'Area Critica', 'NIV', 'CPAP', 'Ventilazione',
  'ECG avanzato', 'Accessi Vascolari', 'Trauma', 'Stroke', 'Sepsi', 'Fast Track',
  'Tutor Clinico', 'Referente turno', 'ACLS', 'BLSD', 'Emergenza Territoriale', 'Formazione specifica',
];
export const LIVELLI: ('Neoassunto' | 'Junior' | 'Senior' | 'Esperto' | 'Referente')[] = [
  'Neoassunto', 'Junior', 'Senior', 'Esperto', 'Referente',
];
