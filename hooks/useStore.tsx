// hooks/useStore.tsx — central state store (engine + persistence)

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef,
} from 'react';
import {
  AuditEntry, Backup, BuildStats, Cell, Coverage, Desiderata, EngineContext, Ferie, GenerationMode, PlanMode, Matrice, Piano, PianoStore, Reparto, Snapshot, Staff, Turno,
} from '../types';
import { buildPiano, computeCoverage, smartFill, edgeFromPiano, nextEdgeFromPiano } from '../services/engine';
import { loadData, parseBackup, saveData, serializeBackup } from '../services/storage';
import { cloneDeep, isWork, monthKey, migrateFerie, migratePianos } from '../utils/helpers';
import { MONTHS, MATRICI, legacyAbsenceLabel } from '../utils/constants';

const HISTORY_MAX = 12;
const AUDIT_MAX = 400;
let auditSeq = 0;
function genAuditId(): string {
  auditSeq += 1;
  return Date.now().toString(36) + '-' + auditSeq.toString(36);
}
function snapshot(s: { reparti: Reparto[]; staff: Staff[]; ferie: Ferie[]; pianos: PianoStore; month: number; year: number }): Snapshot {
  return { reparti: s.reparti, staff: s.staff, ferie: s.ferie, pianos: s.pianos, month: s.month, year: s.year };
}
function ferieLabel(s: { staff: Staff[] }, f: Ferie): string {
  const nome = s.staff.find((m) => m.id === f.infId)?.nome || f.infId;
  const motivo = (f.motivo && f.motivo.trim()) ? f.motivo.trim() : (legacyAbsenceLabel(f.tipo) || 'Assenza');
  return `${nome} · ${motivo} ${f.from}–${f.to}`;
}
function sameFerie(a: Ferie, b: Ferie): boolean {
  return a.infId === b.infId && a.from === b.from && a.to === b.to && a.month === b.month && a.year === b.year;
}
let desSeq = 0;
function genDesId(): string { desSeq += 1; return 'd' + Date.now().toString(36) + '-' + desSeq.toString(36); }
const DES_TIPO_LABEL: Record<string, string> = { lavoro: 'Desidera lavorare', riposo: 'Desidera riposo', mattina: 'Preferirebbe mattina', pomeriggio: 'Preferirebbe pomeriggio', evitaNotte: 'Eviterebbe la notte' };
function desLabel(s: { staff: Staff[] }, d: Desiderata): string {
  const nome = s.staff.find((m) => m.id === d.infId)?.nome || d.infId;
  const range = d.dateEnd && d.dateEnd !== d.dateStart ? `${d.dateStart}–${d.dateEnd}` : d.dateStart;
  return `${nome} · ${DES_TIPO_LABEL[d.tipo] || d.tipo} · ${range} (${d.priorita})`;
}

interface StoreState {
  reparti: Reparto[];
  staff: Staff[];
  ferie: Ferie[];
  pianos: PianoStore;
  month: number;
  year: number;
  filterReparto: string;
  hydrated: boolean;
  audit: AuditEntry[];
  history: Snapshot[];
  future: Snapshot[];
  desiderata: Desiderata[];
  mode: GenerationMode;
  aiMode: PlanMode;
  matriciCustom: Matrice[];
  matriceMese: Record<string, string>;
}

type Action =
  | { type: 'HYDRATE'; payload: Partial<StoreState> }
  | { type: 'MERGE'; payload: Partial<StoreState> };

const now = new Date();
const initialState: StoreState = {
  reparti: [],
  staff: [],
  ferie: [],
  pianos: {},
  month: now.getMonth(),
  year: now.getFullYear(),
  filterReparto: 'all',
  hydrated: false,
  audit: [],
  history: [],
  future: [],
  desiderata: [],
  mode: 'operativa',
  aiMode: 'coordinatore',
  matriciCustom: [],
  matriceMese: {},
};

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, ...action.payload, hydrated: true };
    case 'MERGE':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

