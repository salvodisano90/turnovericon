// services/ai.ts — Architettura Assistente IA (Fase 13). NESSUN modello esterno collegato.
// Consulente operativo per coordinatori: risponde SOLO da dati reali via motore (assistantQuery, fairness, ore).
// AIProvider = interfaccia per il futuro collegamento (Supabase/LLM). Logica pura: testabile in Node.
import { EngineContext, Piano } from '../types';
import { assistantQuery, proactiveSuggestions } from './engine';
import { fairnessReport } from './fairness';
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

export interface AIAnswer { text: string; fonti: string[]; }

// Router deterministico sui moduli esistenti: copertura/assenze/ferie → assistantQuery; equità → fairness; ore → banca ore; criticità → suggerimenti proattivi.
export class AIService {
  constructor(private provider?: AIProvider) {}
  answer(ctx: EngineContext, piano: Piano, q: string): AIAnswer {
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
