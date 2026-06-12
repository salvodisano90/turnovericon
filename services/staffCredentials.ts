// services/staffCredentials.ts — persistenza credenziali staff (pattern reperibilitaOp). Logica pura in utils/staffAuth.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StaffCreds } from '../utils/staffAuth';
const KEY = 'turnover.staff_credentials';
export async function loadStaffCreds(): Promise<StaffCreds> {
  try { const raw = await AsyncStorage.getItem(KEY); if (!raw) return {}; const d = JSON.parse(raw); return d && typeof d === 'object' ? d : {}; } catch { return {}; }
}
export async function saveStaffCreds(c: StaffCreds): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(c || {})); } catch { /* no-op */ }
}
