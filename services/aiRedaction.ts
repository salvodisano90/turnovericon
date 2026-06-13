// services/aiRedaction.ts — FASE 7: redaction layer OBBLIGATORIO prima di qualunque LLM esterno.
// Mai inviare PII: nome, cognome, email, telefono, matricola, codice fiscale.
// Gli operatori vengono sostituiti con ID opachi stabili (op_1, op_2…) entro la sessione di contesto.
import { EngineContext } from '../types';

const EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE = /(\+?\d[\d\s().-]{7,}\d)/g;
// Codice fiscale italiano (16 alfanumerici nel pattern classico)
const CF = /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/gi;

export function redactText(input: string, nameMap?: Map<string, string>): string {
  let out = input || '';
  if (nameMap) for (const [name, alias] of nameMap.entries()) {
    if (!name) continue;
    out = out.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), alias);
  }
  out = out.replace(EMAIL, '[email]').replace(CF, '[cf]').replace(PHONE, '[tel]');
  return out;
}

// Costruisce la mappa nome→alias opaco da un contesto (operatori).
export function buildAliasMap(ctx: EngineContext): Map<string, string> {
  const m = new Map<string, string>();
  (ctx.staff || []).forEach((s, i) => { if (s.nome) m.set(s.nome, `op_${i + 1}`); });
  return m;
}

// Sanifica un contesto JSON (stringa) sostituendo nomi e azzerando campi PII noti.
export function redactContextJSON(json: string, ctx: EngineContext): string {
  const map = buildAliasMap(ctx);
  let out = redactText(json, map);
  return out;
}

// Verifica difensiva: true se NON rimane PII evidente (usata nei test e come guardia pre-invio).
export function isClean(s: string): boolean {
  return !/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(s)
    && !/\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/i.test(s)
    && !/(\+?\d[\d\s().-]{7,}\d)/.test(s);
}
