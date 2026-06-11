// utils/designSystem.ts — Design System centrale di TURNOVER (tema scuro).
// Unica fonte di verità per colori, raggi, spaziatura, tipografia e ombre.
// Ispirazione: Apple Health/Fitness/Wallet, Notion, Threads (profondità, vetro, minimalismo).
// La palette dark del tema importa questi token: cambiando qui, cambia tutta l'app.

export const DS = {
  color: {
    // Sfondi — Black AMOLED foundation
    bg: '#000000',
    bgElevated: '#080808',
    bgTertiary: '#101010',
    // Superfici (glass sobrio su nero)
    card: 'rgba(255,255,255,0.05)',
    card2: 'rgba(255,255,255,0.08)',
    border: 'rgba(255,255,255,0.10)',
    separator: 'rgba(255,255,255,0.05)',
    // Testo
    text: '#FFFFFF',
    text2: '#B3B3B3',
    text3: '#7A7A7A',
    // Semantici (palette iOS)
    success: '#30D158',
    warning: '#FF9F0A',
    danger: '#FF453A',
    info: '#4DA3FF',
    // Soft (sfondi tenui per badge/chip)
    successSoft: 'rgba(48,209,88,0.16)',
    warningSoft: 'rgba(255,159,10,0.16)',
    dangerSoft: 'rgba(255,69,58,0.16)',
    infoSoft: 'rgba(77,163,255,0.16)',
    purple: '#BF5AF2',
    overlay: 'rgba(0,0,0,0.70)',
    },
  radius: {
    global: 24,
    card: 32,
    button: 16,
    floating: 32,
    pill: 999,
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  type: {
    title: 32,      // titolo dashboard (nome utente)
    h1: 24,
    h2: 20,
    body: 15,
    sub: 13,
    cap: 12,
  },
  // Ombre morbide (elevazione leggera, stile floating)
  shadow: {
    soft: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
    card: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  },
  // Tempi animazione
  motion: { fast: 200, base: 260, slow: 320, pressScale: 0.97 },
} as const;

// Badge colore per ruolo (avatar)
export const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  Coordinatore: { label: 'C', color: DS.color.info },
  Capoturno: { label: 'CT', color: DS.color.warning },
  Infermiere: { label: 'I', color: DS.color.success },
  OSS: { label: 'O', color: DS.color.purple },
};

// Iniziali da un nome completo (fallback avatar senza foto).
export function initials(nome: string): string {
  const parts = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Tipo leggero per l'avatar (evita import circolari con types).
export type ProfileConfigLite = { kind: string; color: string; initials?: string; icon?: string; emoji?: string };

// Libreria icone minimal locale (Ionicons) per l'avatar — nessuna immagine esterna.
export const AVATAR_COLORS: string[] = ['#79B8FF', '#7BC47F', '#F2B84B', '#E66A6A', '#B69CFF', '#64D2FF', '#FF9F8B', '#9AA7B8'];

// Libreria avatar per categorie (locale, nessun download). Sanità = icone flat (Ionicons);
// Animali e Personaggi = emoji (glyph di sistema), perché non esistono come icone line.
export type AvatarItem = { key: string; label: string; icon?: string; emoji?: string };
export const AVATAR_LIBRARY: { category: string; items: AvatarItem[] }[] = [
  { category: 'Sanità', items: [
    { key: 'infermiere', label: 'Infermiere', icon: 'person' },
    { key: 'medico', label: 'Medico', icon: 'medical' },
    { key: 'ospedale', label: 'Ospedale', icon: 'business' },
    { key: 'siringa', label: 'Siringa', icon: 'eyedrop' },
    { key: 'stetoscopio', label: 'Stetoscopio', icon: 'pulse' },
    { key: 'ambulanza', label: 'Ambulanza', emoji: '\uD83D\uDE91' },
    { key: 'croce', label: 'Croce', icon: 'medkit' },
  ] },
  { category: 'Animali', items: [
    { key: 'cane', label: 'Cane', emoji: '\uD83D\uDC36' },
    { key: 'gatto', label: 'Gatto', emoji: '\uD83D\uDC31' },
    { key: 'coniglio', label: 'Coniglio', emoji: '\uD83D\uDC30' },
    { key: 'panda', label: 'Panda', emoji: '\uD83D\uDC3C' },
  ] },
  { category: 'Personaggi', items: [
    { key: 'uomo', label: 'Uomo', emoji: '\uD83D\uDC68' },
    { key: 'donna', label: 'Donna', emoji: '\uD83D\uDC69' },
    { key: 'ragazzo', label: 'Ragazzo', emoji: '\uD83D\uDC66' },
    { key: 'ragazza', label: 'Ragazza', emoji: '\uD83D\uDC67' },
  ] },
];

// Colori funzionali per area: usati su icona/titolo/grafici/KPI — MAI per colorare l'intera card.
export const AREA = {
  pianificazione: '#3B82F6',
  personale: '#30D158',
  richieste: '#FF9F0A',
  desiderate: '#BF5AF2',
  reperibilita: '#64D2FF',
  criticita: '#FF453A',
  report: '#5AC8FA',
  direzione: '#FFD60A',
  bancaore: '#32D74B',
  ferie: '#FFD60A',
  controllo: '#FF9F0A',
  account: '#AF52DE',
  reparti: '#64D2FF',
  sostituzioni: '#FF453A',
  assistente: '#AF52DE',
} as const;

// ============ FASE 1 — TOKEN SYSTEM (nessun valore sparso) ============
// SPACING — griglia 8pt
export const SPACING = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, h: 32, hh: 40, g: 48 } as const;

// TYPOGRAPHY
export const TYPE = {
  largeTitle: { fontSize: 34, fontWeight: '800' as const },
  title: { fontSize: 22, fontWeight: '800' as const },
  headline: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '500' as const },
  footnote: { fontSize: 13, fontWeight: '500' as const },
  caption: { fontSize: 12, fontWeight: '600' as const },
  kpi: { fontSize: 40, fontWeight: '800' as const },
} as const;

// GLASS MATERIAL — valori della spec (FASE 2)
export const GLASS = {
  background: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.12)',
  highlight: 'rgba(255,255,255,0.18)',
  blur: 60,
  radius: 32,
} as const;

// DEPTH — ombre minime, mai pesanti
export const DEPTH = {
  none: {},
  soft: { shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  floating: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
} as const;

// MOTION SYSTEM — animazioni nominate (FASE 3), nessuna animazione casuale
export const MOTION = {
  cardPress:    { scaleTo: 0.98, durIn: 170, durOut: 170 },
  tabChange:    { dur: 200, enterScaleFrom: 0.92, exitOpacity: 0.6 },
  pageEnter:    { dur: 220, dy: 12, scaleFrom: 0.99 },
  pageExit:     { dur: 220, dy: 12 },
  modalOpen:    { dur: 240, scaleFrom: 0.94 },
  modalClose:   { dur: 240 },
  kpiUpdate:    { dur: 300 },
  sectionReveal:{ dur: 200, dy: 6 },
  pillIndicator:{ dur: 220 },
} as const;
