// utils/theme.ts — iOS-style theme palettes (dark default, light supported)

import { ThemeMode, Turno } from '../types';

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
  bg: '#000000',
  bgElevated: '#1C1C1E',
  card: '#1C1C1E',
  card2: '#2C2C2E',
  text: '#FFFFFF',
  text2: '#AEAEB2',
  text3: '#8E8E93',
  line: '#38383A',
  separator: '#2C2C2E',
  blue: '#0A84FF',
  blueSoft: 'rgba(10,132,255,0.16)',
  green: '#30D158',
  greenSoft: 'rgba(48,209,88,0.16)',
  yellow: '#FFD60A',
  yellowSoft: 'rgba(255,214,10,0.16)',
  red: '#FF453A',
  redSoft: 'rgba(255,69,58,0.16)',
  purple: '#BF5AF2',
  overlay: 'rgba(0,0,0,0.6)',
  tabInactive: '#8E8E93',
  shift: {
    M: { fg: '#0A84FF', bg: 'rgba(10,132,255,0.18)' },
    P: { fg: '#FF9F0A', bg: 'rgba(255,159,10,0.18)' },
    N: { fg: '#BF5AF2', bg: 'rgba(191,90,242,0.18)' },
    R: { fg: '#98989F', bg: 'rgba(142,142,147,0.16)' },
    S: { fg: '#64D2FF', bg: 'rgba(100,210,255,0.18)' },
    G: { fg: '#FF9F0A', bg: 'rgba(255,159,10,0.18)' },
    F: { fg: '#30D158', bg: 'rgba(48,209,88,0.18)' },
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
