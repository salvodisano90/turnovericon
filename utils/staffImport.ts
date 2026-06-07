// utils/staffImport.ts — Import massivo personale (LOGICA PURA: validazione + mappatura + template).
// La selezione file e la lettura .xlsx avvengono nella UI (richiede expo-document-picker/SheetJS sul device);
// qui c'è la parte verificabile: validazione righe, anteprima, errori, duplicati e template scaricabile.

import { CONTRATTI } from './constants';

export const STAFF_IMPORT_COLUMNS = ['nome', 'cognome', 'matricola', 'ruolo', 'contratto', 'oreSettimanali', 'reparto', 'esenzioni'] as const;

export interface StaffImportDraft {
  nome: string;
  cognome?: string;
  matricola?: string;
  qualifica: string;          // ruolo
  contratto: string;          // id contratto valido
  oreSettimanali?: number;
  reparti: string[];          // id reparto risolti
  esenteWeekend?: boolean;
  esenteFestivi?: boolean;
  esenzioniTurni?: string[];
}
export interface ImportError { row: number; field: string; message: string; }
export interface StaffImportResult {
  valid: StaffImportDraft[];
  errors: ImportError[];
  duplicates: { row: number; reason: string }[];
}

const RUOLI = ['Infermiere', 'OSS', 'Coordinatore', 'Medico'];
const norm = (s: any) => String(s == null ? '' : s).trim();

function resolveRuolo(v: string): string | null {
  const t = v.toLowerCase();
  const hit = RUOLI.find((r) => r.toLowerCase() === t);
  if (hit) return hit;
  if (t.startsWith('inf')) return 'Infermiere';
  if (t === 'oss') return 'OSS';
  if (t.startsWith('coord')) return 'Coordinatore';
  if (t.startsWith('med')) return 'Medico';
  return null;
}
function resolveContratto(v: string): string | null {
  if (!v) return 'FT36';
  const t = v.toUpperCase();
  const byId = CONTRATTI.find((c) => c.id.toUpperCase() === t);
  if (byId) return byId.id;
  const byLabel = CONTRATTI.find((c) => c.label.toLowerCase() === v.toLowerCase());
  return byLabel ? byLabel.id : null;
}
function resolveReparti(v: string, reparti: { id: string; nome?: string }[]): { ids: string[]; unknown: string[] } {
  const ids: string[] = [], unknown: string[] = [];
  for (const part of v.split(/[;,]/).map((x) => x.trim()).filter(Boolean)) {
    const r = reparti.find((x) => x.id === part || (x.nome && x.nome.toLowerCase() === part.toLowerCase()));
    if (r) ids.push(r.id); else unknown.push(part);
  }
  return { ids, unknown };
}
function parseEsenzioni(v: string): { esenteWeekend?: boolean; esenteFestivi?: boolean; esenzioniTurni?: string[] } {
  const out: any = {};
  const turni: string[] = [];
  for (const part of v.split(/[;,]/).map((x) => x.trim().toLowerCase()).filter(Boolean)) {
    if (part.includes('weekend') || part.includes('festiv')) { if (part.includes('weekend')) out.esenteWeekend = true; if (part.includes('festiv')) out.esenteFestivi = true; }
    else if (part === 'n' || part.includes('nott')) turni.push('N');
    else if (part === 'm' || part.includes('matt')) turni.push('M');
    else if (part === 'p' || part.includes('pome')) turni.push('P');
  }
  if (turni.length) out.esenzioniTurni = turni;
  return out;
}

// rows: righe già mappate per nome colonna (la UI converte il foglio .xlsx in oggetti).
export function parseStaffRows(rows: Record<string, any>[], reparti: { id: string; nome?: string }[], existing: { matricola?: string; nome?: string; cognome?: string }[] = []): StaffImportResult {
  const valid: StaffImportDraft[] = [];
  const errors: ImportError[] = [];
  const duplicates: { row: number; reason: string }[] = [];
  const seenMat = new Set<string>();
  const seenNom = new Set<string>();
  for (const e of existing) { if (e.matricola) seenMat.add(e.matricola.toLowerCase()); seenNom.add(`${norm(e.nome)}|${norm(e.cognome)}`.toLowerCase()); }

  rows.forEach((raw, i) => {
    const row = i + 2; // riga foglio (1 = intestazione)
    const nome = norm(raw.nome);
    if (!nome) { errors.push({ row, field: 'nome', message: 'Nome mancante' }); return; }
    const cognome = norm(raw.cognome) || undefined;
    const matricola = norm(raw.matricola) || undefined;

    const qualifica = resolveRuolo(norm(raw.ruolo));
    if (!qualifica) { errors.push({ row, field: 'ruolo', message: `Ruolo non valido: "${norm(raw.ruolo)}" (usa Infermiere/OSS/Coordinatore/Medico)` }); return; }
    const contratto = resolveContratto(norm(raw.contratto));
    if (!contratto) { errors.push({ row, field: 'contratto', message: `Contratto non valido: "${norm(raw.contratto)}"` }); return; }

    let oreSettimanali: number | undefined;
    const oreRaw = norm(raw.oreSettimanali);
    if (oreRaw) { const n = Number(oreRaw.replace(',', '.')); if (!isFinite(n) || n <= 0 || n > 60) { errors.push({ row, field: 'oreSettimanali', message: `Ore settimanali non valide: "${oreRaw}"` }); return; } oreSettimanali = n; }

    const { ids, unknown } = resolveReparti(norm(raw.reparto), reparti);
    if (unknown.length) errors.push({ row, field: 'reparto', message: `Reparto non trovato: ${unknown.join(', ')}` });

    // duplicati
    const matKey = matricola ? matricola.toLowerCase() : '';
    const nomKey = `${nome}|${norm(cognome)}`.toLowerCase();
    if (matKey && (seenMat.has(matKey))) { duplicates.push({ row, reason: `Matricola duplicata: ${matricola}` }); return; }
    if (!matKey && seenNom.has(nomKey)) { duplicates.push({ row, reason: `Nominativo duplicato: ${nome} ${cognome || ''}`.trim() }); return; }
    if (matKey) seenMat.add(matKey); seenNom.add(nomKey);

    valid.push({ nome, cognome, matricola, qualifica, contratto, oreSettimanali, reparti: ids, ...parseEsenzioni(norm(raw.esenzioni)) });
  });

  return { valid, errors, duplicates };
}

// Template scaricabile (intestazione + 2 esempi). La UI lo scrive in .xlsx.
export function staffImportTemplateRows(): string[][] {
  return [
    [...STAFF_IMPORT_COLUMNS],
    ['Mario', 'Rossi', '12345', 'Infermiere', 'FT36', '36', 'Medicina', 'weekend;notti'],
    ['Lucia', 'Bianchi', '12346', 'OSS', 'PT50', '', 'Chirurgia', ''],
  ];
}
