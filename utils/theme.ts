// utils/theme.ts — iOS-style theme palettes (dark default, light supported)

import { ThemeMode, Turno } from '../types';
import { DS } from './designSystem';

export interface ShiftColor {
  fg: string;
  bg: string;
}

export interface ThemeColors {
  mode: ThemeMode;
  bg: string;
  bgElevated: string;
  card: string;
  card2: string;
  text: string;
  text2: string;
  text3: string;
  line: string;
  separator: string;
  blue: string;
  blueSoft: string;
  green: string;
  greenSoft: string;
  yellow: string;
  yellowSoft: string;
  red: string;
  redSoft: string;
  purple: string;
  overlay: string;
  tabInactive: string;
  shift: Record<Turno, ShiftColor>;
}

const dark: ThemeColors = {
  mode: 'dark',
  bg: DS.color.bg,
  bgElevated: DS.color.bgElevated,
  card: DS.color.card,
  card2: DS.color.card2,
  text: DS.color.text,
  text2: DS.color.text2,
  text3: DS.color.text3,
  line: DS.color.border,
  separator: DS.color.separator,
  blue: DS.color.info,
  blueSoft: DS.color.infoSoft,
  green: DS.color.success,
  greenSoft: DS.color.successSoft,
  yellow: DS.color.warning,
  yellowSoft: DS.color.warningSoft,
  red: DS.color.danger,
  redSoft: DS.color.dangerSoft,
  purple: DS.color.purple,
  overlay: DS.color.overlay,
  tabInactive: DS.color.text3,
  shift: {
    M: { fg: '#79B8FF', bg: 'rgba(121,184,255,0.24)' },
    P: { fg: '#F2B84B', bg: 'rgba(242,184,75,0.24)' },
    N: { fg: '#B69CFF', bg: 'rgba(182,156,255,0.24)' },
    R: { fg: 'rgba(255,255,255,0.55)', bg: 'rgba(255,255,255,0.10)' },
    S: { fg: '#64D2FF', bg: 'rgba(100,210,255,0.24)' },
    G: { fg: '#F2B84B', bg: 'rgba(242,184,75,0.24)' },
    F: { fg: '#7BC47F', bg: 'rgba(123,196,127,0.24)' },
  },
};

const light: ThemeColors = {
  mode: 'light',
  bg: '#F2F2F7',
  bgElevated: '#FFFFFF',
  card: '#FFFFFF',
  card2: '#F2F2F7',
  text: '#000000',
  text2: '#6C6C70',
  text3: '#AEAEB2',
  line: '#D1D1D6',
  separator: '#E5E5EA',
  blue: '#007AFF',
  blueSoft: 'rgba(0,122,255,0.12)',
  green: '#34C759',
  greenSoft: 'rgba(52,199,89,0.14)',
  yellow: '#FF9500',
  yellowSoft: 'rgba(255,149,0,0.14)',
  red: '#FF3B30',
  redSoft: 'rgba(255,59,48,0.12)',
  purple: '#AF52DE',
  overlay: 'rgba(0,0,0,0.4)',
  tabInactive: '#8E8E93',
  shift: {
    M: { fg: '#3B82F6', bg: '#EFF6FF' },
    P: { fg: '#D97706', bg: '#FFF7EA' },
    N: { fg: '#8B5CF6', bg: '#F3F0FF' },
    R: { fg: '#9CA3AF', bg: '#F4F5F7' },
    S: { fg: '#0EA5E9', bg: '#E0F2FE' },
    G: { fg: '#B45309', bg: '#FEF3C7' },
    F: { fg: '#10B981', bg: '#E7F8F0' },
  },
};

export const THEMES: Record<ThemeMode, ThemeColors> = { dark, light };

export function getTheme(mode: ThemeMode): ThemeColors {
  return THEMES[mode] || dark;
}

// ── Scala tipografica iOS (HIG) — design system unificato ────────────────────
// Additiva: i componenti possono adottarla gradualmente senza rotture.
// fontWeight come stringhe per compatibilità con React Native TextStyle.
export const TYPE = {
  largeTitle: { fontSize: 34, fontWeight: '700', lineHeight: 41 },
  title1: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  title2: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  title3: { fontSize: 20, fontWeight: '600', lineHeight: 25 },
  headline: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 17, fontWeight: '400', lineHeight: 22 },
  callout: { fontSize: 16, fontWeight: '400', lineHeight: 21 },
  subhead: { fontSize: 15, fontWeight: '400', lineHeight: 20 },
  footnote: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
} as const;

// Target touch minimo (HIG 44pt / Material 48dp) — per uso uniforme nei componenti.
export const TOUCH_MIN = 44;

// ── Spacing & Radius (iOS) — scale del design system (additive) ──────────────
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const RADIUS = { sm: 12, md: 16, lg: 20, xl: 24 } as const;
