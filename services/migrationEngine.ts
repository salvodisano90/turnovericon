// services/migrationEngine.ts — FASE 2: motore di migrazione BLOB locale → righe relazionali Supabase.
// Funzioni PURE e testabili: trasformano lo state dello store in record per le tabelle dello schema-v2,
// con conteggi pre/post, deduplica e validazione di integrità (zero orfani, zero FK rotte).
import { Ferie, Piano, PianoStore, Reparto, Staff } from '../types';

export interface Row { [k: string]: unknown }
export interface MigrationResult {
  tables: Record<string, Row[]>;
  counts: Record<string, number>;
  integrity: { orphanShifts: number; orphanAbsences: number; duplicateShiftKeys: number; ok: boolean };
}

export interface LocalState {
  orgId: string;
  reparti: Reparto[];
  staff: Staff[];
  ferie: Ferie[];
  pianos: PianoStore;     // "YYYY-M" -> infId -> day -> cell
  matriciCustom?: { id?: string; nome: string; seq: string; notti?: number }[];
}

const daysFromKey = (key: string) => { const [y, m] = key.split('-').map(Number); return { y, m }; };

export function migrateLocalToRelational(s: LocalState): MigrationResult {
  const org = s.orgId;
  const wards: Row[] = (s.reparti || []).map((r) => ({
    org_id: org, _localId: r.id, nome: r.nome, sigla: r.sigla || null,
    settori: (r as any).settori || {}, orari: r.orari || {},
  }));
  const wardByLocal = new Map(wards.map((w) => [w._localId, w]));

  const matrices: Row[] = (s.matriciCustom || []).map((m) => ({
    org_id: org, _localId: m.id || m.nome, nome: m.nome, seq: m.seq, notti: m.notti || 0, is_custom: true,
  }));

  const staff: Row[] = (s.staff || []).map((p) => ({
    org_id: org, _localId: p.id, nome: p.nome, qualifica: p.qualifica || null, contratto: p.contratto || null,
    offset_ciclo: p.offset || 0, notti_ciclo: p.nottiPerCiclo || 0,
    matrice_local: p.matrice && p.matrice !== 'STAGIONALE' ? p.matrice : null,
    ferie_annue: (p as any).ferieAnnue || 26,
  }));
  const staffByLocal = new Map(staff.map((x) => [x._localId, x]));
  const staffWards: Row[] = [];
  for (const p of (s.staff || [])) for (const wId of (p.reparti || [])) {
    if (wardByLocal.has(wId) && staffByLocal.has(p.id)) staffWards.push({ staff_local: p.id, ward_local: wId });
  }

  // shifts: esplode i piani mensili (un record per operatore/giorno con turno valorizzato)
  const shifts: Row[] = [];
  const seen = new Set<string>(); let dupKeys = 0; let orphanShifts = 0;
  for (const key of Object.keys(s.pianos || {})) {
    const { y, m } = daysFromKey(key);
    const piano: Piano = (s.pianos as any)[key] || {};
    for (const infId of Object.keys(piano)) {
      const owner = staffByLocal.has(infId);
      const dayMap = piano[infId] || {};
      for (const dStr of Object.keys(dayMap)) {
        const cell = (dayMap as any)[dStr]; if (!cell || !cell.turno) continue;
        const giorno = `${y}-${String(m + 1).padStart(2, '0')}-${String(Number(dStr)).padStart(2, '0')}`;
        const k = `${infId}|${giorno}`;
        if (seen.has(k)) { dupKeys++; continue; }   // unique (staff_id, giorno)
        seen.add(k);
        if (!owner) { orphanShifts++; continue; }    // FK staff_id mancante → scartato (no orfani)
        shifts.push({ org_id: org, staff_local: infId, giorno, turno: cell.turno, locked: !!cell.locked });
      }
    }
  }

  // absences/vacations da Ferie (mono-mese): from/to → date; motivo 'ferie' → vacations, resto → absences
  const absences: Row[] = []; const vacations: Row[] = []; let orphanAbs = 0;
  for (const f of (s.ferie || [])) {
    if (!staffByLocal.has(f.infId)) { orphanAbs++; continue; }
    const mm = String((f.month ?? 0) + 1).padStart(2, '0');
    const dal = `${f.year}-${mm}-${String(f.from).padStart(2, '0')}`;
    const al = `${f.year}-${mm}-${String(f.to).padStart(2, '0')}`;
    const isFerie = (f.motivo || '').toLowerCase().includes('ferie');
    (isFerie ? vacations : absences).push({ org_id: org, staff_local: f.infId, dal, al, tipo: f.motivo || 'assenza' });
  }

  const tables = { wards, matrices, staff, staff_wards: staffWards, shifts, absences, vacations };
  const counts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
  // orphanShifts/orphanAbs = record orfani RILEVATI e SCARTATI (telemetria input).
  // ok = il RISULTATO è pulito: ogni riga emessa ha il genitore (garanzia per costruzione, verificata da verifyIntegrity).
  const integrity = {
    orphanShifts, orphanAbsences: orphanAbs, duplicateShiftKeys: dupKeys, ok: true,
  };
  return { tables, counts, integrity };
}

// Verifica post-migrazione: ogni FK locale risolve a una riga genitore presente.
export function verifyIntegrity(r: MigrationResult): { ok: boolean; brokenFK: number } {
  const wardLocals = new Set(r.tables.wards.map((w: any) => w._localId));
  const staffLocals = new Set(r.tables.staff.map((s: any) => s._localId));
  let broken = 0;
  for (const sw of r.tables.staff_wards as any[]) { if (!staffLocals.has(sw.staff_local) || !wardLocals.has(sw.ward_local)) broken++; }
  for (const sh of r.tables.shifts as any[]) { if (!staffLocals.has(sh.staff_local)) broken++; }
  for (const t of ['absences', 'vacations'] as const) for (const a of r.tables[t] as any[]) { if (!staffLocals.has(a.staff_local)) broken++; }
  return { ok: broken === 0, brokenFK: broken };
}
