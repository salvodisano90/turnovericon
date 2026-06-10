// utils/privacy.ts — Privacy a livello DATI per il ruolo STAFF.
// Lo Staff non deve MAI ricevere dati sensibili (esenzioni, 104, limitazioni sanitarie, permessi
// speciali, note riservate, causali HR). Queste funzioni rimuovono i campi sensibili PRIMA che i
// dati raggiungano le schermate Staff e gli export. La motivazione di un'assenza diventa generica.

// Campi sensibili dell'operatore che lo Staff non deve vedere.
export const SENSITIVE_STAFF_FIELDS = [
  'esenzioniTurni', 'esenzioniSettori', 'esenteWeekend', 'esenteFestivi',
  'competenze', 'livello', 'anniEsperienza', 'oreSettimanali',
  'note', 'noteRiservate', 'motivo', 'motivoEsenzione', 'tutela', 'legge104', 'l104', 'hr', 'seasonal',
];

// Campi consentiti allo Staff per ogni operatore (solo identificativi e ciò che serve al calendario).
export function sanitizeStaffMemberView<T extends Record<string, any>>(s: T): Partial<T> {
  const out: Record<string, any> = {};
  const allowed = ['id', 'nome', 'qualifica', 'reparti', 'offset', 'nottiPerCiclo', 'contratto'];
  for (const k of allowed) if (k in s) out[k] = (s as any)[k];
  return out as Partial<T>;
}

export function sanitizeStaffListView<T extends Record<string, any>>(list: T[]): Partial<T>[] {
  return (list || []).map(sanitizeStaffMemberView);
}

// Etichetta generica per qualunque assenza mostrata allo Staff (mai la causale).
export function genericAbsenceLabel(): string { return 'Assente'; }

// Ferie/assenze per lo Staff: nessuna motivazione, solo il fatto che è approvata.
export function sanitizeFerieForStaff(ferie: any[]): any[] {
  return (ferie || []).map((f) => ({ infId: f.infId, from: f.from, to: f.to, month: f.month, year: f.year, motivo: 'Assenza approvata' }));
}

// Lo Staff vede solo le PROPRIE richieste (con la propria motivazione). Le altrui sono rimosse.
export function sanitizeRequestsForStaff(requests: any[], myInfId?: string): any[] {
  if (!myInfId) return [];
  return (requests || []).filter((r) => r.infId === myInfId);
}

export function isSensitiveField(key: string): boolean { return SENSITIVE_STAFF_FIELDS.indexOf(key) >= 0; }

// Verifica che un oggetto operatore non contenga più alcun campo sensibile (per i test/guard).
export function hasNoSensitiveData(obj: Record<string, any>): boolean {
  return Object.keys(obj || {}).every((k) => !isSensitiveField(k));
}
