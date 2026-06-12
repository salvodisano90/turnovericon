// utils/reperibilitaOpLogic.ts — transizioni PURE per la disponibilità operatore (testabili). Nessun import RN.
import { ReperibilitaOperatore, StatoReperibilita } from '../types';

export function aggiungiRichiestaRep(list: ReperibilitaOperatore[], payload: Omit<ReperibilitaOperatore, 'id' | 'stato'>): ReperibilitaOperatore[] {
  const id = `repop_${Date.now()}_${payload.staffId}_${Math.floor(Math.random() * 1e4)}`;
  return [{ ...payload, id, stato: 'attesa' }, ...(list || [])];
}
export function setStatoRep(list: ReperibilitaOperatore[], id: string, stato: StatoReperibilita): ReperibilitaOperatore[] {
  return (list || []).map((x) => (x.id === id ? { ...x, stato } : x));
}
export function badgeColorRep(stato: StatoReperibilita, colors: { warning: string; success: string; danger: string }): string {
  return stato === 'approvata' ? colors.success : stato === 'rifiutata' ? colors.danger : colors.warning;
}
