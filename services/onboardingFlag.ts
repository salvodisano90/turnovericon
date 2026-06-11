// services/onboardingFlag.ts — flag "primo avvio completato" (AsyncStorage, best-effort).
import AsyncStorage from '@react-native-async-storage/async-storage';
const KEY = 'turnover.onboardingDone';
export async function isOnboardingDone(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(KEY)) === '1'; } catch { return false; }
}
export async function markOnboardingDone(): Promise<void> {
  try { await AsyncStorage.setItem(KEY, '1'); } catch { /* no-op */ }
}
