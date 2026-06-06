// services/pdf.ts — esporta la VERA tabella turni in PDF (A4 orizzontale, UNA PAGINA PER REPARTO)

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { EngineContext, Piano, Reparto, RepCoverage, Staff } from '../types';
import { DOW, MONTHS, STD_ORARI, TURNI, ASSENZA, ASS_COLOR, ASS_SOFT } from '../utils/constants';
import { daysInMonth, getRep, isWeekend, isWork, jsDow, shiftHours } from '../utils/helpers';
import { computeCoverage, getCell, getEmptyCell } from './engine';

function escapeHtml(s: string): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const CSS = `
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111; margin: 0; }
  .page { page-break-before: always; }
  .title { font-size: 16px; font-weight: 800; margin: 0 0 1px; }
  .title .sigla { font-size: 11px; font-weight: 700; color: #2563eb; }
  .sub { font-size: 9px; color: #555; margin: 0 0 7px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 0.5px solid #c4c4c4; text-align: center; font-size: 7px; padding: 1px; overflow: hidden; }
  thead th { background: #f0f0f3; font-weight: 700; }
  col.cn { width: 64px; } col.ct { width: 26px; }
  .name { text-align: left; white-space: nowrap; font-weight: 700; font-size: 8px; padding-left: 4px; }
  .tot { font-weight: 800; font-size: 8px; background: #fafafa; }
  .dow { font-size: 6px; color: #888; font-weight: 600; display: block; line-height: 1; }
  .we { background: #fdecec; }
  thead th.we { background: #f7dede; }
  .sig { font-size: 5.5px; color: #555; display: block; line-height: 1; }
  td.M { background: #EFF6FF; color: #1d4ed8; } td.P { background: #FFF7EA; color: #b45309; }
  td.N { background: #F3F0FF; color: #6d28d9; } td.R { background: #F4F5F7; color: #6b7280; }
  td.S { background: #E0F2FE; color: #0369a1; }
  td.F { background: #E7F8F0; color: #047857; }
  .empty { font-size: 9px; color: #999; padding: 10px 2px; }
  .legend { margin-top: 7px; display: flex; flex-wrap: wrap; gap: 10px; font-size: 8px; align-items: center; }
  .lg { display: inline-flex; align-items: center; gap: 4px; }
  .box { width: 11px; height: 11px; border-radius: 2px; border: 0.5px solid #bbb; display: inline-block; }
  .foot { margin-top: 6px; font-size: 7px; color: #999; }
`;

function headerRow(ctx: EngineContext, days: number[]): string {
  let h = '<th class="name">Operatore</th>';
  for (const d of days) {
    const we = isWeekend(ctx.year, ctx.month, d) ? ' we' : '';
    h += `<th class="day${we}">${d}<span class="dow">${DOW[jsDow(ctx.year, ctx.month, d)]}</span></th>`;
  }
  h += '<th class="tot">Tot h</th>';
  return h;
}

function operatorRows(ctx: EngineContext, piano: Piano, days: number[], subset: Staff[]): string {
  let rows = '';
  for (const inf of subset) {
    let cells = '';
    let oreTot = 0;
    for (const d of days) {
      const c = getCell(piano, inf.id, d) || getEmptyCell();
      const we = isWeekend(ctx.year, ctx.month, d) ? ' we' : '';
      let code: string = c.turno;
      let inline = '';
      if (c.turno === 'F') {
        code = ASSENZA.code; inline = ` style="background:${ASS_SOFT};color:${ASS_COLOR}"`;
      }
      const sig = isWork(c.turno) && c.settore ? `<span class="sig">${escapeHtml(c.settore)}</span>` : '';
      cells += `<td class="${c.turno}${we}"${inline}>${code}${sig}</td>`;
      if (isWork(c.turno)) {
        const orari = c.repartoId ? (getRep(ctx.reparti, c.repartoId)?.orari || STD_ORARI) : STD_ORARI;
        oreTot += shiftHours(c.turno, orari);
      }
    }
    rows += `<tr><td class="name">${escapeHtml(inf.nome)}</td>${cells}<td class="tot">${Math.round(oreTot)}</td></tr>`;
  }
  return rows;
}

function legendHtml(): string {
  const legend = (['M', 'P', 'N', 'R', 'S'] as const)
    .map((t) => {
      const bg = t === 'M' ? '#EFF6FF' : t === 'P' ? '#FFF7EA' : t === 'N' ? '#F3F0FF' : '#F4F5F7';
      return `<span class="lg"><span class="box" style="background:${bg}"></span>${t} = ${TURNI[t].label}</span>`;
    })
    .join('');
  const assLegend = `<span class="lg"><span class="box" style="background:${ASS_SOFT}"></span>${ASSENZA.code} = ${ASSENZA.label} (causale nel dettaglio)</span>`;
  return `<div class="legend">${legend}${assLegend}<span class="lg" style="color:#777">Sigla in cella = settore (es. MPS1 = Mattina · PS · posto 1)</span></div>`;
}

