// services/storage.ts — local persistence via AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Backup, PersistedData, ThemeMode } from '../types';
import { STORAGE_KEY, THEME_KEY, LEGACY_STORAGE_KEY, LEGACY_THEME_KEY, APP_NAME } from '../utils/constants';
import { migrateFerie, migratePianos, sanitizeStaff } from '../utils/helpers';

const BACKUP_VERSION = 1;

export function checksum(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
  return h;
}

export async function loadData(): Promise<PersistedData | null> {
  try {
    let raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Migrazione automatica dati storici (TurniAI → TURNOVER)
      const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) { raw = legacy; await AsyncStorage.setItem(STORAGE_KEY, legacy); }
    }
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object') return null;
    return {
      reparti: Array.isArray(d.reparti) ? d.reparti : [],
      staff: Array.isArray(d.staff) ? d.staff.map(sanitizeStaff) : [],
      ferie: migrateFerie(Array.isArray(d.ferie) ? d.ferie : []),
      pianos: migratePianos(d.pianos && typeof d.pianos === 'object' ? d.pianos : {}),
      month: typeof d.month === 'number' ? d.month : new Date().getMonth(),
      year: typeof d.year === 'number' ? d.year : new Date().getFullYear(),
      audit: Array.isArray(d.audit) ? d.audit : [],
      history: Array.isArray(d.history) ? d.history : [],
      future: Array.isArray(d.future) ? d.future : [],
      desiderata: Array.isArray(d.desiderata) ? d.desiderata : [],
      mode: d.mode === 'rigida' || d.mode === 'operativa' ? d.mode : 'operativa',
      aiMode: d.aiMode === 'rapida' || d.aiMode === 'equa' || d.aiMode === 'coordinatore' ? d.aiMode : 'coordinatore',
      matriciCustom: Array.isArray(d.matriciCustom) ? d.matriciCustom : [],
      matriceMese: d.matriceMese && typeof d.matriceMese === 'object' ? d.matriceMese : {},
    };
  } catch {
    return null;
  }
}

export async function saveData(data: PersistedData): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore write errors
  }
}

// --- Backup professionale (formato JSON leggibile, con checksum di integrità) ---
export function serializeBackup(data: PersistedData): string {
  const core: PersistedData = {
    reparti: data.reparti,
    staff: data.staff,
    ferie: data.ferie,
    pianos: data.pianos,
    month: data.month,
    year: data.year,
    audit: data.audit || [],
  };
  const backup: Backup = {
    app: APP_NAME,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    checksum: checksum(JSON.stringify(core)),
    data: core,
  };
  return JSON.stringify(backup, null, 2);
}

export function parseBackup(text: string): { ok: boolean; backup?: Backup; error?: string } {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON non valido' };
  }
  const b = obj as Partial<Backup>;
  if (!b || typeof b !== 'object' || (b.app !== 'TURNOVER' && b.app !== 'TurniAI')) return { ok: false, error: 'Non è un backup TURNOVER' };
  if (typeof b.version !== 'number') return { ok: false, error: 'Versione mancante' };
  const d = b.data as Partial<PersistedData> | undefined;
  if (!d || !Array.isArray(d.reparti) || !Array.isArray(d.staff) || !Array.isArray(d.ferie) || typeof d.pianos !== 'object') {
    return { ok: false, error: 'Struttura dati non valida' };
  }
  const core: PersistedData = {
    reparti: d.reparti,
    staff: d.staff,
    ferie: d.ferie,
    pianos: d.pianos as PersistedData['pianos'],
    month: typeof d.month === 'number' ? d.month : new Date().getMonth(),
    year: typeof d.year === 'number' ? d.year : new Date().getFullYear(),
    audit: Array.isArray(d.audit) ? d.audit : [],
  };
  // Verifica integrità sul payload COME RICEVUTO (`d`): per qualunque backup prodotto
  // dall'app `JSON.stringify(d)` coincide con il `core` originariamente firmato, ed è
  // robusto a campi mancanti (es. backup vecchi senza `audit`) o aggiunti in futuro.
  if (typeof b.checksum === 'number' && b.checksum !== checksum(JSON.stringify(d))) {
    return { ok: false, error: 'Checksum non corrispondente: backup corrotto' };
  }
  return { ok: true, backup: { app: b.app || APP_NAME, version: b.version, createdAt: b.createdAt || '', checksum: b.checksum || 0, data: core } };
}

export async function loadThemeMode(): Promise<ThemeMode | null> {
  try {
    let raw = await AsyncStorage.getItem(THEME_KEY);
    if (!raw) { const lg = await AsyncStorage.getItem(LEGACY_THEME_KEY); if (lg) { raw = lg; await AsyncStorage.setItem(THEME_KEY, lg); } }
    return raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    return null;
  }
}

export async function saveThemeMode(mode: ThemeMode): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_KEY, mode);
  } catch {
    // ignore
  }
}