interface StoreContextValue {
  reparti: Reparto[];
  staff: Staff[];
  ferie: Ferie[];
  month: number;
  year: number;
  filterReparto: string;
  hydrated: boolean;
  currentPiano: Piano;
  prevPiano: Piano;
  coverage: Coverage;
  ctx: EngineContext;
  addReparto: (rep: Reparto) => void;
  updateReparto: (rep: Reparto) => void;
  removeReparto: (id: string) => void;
  addStaff: (s: Staff) => void;
  updateStaff: (s: Staff) => void;
  removeStaff: (id: string) => void;
  addFerie: (f: Ferie) => void;
  removeFerie: (f: Ferie) => void;
  setCell: (infId: string, day: number, turno: Turno, repartoId: string | null, settore: string | null) => { inf: Staff; settore: string } | null;
  regenerate: () => { stats: BuildStats; coverage: Coverage };
  setMonth: (dir: number) => void;
  setFilter: (rep: string) => void;
  audit: AuditEntry[];
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  updateFerie: (orig: Ferie, next: Ferie) => void;
  exportBackup: () => string;
  importBackup: (text: string, parts?: { reparti?: boolean; staff?: boolean; ferie?: boolean; pianos?: boolean }) => { ok: boolean; error?: string };
  logEvent: (op: string, entity: string, before: string | null, after: string | null) => void;
  desiderata: Desiderata[];
  mode: GenerationMode;
  addDesiderata: (d: Desiderata) => void;
  updateDesiderata: (id: string, next: Desiderata) => void;
  removeDesiderata: (id: string) => void;
  setMode: (m: GenerationMode) => void;
  aiMode: PlanMode;
  setAiMode: (m: PlanMode) => void;
  matriciCustom: Matrice[];
  matriceMese: Record<string, string>;
  addMatriceCustom: (m: Matrice) => void;
  removeMatriceCustom: (id: string) => void;
  setMatriceMese: (id: string) => void;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

function optimizeOf(s: StoreState): boolean { return s.aiMode !== 'rapida'; }
function ctxOf(s: StoreState): EngineContext {
  return { reparti: s.reparti, staff: s.staff, ferie: s.ferie, month: s.month, year: s.year, mode: s.mode, desiderata: s.desiderata, matrici: [...MATRICI, ...s.matriciCustom], matriceMese: s.matriceMese[monthKey(s.year, s.month)] };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // hydrate once
  useEffect(() => {
    let mounted = true;
    loadData().then((d) => {
      if (!mounted) return;
      if (d) {
        dispatch({
          type: 'HYDRATE',
          payload: {
            reparti: d.reparti, staff: d.staff, ferie: d.ferie, pianos: d.pianos, month: d.month, year: d.year,
            audit: d.audit || [], history: d.history || [], future: d.future || [],
            desiderata: d.desiderata || [], mode: d.mode || 'operativa', aiMode: d.aiMode || 'coordinatore',
            matriciCustom: d.matriciCustom || [], matriceMese: d.matriceMese || {},
          },
        });
      } else {
        dispatch({ type: 'HYDRATE', payload: {} });
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // persist on relevant changes
  useEffect(() => {
    if (!state.hydrated) return;
    void saveData({
      reparti: state.reparti,
      staff: state.staff,
      ferie: state.ferie,
      pianos: state.pianos,
      month: state.month,
      year: state.year,
      audit: state.audit,
      history: state.history,
      future: state.future,
      desiderata: state.desiderata,
      mode: state.mode,
    });
  }, [state.reparti, state.staff, state.ferie, state.pianos, state.month, state.year, state.audit, state.history, state.future, state.desiderata, state.mode, state.aiMode, state.matriciCustom, state.matriceMese, state.hydrated]);

  const merge = useCallback((payload: Partial<StoreState>) => dispatch({ type: 'MERGE', payload }), []);

  // commit = applica una modifica registrando snapshot (per undo) e voce di audit
  const commit = useCallback(
    (patch: Partial<StoreState>, op: string, entity: string, before: string | null, after: string | null) => {
      const s = stateRef.current;
      const history = [...s.history, snapshot(s)].slice(-HISTORY_MAX);
      const entry: AuditEntry = { id: genAuditId(), ts: new Date().toISOString(), op, entity, before, after };
      const audit = [entry, ...s.audit].slice(0, AUDIT_MAX);
      merge({ ...patch, history, future: [], audit });
    },
    [merge],
  );

  const prevEdgeOf = useCallback((s: StoreState, year: number, month: number) => {
    const pm = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 };
    return edgeFromPiano(s.reparti, s.pianos[monthKey(pm.y, pm.m)], pm.y, pm.m);
  }, []);

  // bordo iniziale del mese successivo (solo giorno 1 BLOCCATO): l'ultimo giorno
  // del mese in costruzione deve cedere se l'utente ha fissato il giorno 1 del mese dopo.
  const nextEdgeOf = useCallback((s: StoreState, year: number, month: number) => {
    const nm = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };
    return nextEdgeFromPiano(s.reparti, s.pianos[monthKey(nm.y, nm.m)], nm.y, nm.m);
  }, []);

  const rebuild = useCallback((s: StoreState, ctx: EngineContext, keepLocked: boolean): { pianos: PianoStore; stats: BuildStats } => {
    const key = monthKey(ctx.year, ctx.month);
    const { piano, stats } = buildPiano(ctx, s.pianos[key] || {}, keepLocked, prevEdgeOf(s, ctx.year, ctx.month), nextEdgeOf(s, ctx.year, ctx.month), optimizeOf(s));
    return { pianos: { ...s.pianos, [key]: piano }, stats };
  }, [prevEdgeOf, nextEdgeOf]);

  const addReparto = useCallback((rep: Reparto) => {
    const s = stateRef.current;
    const reparti = [...s.reparti, rep];
    const ctx: EngineContext = { ...ctxOf(s), reparti };
    const { pianos } = rebuild(s, ctx, false);
    commit({ reparti, pianos }, 'create', 'reparto', null, rep.nome);
  }, [commit, rebuild]);

  const updateReparto = useCallback((rep: Reparto) => {
    const s = stateRef.current;
    const before = s.reparti.find((r) => r.id === rep.id);
    const reparti = s.reparti.map((r) => (r.id === rep.id ? rep : r));
    const ctx: EngineContext = { ...ctxOf(s), reparti };
    const { pianos } = rebuild(s, ctx, false);
    commit({ reparti, pianos }, 'update', 'reparto', before ? before.nome : rep.id, rep.nome);
  }, [commit, rebuild]);

  const removeReparto = useCallback((id: string) => {
    const s = stateRef.current;
    const removed = s.reparti.find((r) => r.id === id);
    const reparti = s.reparti.filter((r) => r.id !== id);
    const staff = s.staff.map((m) => ({ ...m, reparti: (m.reparti || []).filter((x) => x !== id) }));
    const ctx: EngineContext = { ...ctxOf(s), reparti, staff };
    const { pianos } = rebuild(s, ctx, false);
    commit({ reparti, staff, pianos, filterReparto: s.filterReparto === id ? 'all' : s.filterReparto }, 'delete', 'reparto', removed ? removed.nome : id, null);
  }, [commit, rebuild]);

  const addStaff = useCallback((member: Staff) => {
    const s = stateRef.current;
    const staff = [...s.staff, member];
    const ctx: EngineContext = { ...ctxOf(s), staff };
    const { pianos } = rebuild(s, ctx, true);
    commit({ staff, pianos }, 'create', 'personale', null, member.nome);
  }, [commit, rebuild]);

  const updateStaff = useCallback((member: Staff) => {
    const s = stateRef.current;
    const before = s.staff.find((m) => m.id === member.id);
    const staff = s.staff.map((m) => (m.id === member.id ? member : m));
    const ctx: EngineContext = { ...ctxOf(s), staff };
    const { pianos } = rebuild(s, ctx, true);
    commit({ staff, pianos }, 'update', 'personale', before ? before.nome : member.id, member.nome);
  }, [commit, rebuild]);

  const removeStaff = useCallback((id: string) => {
    const s = stateRef.current;
    const removed = s.staff.find((m) => m.id === id);
    const staff = s.staff.filter((m) => m.id !== id);
    const ferie = s.ferie.filter((f) => f.infId !== id);
    const pianosStripped: PianoStore = {};
    Object.keys(s.pianos).forEach((k) => {
      const copy = { ...s.pianos[k] };
      delete copy[id];
      pianosStripped[k] = copy;
    });
    const ctx: EngineContext = { ...ctxOf(s), staff, ferie };
    const key = monthKey(s.year, s.month);
    const { piano } = buildPiano(ctx, pianosStripped[key] || {}, true, prevEdgeOf({ ...s, pianos: pianosStripped }, s.year, s.month), nextEdgeOf({ ...s, pianos: pianosStripped }, s.year, s.month), optimizeOf(s));
    commit({ staff, ferie, pianos: { ...pianosStripped, [key]: piano } }, 'delete', 'personale', removed ? removed.nome : id, null);
  }, [commit, prevEdgeOf, nextEdgeOf]);

  const addFerie = useCallback((f: Ferie) => {
    const s = stateRef.current;
    const ferie = [...s.ferie, f];
    const ctx: EngineContext = { ...ctxOf(s), ferie };
    const { pianos } = rebuild(s, ctx, false);
    commit({ ferie, pianos }, 'create', 'assenza', null, ferieLabel(s, f));
  }, [commit, rebuild]);

  const removeFerie = useCallback((f: Ferie) => {
    const s = stateRef.current;
    const ferie = s.ferie.filter(
      (x) => !(x.infId === f.infId && x.from === f.from && x.to === f.to && x.month === f.month && x.year === f.year),
    );
    const ctx: EngineContext = { ...ctxOf(s), ferie };
    const { pianos } = rebuild(s, ctx, false);
    commit({ ferie, pianos }, 'delete', 'assenza', ferieLabel(s, f), null);
  }, [commit, rebuild]);

  const updateFerie = useCallback((orig: Ferie, next: Ferie) => {
    const s = stateRef.current;
    let found = false;
    const ferie = s.ferie.map((x) => {
      if (!found && sameFerie(x, orig)) { found = true; return next; }
      return x;
    });
    const ctx: EngineContext = { ...ctxOf(s), ferie };
    const { pianos } = rebuild(s, ctx, false);
    commit({ ferie, pianos }, 'update', 'assenza', ferieLabel(s, orig), ferieLabel(s, next));
  }, [commit, rebuild]);

  const setCell = useCallback(
    (infId: string, day: number, turno: Turno, repartoId: string | null, settore: string | null) => {
      const s = stateRef.current;
      const key = monthKey(s.year, s.month);
      const piano: Piano = cloneDeep(s.pianos[key] || {});
      if (!piano[infId]) piano[infId] = {};
      const old = piano[infId][day] || null;
      const oldCopy: Cell | null = old ? { ...old } : null;
      const newCell: Cell = {
        turno,
        repartoId: isWork(turno) ? repartoId : null,
        settore: isWork(turno) && repartoId ? settore : null,
        locked: true,
        autoFilled: false,
        riposoForzato: false,
        deroghe: [],
      };
      piano[infId][day] = newCell;
      let fill: { inf: Staff; settore: string } | null = null;
      if (oldCopy && isWork(oldCopy.turno) && oldCopy.settore && oldCopy.settore !== newCell.settore) {
        const r = smartFill(ctxOf(s), piano, oldCopy, day, prevEdgeOf(s, s.year, s.month), nextEdgeOf(s, s.year, s.month));
        if (r) fill = { inf: r.inf, settore: r.settore };
      }
      const nome = s.staff.find((m) => m.id === infId)?.nome || infId;
      commit({ pianos: { ...s.pianos, [key]: piano } }, 'update', 'turno', `${nome} g${day}: ${oldCopy ? oldCopy.turno : '—'}`, turno);
      return fill;
    },
    [commit, prevEdgeOf, nextEdgeOf],
  );

  const addDesiderata = useCallback((d: Desiderata) => {
    const s = stateRef.current;
    const withId: Desiderata = d.id ? d : { ...d, id: genDesId() };
    const desiderata = [...s.desiderata, withId];
    const ctx: EngineContext = { ...ctxOf(s), desiderata };
    const { pianos } = rebuild(s, ctx, false);
    commit({ desiderata, pianos }, 'create', 'desiderata', null, desLabel(s, withId));
  }, [commit, rebuild]);

  const updateDesiderata = useCallback((id: string, next: Desiderata) => {
    const s = stateRef.current;
    const orig = s.desiderata.find((x) => x.id === id);
    const desiderata = s.desiderata.map((x) => (x.id === id ? { ...next, id } : x));
    const ctx: EngineContext = { ...ctxOf(s), desiderata };
    const { pianos } = rebuild(s, ctx, false);
    commit({ desiderata, pianos }, 'update', 'desiderata', orig ? desLabel(s, orig) : null, desLabel(s, { ...next, id }));
  }, [commit, rebuild]);

  const removeDesiderata = useCallback((id: string) => {
    const s = stateRef.current;
    const orig = s.desiderata.find((x) => x.id === id);
    const desiderata = s.desiderata.filter((x) => x.id !== id);
    const ctx: EngineContext = { ...ctxOf(s), desiderata };
    const { pianos } = rebuild(s, ctx, false);
    commit({ desiderata, pianos }, 'delete', 'desiderata', orig ? desLabel(s, orig) : null, null);
  }, [commit, rebuild]);

  const setMode = useCallback((m: GenerationMode) => {
    const s = stateRef.current;
    if (s.mode === m) return;
    const ctx: EngineContext = { ...ctxOf(s), mode: m };
    const { pianos } = rebuild(s, ctx, false);
    commit({ mode: m, pianos }, 'update', 'modalità', s.mode === 'rigida' ? 'Rigida' : 'Operativa', m === 'rigida' ? 'Rigida' : 'Operativa');
  }, [commit, rebuild]);

  const regenerate = useCallback((): { stats: BuildStats; coverage: Coverage } => {
    const s = stateRef.current;
    const c = ctxOf(s);
    const { pianos, stats } = rebuild(s, c, true);
    const key = monthKey(s.year, s.month);
    const coverage = computeCoverage(c, pianos[key] || {});
    commit({ pianos }, 'regen', 'mese', null, `${MONTHS[s.month]} ${s.year}`);
    return { stats, coverage };
  }, [commit, rebuild]);

  const setMonth = useCallback((dir: number) => {
    const s = stateRef.current;
    let month = s.month + dir;
    let year = s.year;
    if (month < 0) { month = 11; year--; }
    if (month > 11) { month = 0; year++; }
    const ctx: EngineContext = { ...ctxOf(s), month, year };
    const key = monthKey(year, month);
    const { piano } = buildPiano(ctx, s.pianos[key] || {}, true, prevEdgeOf(s, year, month), nextEdgeOf(s, year, month), optimizeOf(s));
    merge({ month, year, pianos: { ...s.pianos, [key]: piano } });
  }, [merge, prevEdgeOf, nextEdgeOf]);

  const setFilter = useCallback((rep: string) => merge({ filterReparto: rep }), [merge]);

  const undo = useCallback(() => {
    const s = stateRef.current;
    if (!s.history.length) return;
    const history = [...s.history];
    const prev = history.pop() as Snapshot;
    const future = [...s.future, snapshot(s)].slice(-HISTORY_MAX);
    const entry: AuditEntry = { id: genAuditId(), ts: new Date().toISOString(), op: 'undo', entity: 'stato', before: null, after: null };
    merge({ ...prev, history, future, audit: [entry, ...s.audit].slice(0, AUDIT_MAX) });
  }, [merge]);

  const redo = useCallback(() => {
    const s = stateRef.current;
    if (!s.future.length) return;
    const future = [...s.future];
    const next = future.pop() as Snapshot;
    const history = [...s.history, snapshot(s)].slice(-HISTORY_MAX);
    const entry: AuditEntry = { id: genAuditId(), ts: new Date().toISOString(), op: 'redo', entity: 'stato', before: null, after: null };
    merge({ ...next, history, future, audit: [entry, ...s.audit].slice(0, AUDIT_MAX) });
  }, [merge]);

  const logEvent = useCallback((op: string, entity: string, before: string | null, after: string | null) => {
    const s = stateRef.current;
    const entry: AuditEntry = { id: genAuditId(), ts: new Date().toISOString(), op, entity, before, after };
    merge({ audit: [entry, ...s.audit].slice(0, AUDIT_MAX) });
  }, [merge]);

  const exportBackup = useCallback((): string => {
    const s = stateRef.current;
    return serializeBackup({ reparti: s.reparti, staff: s.staff, ferie: s.ferie, pianos: s.pianos, month: s.month, year: s.year, audit: s.audit });
  }, []);

  const importBackup = useCallback(
    (text: string, parts?: { reparti?: boolean; staff?: boolean; ferie?: boolean; pianos?: boolean }): { ok: boolean; error?: string } => {
      const res = parseBackup(text);
      if (!res.ok || !res.backup) return { ok: false, error: res.error };
      const s = stateRef.current;
      const d = res.backup.data;
      const sel = parts || { reparti: true, staff: true, ferie: true, pianos: true };
      const reparti = sel.reparti ? d.reparti : s.reparti;
      const staff = sel.staff ? d.staff : s.staff;
      const ferie = sel.ferie ? migrateFerie(d.ferie) : s.ferie;
      const pianos = sel.pianos ? migratePianos(d.pianos) : s.pianos;
      commit({ reparti, staff, ferie, pianos, month: d.month, year: d.year }, 'import', 'backup', null, `${d.staff.length} operatori · ${d.reparti.length} reparti`);
      return { ok: true };
    },
    [commit],
  );

  // After hydration, ensure the visible month has a plan (covers reload on a month
  // that has staff but no stored piano). Runs at most once per month/roster change.
  useEffect(() => {
    if (!state.hydrated) return;
    const s = stateRef.current;
    if (!s.staff.length) return;
    const key = monthKey(s.year, s.month);
    if (s.pianos[key]) return;
    const { piano } = buildPiano(ctxOf(s), {}, false, prevEdgeOf(s, s.year, s.month), nextEdgeOf(s, s.year, s.month), optimizeOf(s));
    merge({ pianos: { ...s.pianos, [key]: piano } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hydrated, state.month, state.year, state.staff.length, state.reparti.length]);

  const currentPiano = useMemo<Piano>(() => {
    return state.pianos[monthKey(state.year, state.month)] || {};
  }, [state.pianos, state.year, state.month]);

  const prevPiano = useMemo<Piano>(() => {
    const pm = state.month === 0 ? { y: state.year - 1, m: 11 } : { y: state.year, m: state.month - 1 };
    return state.pianos[monthKey(pm.y, pm.m)] || {};
  }, [state.pianos, state.year, state.month]);

  const ctx = useMemo<EngineContext>(() => ctxOf(state), [state.reparti, state.staff, state.ferie, state.month, state.year]);

  const coverage = useMemo<Coverage>(() => computeCoverage(ctx, currentPiano), [ctx, currentPiano]);

  const addMatriceCustom = useCallback((m: Matrice) => {
    const s = stateRef.current;
    const matriciCustom = [...s.matriciCustom.filter((x) => x.id !== m.id), { ...m, custom: true }];
    const ctx: EngineContext = { ...ctxOf(s), matrici: [...MATRICI, ...matriciCustom] };
    const { pianos } = rebuild(s, ctx, false);
    commit({ matriciCustom, pianos }, 'create', 'matrice personalizzata', null, m.label);
  }, [commit, rebuild]);

  const removeMatriceCustom = useCallback((id: string) => {
    const s = stateRef.current;
    const orig = s.matriciCustom.find((x) => x.id === id);
    const matriciCustom = s.matriciCustom.filter((x) => x.id !== id);
    const ctx: EngineContext = { ...ctxOf(s), matrici: [...MATRICI, ...matriciCustom] };
    const { pianos } = rebuild(s, ctx, false);
    commit({ matriciCustom, pianos }, 'delete', 'matrice personalizzata', orig ? orig.label : null, null);
  }, [commit, rebuild]);

  const setMatriceMese = useCallback((id: string) => {
    const s = stateRef.current;
    const key = monthKey(s.year, s.month);
    const matriceMese = { ...s.matriceMese };
    if (id) matriceMese[key] = id; else delete matriceMese[key];
    const ctx: EngineContext = { ...ctxOf(s), matriceMese: id || undefined };
    const { pianos } = rebuild(s, ctx, false);
    commit({ matriceMese, pianos }, 'update', 'matrice mensile', null, id || 'eredità operatore/reparto');
  }, [commit, rebuild]);

  const setAiMode = useCallback((m: PlanMode) => {
    const s = stateRef.current;
    if (s.aiMode === m) return;
    const next = { ...s, aiMode: m };
    const { pianos } = rebuild(next, ctxOf(next), false);
    commit({ aiMode: m, pianos }, 'update', 'modalità pianificazione', s.aiMode, m);
  }, [commit, rebuild]);

  const value = useMemo<StoreContextValue>(
    () => ({
      reparti: state.reparti,
      staff: state.staff,
      ferie: state.ferie,
      month: state.month,
      year: state.year,
      filterReparto: state.filterReparto,
      hydrated: state.hydrated,
      currentPiano,
      prevPiano,
      coverage,
      ctx,
      addReparto,
      updateReparto,
      removeReparto,
      addStaff,
      updateStaff,
      removeStaff,
      addFerie,
      removeFerie,
      setCell,
      regenerate,
      setMonth,
      setFilter,
      audit: state.audit,
      canUndo: state.history.length > 0,
      canRedo: state.future.length > 0,
      undo,
      redo,
      updateFerie,
      exportBackup,
      importBackup,
      logEvent,
      desiderata: state.desiderata,
      mode: state.mode,
      addDesiderata,
      updateDesiderata,
      removeDesiderata,
      setMode,
      aiMode: state.aiMode,
      setAiMode,
      matriciCustom: state.matriciCustom,
      matriceMese: state.matriceMese,
      addMatriceCustom,
      removeMatriceCustom,
      setMatriceMese,
    }),
    [state, currentPiano, prevPiano, coverage, ctx, addReparto, updateReparto, removeReparto, addStaff, updateStaff, removeStaff, addFerie, removeFerie, setCell, regenerate, setMonth, setFilter, undo, redo, updateFerie, exportBackup, importBackup, logEvent, addDesiderata, updateDesiderata, removeDesiderata, setMode, setAiMode, addMatriceCustom, removeMatriceCustom, setMatriceMese],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