function colgroup(days: number[]): string {
  return `<colgroup><col class="cn"/>${days.map(() => '<col/>').join('')}<col class="ct"/></colgroup>`;
}

function repPct(rc: RepCoverage | undefined): number {
  if (!rc || !rc.slots.length) return 0;
  let covered = 0;
  let total = 0;
  for (const s of rc.slots) { covered += s.covered; total += s.total; }
  return total ? Math.round((covered / total) * 100) : 0;
}

function absencesHtml(ctx: EngineContext, subset: Staff[]): string {
  const ids: Record<string, boolean> = {};
  subset.forEach((s) => { ids[s.id] = true; });
  const nameById: Record<string, string> = {};
  ctx.staff.forEach((s) => { nameById[s.id] = s.nome; });
  const list = (ctx.ferie || [])
    .filter((f) => f.month === ctx.month && f.year === ctx.year && ids[f.infId])
    .sort((a, b) => a.from - b.from);
  if (!list.length) return '';
  const items = list
    .map((f) => `<div style="font-size:9px;margin:1px 0;color:#333"><b style="color:${ASS_COLOR}">ASS</b> ${escapeHtml(nameById[f.infId] || f.infId)} · gg ${f.from}\u2013${f.to}: ${escapeHtml((f.motivo && f.motivo.trim()) ? f.motivo.trim() : 'Assenza')}</div>`)
    .join('');
  return `<div style="margin-top:8px;padding:6px 8px;border:1px solid #E5E5EA;border-radius:6px"><div style="font-size:10px;font-weight:700;margin-bottom:3px">Assenze (motivazioni)</div>${items}</div>`;
}

function sectionHtml(ctx: EngineContext, piano: Piano, days: number[], title: string, sub: string, subset: Staff[], first: boolean): string {
  const head = `<div class="title">${title}</div><div class="sub">${sub}</div>`;
  const body = subset.length
    ? `<table>${colgroup(days)}<thead><tr>${headerRow(ctx, days)}</tr></thead><tbody>${operatorRows(ctx, piano, days, subset)}</tbody></table>${legendHtml()}${absencesHtml(ctx, subset)}`
    : `<div class="empty">Nessun operatore assegnato a questo reparto.</div>`;
  return `<div class="${first ? '' : 'page'}">${head}${body}</div>`;
}

export async function exportPianoPDF(ctx: EngineContext, piano: Piano): Promise<void> {
  const dim = daysInMonth(ctx.year, ctx.month);
  const days: number[] = Array.from({ length: dim }, (_, i) => i + 1);
  const cov = computeCoverage(ctx, piano);
  const period = `${MONTHS[ctx.month]} ${ctx.year}`;

  let pages = '';
  let first = true;

  ctx.reparti.forEach((r: Reparto) => {
    const subset = ctx.staff.filter((s) => Array.isArray(s.reparti) && s.reparti.includes(r.id));
    const pct = repPct(cov.byRep[r.id]);
    const sub = `${period} &nbsp;|&nbsp; ${subset.length} operatori &nbsp;|&nbsp; settori M${r.settori.M || 0}/P${r.settori.P || 0}/N${r.settori.N || 0} &nbsp;|&nbsp; copertura ${pct}%`;
    const title = `${escapeHtml(r.nome)} <span class="sigla">(${escapeHtml(r.sigla)})</span>`;
    pages += sectionHtml(ctx, piano, days, title, sub, subset, first);
    first = false;
  });

  const orphans = ctx.staff.filter((s) => !Array.isArray(s.reparti) || s.reparti.length === 0);
  if (orphans.length) {
    pages += sectionHtml(ctx, piano, days, 'Senza reparto', `${period} &nbsp;|&nbsp; ${orphans.length} operatori non assegnati`, orphans, first);
    first = false;
  }

  if (!pages) {
    // nessun reparto: fallback a tabella unica con tutto lo staff
    pages = sectionHtml(ctx, piano, days, `Piano Turni — ${period}`, `${ctx.staff.length} operatori &nbsp;|&nbsp; copertura ${cov.globalPct}%`, ctx.staff, true);
  }

  const html =
    `<html><head><meta charset="utf-8"><style>${CSS}</style></head><body>` +
    pages +
    `<div class="foot">Generato da TURNOVER · Riposo minimo 11h (CCNL art. 26) rispettato · una pagina per reparto · le sigle indicano turno e settore</div>` +
    `</body></html>`;

  if (Platform.OS === 'web') {
    // Su web: apre la finestra di stampa del browser (l'utente può salvare come PDF)
    const g: any = globalThis as any;
    const w = g.open ? g.open('', '_blank') : null;
    if (w && w.document) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => { try { w.print(); } catch { /* no-op */ } }, 350);
    }
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Esporta Piano Turni', UTI: 'com.adobe.pdf' });
  }
}
