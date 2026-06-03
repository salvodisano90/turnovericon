// services/xlsx.ts — esportazione XLSX professionale (replica fedele della griglia)
// Richiede i pacchetti: xlsx-js-style, expo-file-system (eseguire: npx expo install)

import * as XLSX from 'xlsx-js-style';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { EngineContext, Piano } from '../types';
import { buildWorkbookModel, WorkbookModel, XlsxCell } from './xlsxData';

const argb = (h: string) => 'FF' + h.replace('#', '').toUpperCase();
const thin = { style: 'thin', color: { rgb: 'FFD0D0D5' } };
const BORDER = { top: thin, bottom: thin, left: thin, right: thin };

function styleCell(ws: XLSX.WorkSheet, r: number, c: number, style: object) {
  const ref = XLSX.utils.encode_cell({ r, c });
  if (!ws[ref]) ws[ref] = { t: 's', v: '' };
  ws[ref].s = style;
}

function sheetForReparto(model: WorkbookModel, sIndex: number): XLSX.WorkSheet {
  const sheet = model.sheets[sIndex];
  const days = sheet.days;
  const nCols = days.length + 2; // Operatore + giorni + Tot ore
  const aoa: (string | number)[][] = [];
  aoa.push([`${model.title} — ${sheet.name}`]);                       // r0 titolo
  aoa.push(['Operatore', ...days.map((d) => d), 'Tot ore']);          // r1 intestazione
  for (const row of sheet.rows) {                                      // righe operatori
    const line: (string | number)[] = [row.nome];
    for (const cell of row.cells) line.push(cell.settore ? `${cell.code}\n${cell.settore}` : cell.code);
    line.push(row.totaleOre);
    aoa.push(line);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: nCols - 1 } }];
  ws['!cols'] = [{ wch: 22 }, ...days.map(() => ({ wch: 5 })), { wch: 8 }];
  ws['!views'] = [{ state: 'frozen', xSplit: 1, ySplit: 2 }];
  ws['!rows'] = [{ hpt: 22 }, { hpt: 18 }];

  // titolo
  styleCell(ws, 0, 0, { font: { bold: true, sz: 14, color: { rgb: 'FF1C1C1E' } }, alignment: { horizontal: 'left', vertical: 'center' } });
  // intestazione giorni
  for (let c = 0; c < nCols; c++) {
    const isWe = c >= 1 && c <= days.length && model.sheets[sIndex].rows[0]?.cells[c - 1]?.weekend;
    styleCell(ws, 1, c, {
      font: { bold: true, sz: 11, color: { rgb: 'FFFFFFFF' } },
      fill: { fgColor: { rgb: isWe ? 'FF5B5B60' : 'FF2C2C2E' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: BORDER,
    });
  }
  // celle turni
  for (let ri = 0; ri < sheet.rows.length; ri++) {
    const row = sheet.rows[ri];
    const rr = ri + 2;
    styleCell(ws, rr, 0, { font: { bold: true, sz: 11, color: { rgb: 'FF1C1C1E' } }, alignment: { horizontal: 'left', vertical: 'center' }, border: BORDER });
    for (let ci = 0; ci < row.cells.length; ci++) {
      const cell: XlsxCell = row.cells[ci];
      styleCell(ws, rr, ci + 1, {
        font: { bold: true, sz: 10, color: { rgb: argb(cell.font) } },
        fill: { fgColor: { rgb: argb(cell.fill) } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: BORDER,
      });
    }
    styleCell(ws, rr, row.cells.length + 1, { font: { bold: true, sz: 11, color: { rgb: 'FF1C1C1E' } }, fill: { fgColor: { rgb: 'FFF2F2F7' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: BORDER });
  }
  return ws;
}

function summarySheet(model: WorkbookModel): XLSX.WorkSheet {
  const s = model.summary;
  const aoa: (string | number)[][] = [];
  aoa.push([`Riepilogo — ${model.title}`]);
  aoa.push([]);
  aoa.push(['Copertura globale', `${s.coveragePct}%`, '', 'Indice equità', `${s.equityIndex}/100`]);
  aoa.push([]);
  aoa.push(['REPARTI', 'Copertura', 'Operatori']);
  for (const r of s.reparti) aoa.push([r.nome, `${r.coveragePct}%`, r.operatori]);
  aoa.push([]);
  aoa.push(['OPERATORI', 'Ore', 'Notti', 'Weekend', 'Festivi', 'Assenze', 'Δ monte ore']);
  for (const o of s.operatori) aoa.push([o.nome, o.ore, o.notti, o.weekend, o.festivi, o.assenze, o.diff]);
  aoa.push([]);
  aoa.push(['LEGENDA']);
  for (const l of model.legend) aoa.push([l.code, l.label]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
  styleCell(ws, 0, 0, { font: { bold: true, sz: 14 }, alignment: { horizontal: 'left' } });
  // intestazioni di sezione in grassetto
  const headerRows = [4, 7 + s.reparti.length];
  headerRows.forEach((hr) => {
    for (let c = 0; c < 7; c++) styleCell(ws, hr, c, { font: { bold: true, color: { rgb: 'FFFFFFFF' } }, fill: { fgColor: { rgb: 'FF2C2C2E' } }, alignment: { horizontal: c === 0 ? 'left' : 'center' } });
  });
  // legenda: colora la sigla
  const legendStart = aoa.length - model.legend.length;
  model.legend.forEach((l, i) => {
    styleCell(ws, legendStart + i, 0, { font: { bold: true, color: { rgb: argb(l.font) } }, fill: { fgColor: { rgb: argb(l.fill) } }, alignment: { horizontal: 'center' } });
  });
  return ws;
}

const sanitizeName = (n: string) => n.replace(/[\\/?*\[\]:]/g, ' ').slice(0, 28);

function absencesSheet(model: WorkbookModel): XLSX.WorkSheet {
  const aoa: (string | number)[][] = [];
  aoa.push([`Assenze — ${model.title}`]);
  aoa.push([]);
  aoa.push(['Operatore', 'Dal', 'Al', 'Motivazione']);
  if (model.absences.length === 0) {
    aoa.push(['Nessuna assenza nel mese', '', '', '']);
  } else {
    for (const a of model.absences) aoa.push([a.operatore, a.dal, a.al, a.motivo]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 24 }, { wch: 6 }, { wch: 6 }, { wch: 40 }];
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  styleCell(ws, 0, 0, { font: { bold: true, sz: 14 }, alignment: { horizontal: 'left' } });
  for (let c = 0; c < 4; c++) styleCell(ws, 2, c, { font: { bold: true, color: { rgb: 'FFFFFFFF' } }, fill: { fgColor: { rgb: 'FF2C2C2E' } }, alignment: { horizontal: c === 0 || c === 3 ? 'left' : 'center' } });
  return ws;
}

export async function exportPianoXLSX(ctx: EngineContext, piano: Piano): Promise<void> {
  const model = buildWorkbookModel(ctx, piano);
  const wb = XLSX.utils.book_new();
  for (let i = 0; i < model.sheets.length; i++) {
    XLSX.utils.book_append_sheet(wb, sheetForReparto(model, i), sanitizeName(model.sheets[i].name) || `Reparto ${i + 1}`);
  }
  XLSX.utils.book_append_sheet(wb, summarySheet(model), 'Riepilogo');
  XLSX.utils.book_append_sheet(wb, absencesSheet(model), 'Assenze');

  const fname = `Turni_${model.month + 1}_${model.year}.xlsx`;

  if (Platform.OS === 'web') {
    // Su web: download diretto del file tramite Blob
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const g: any = globalThis as any;
    const blob = new g.Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = g.URL.createObjectURL(blob);
    const a = g.document.createElement('a');
    a.href = url; a.download = fname;
    g.document.body.appendChild(a); a.click(); g.document.body.removeChild(a);
    setTimeout(() => g.URL.revokeObjectURL(url), 1000);
    return;
  }

  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const uri = FileSystem.cacheDirectory + fname;
  await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Esporta turni in Excel',
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    });
  }
}
