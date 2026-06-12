// services/reperibilitaOp.ts — persistenza disponibilità operatore (overlay, NON tocca il motore). Logica pura in utils/reperibilitaOpLogic.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReperibilitaOperatore } from '../types';
export { aggiungiRichiestaRep, setStatoRep, badgeColorRep } from '../utils/reperibilitaOpLogic';

const KEY = 'turnover.reperibilita_op';
export async function loadRepOp(): Promise<ReperibilitaOperatore[]> {
  try { const raw = await AsyncStorage.getItem(KEY); if (!raw) return []; const d = JSON.parse(raw); return Array.isArray(d) ? d : []; } catch { return []; }
}
export async function saveRepOp(list: ReperibilitaOperatore[]): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(Array.isArray(list) ? list : [])); } catch { /* no-op */ }
}
