// utils/designSystem.ts — Design System centrale di TURNOVER (tema scuro).
// Unica fonte di verità per colori, raggi, spaziatura, tipografia e ombre.
// Ispirazione: Apple Health/Fitness/Wallet, Notion, Threads (profondità, vetro, minimalismo).
// La palette dark del tema importa questi token: cambiando qui, cambia tutta l'app.

export const DS = {
  color: {
    // Sfondi — Black AMOLED foundation
    bg: '#000000',
    bgElevated: '#0A0A0A',
    bgTertiary: '#141414',
    // Superfici (glass sobrio su nero)
    card: 'rgba(255,255,255,0.05)',
    card2: 'rgba(255,255,255,0.08)',
    border: 'rgba(255,255,255,0.10)',
    separator: 'rgba(255,255,255,0.06)',
    // Testo
    text: '#FFFFFF',
    text2: '#A8A8A8',
    text3: '#6E6E73',
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
    card: 24,
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
  pianificazione: '#4DA3FF',
  personale: '#30D158',
  controllo: '#FF9F0A',
  ferie: '#64D2FF',
  desiderate: '#BF5AF2',
  reperibilita: '#FF6482',
  report: '#FFD60A',
  criticita: '#FF453A',
  account: '#5E5CE6',
} as const;
