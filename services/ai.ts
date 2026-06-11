// services/ai.ts — Architettura Assistente IA (Fase 13). NESSUN modello esterno collegato.
// Consulente operativo per coordinatori: risponde SOLO da dati reali via motore (assistantQuery, fairness, ore).
// AIProvider = interfaccia per il futuro collegamento (Supabase/LLM). Logica pura: testabile in Node.
import { EngineContext, Piano } from '../types';
import { assistantQuery, proactiveSuggestions, whyUncovered, proposeAutoFix } from './engine';
import { fairnessReport } from './fairness';
import { matrixFidelity } from './matrixFidelity';
import { monthlyHours } from './hours';

export interface AIMessage { id: string; role: 'user' | 'assistant'; text: string; ts: number; }
export interface AIConversation { id: string; title: string; messages: AIMessage[]; createdAt: number; }
export interface AIProvider { complete(prompt: string, context: string): Promise<string>; } // futuro: Supabase Edge/LLM

export function createConversation(title = 'Nuova analisi'): AIConversation {
  const now = Date.now();
  return { id: `conv_${now}`, title, messages: [], createdAt: now };
}
export function addMessage(c: AIConversation, role: AIMessage['role'], text: string): AIConversation {
  return { ...c, messages: [...c.messages, { id: `m_${Date.now()}_${c.messages.length}`, role, text, ts: Date.now() }] };
}

// FASE 6 — il consulente propone azioni tracciabili: suggerimento → azione → decisione del coordinatore.
export interface AIAction { id: string; tipo: 'sostituzione' | 'avviso' | 'navigazione'; label: string; payload?: unknown; }
export interface AISuggestion { id: string; testo: string; fonte: string; azioni: AIAction[]; }
export interface AIDecision { id: string; suggestionId: string; esito: 'accettata' | 'rifiutata'; ts: number; }
export function decideSuggestion(s: AISuggestion, esito: AIDecision['esito'], now: number = Date.now()): AIDecision {
  return { id: `dec_${now}`, suggestionId: s.id, esito, ts: now };
}

export interface AIAnswer { text: string; fonti: string[]; suggerimenti?: AISuggestion[]; }

// Router deterministico sui moduli esistenti: copertura/assenze/ferie → assistantQuery; equità → fairness; ore → banca ore; criticità → suggerimenti proattivi.
export class AIService {
  constructor(private provider?: AIProvider) {}
  // FASE 9: "Perché il 14 manca personale?" → analisi del giorno: cause, assenti, sostituzioni, impatto. Solo dati reali.
  analyzeDay(ctx: EngineContext, piano: Piano, day: number): AIAnswer {
    const why = whyUncovered(ctx, piano, day);
    const assenti = (ctx.staff || []).filter((st) => { const c = piano[st.id] && (piano[st.id] as any)[day]; return !!c && c.turno === 'F'; }).map((st) => st.nome);
    const fix = proposeAutoFix(ctx, piano) || [];
    const righe: string[] = [];
    (why.cause || []).forEach((c: any) => righe.push(`• Causa: ${c.nome ? c.nome + ' — ' : ''}${c.motivo || c}`));
    (why.causeStrutturali || []).forEach((c: any) => righe.push(`• Causa strutturale: ${typeof c === 'string' ? c : (c.motivo || c.nome)}`));
    if ((why.postazioniScoperte || []).length) righe.push(`• Postazioni scoperte: ${(why.postazioniScoperte || []).length}`);
    righe.push(`• Operatori assenti il giorno ${day}: ${assenti.length ? assenti.join(', ') : 'nessuno'}`);
    const inTurno = (ctx.staff || []).filter((st) => { const c = piano[st.id] && (piano[st.id] as any)[day]; return !!c && (c.turno === 'M' || c.turno === 'P' || c.turno === 'N'); }).length;
    righe.push(`• Copertura del giorno: ${inTurno}/${ctx.staff.length} operatori in turno`);
    righe.push(`• Sostituzioni proposte dal motore: ${fix.length}`);
    let eq: number | null = null, mfs: { score: number; banda: string } | null = null;
    try { eq = fairnessReport(ctx.staff, piano, ctx.year, ctx.month).fairnessScore; } catch { eq = null; }
    try { const m = matrixFidelity(ctx, piano); mfs = { score: m.score, banda: m.banda }; } catch { mfs = null; }
    if (eq !== null) righe.push(`• Impatto equità: fairness attuale ${eq}/100`);
    if (mfs) righe.push(`• Impatto matrice: fedeltà ${mfs.score}/100 (${mfs.banda})`);
    let alerts = 0; try { alerts = monthlyHours(ctx, piano).alerts.length; } catch { alerts = 0; }
    righe.push(`• Impatto banca ore: ${alerts} avvisi nel mese`);
    const suggerimenti: AISuggestion[] = (fix || []).slice(0, 5).map((f: any, i: number) => ({
      id: `sug_${day}_${i}`,
      testo: typeof f === 'string' ? f : (f.descrizione || f.label || f.azione || 'Sostituzione proposta'),
      fonte: 'autofix',
      azioni: [{ id: `act_${day}_${i}`, tipo: 'sostituzione' as const, label: 'Applica sostituzione', payload: f }],
    }));
    return { text: righe.join('\n'), fonti: ['motore', 'criticità', 'equità', 'matrice', 'ore'], suggerimenti };
  }

  answer(ctx: EngineContext, piano: Piano, q: string): AIAnswer {
    if (!ctx || !Array.isArray(ctx.staff) || !ctx.staff.length) return { text: 'Non sono ancora presenti dati: crea reparti e personale per le analisi.', fonti: [] };
    const dayMatch = (q || '').match(/\b([1-9]|[12]\d|3[01])\b/);
    if (dayMatch && /(manca|scopert|perch)/i.test(q || '')) {
      return this.analyzeDay(ctx, piano, parseInt(dayMatch[1], 10));
    }
    const fonti: string[] = ['motore'];
    const base = assistantQuery(ctx, piano, q);
    let text = (base && (base as any).text) || (typeof base === 'string' ? base : '');
    const ql = (q || '').toLowerCase();
    if (ql.includes('equit') || ql.includes('fair')) {
      const f = fairnessReport(ctx.staff, piano, ctx.year, ctx.month);
      text += `\n\nEquità carichi: ${f.fairnessScore}/100 (${f.categoria}).`;
      fonti.push('fairness');
    }
    if (ql.includes('ore') || ql.includes('banca')) {
      const mh = monthlyHours(ctx, piano);
      text += `\n\nBanca ore: ${mh.alerts.length} avvisi questo mese.`;
      fonti.push('ore');
    }
    if (ql.includes('critic') || ql.includes('rischi')) {
      const sug = proactiveSuggestions(ctx, piano).slice(0, 3);
      if (sug.length) { text += `\n\nSuggerimenti: ${sug.join(' · ')}`; fonti.push('criticità'); }
    }
    return { text: text.trim() || 'Nessun dato disponibile per questa domanda.', fonti };
  }
}
