// Spreadsheet/CSV ingestion — spec sections "EXCEL / CSV IMPORT" and
// "MULTI-SHEET EXCEL". Best-effort, not exhaustive: handles blank sheets,
// title rows above the real header, and blank/total rows within a sheet.
// Does NOT handle merged cells specially (SheetJS reads the top-left
// value only) or duplicate header rows mid-sheet — flagged as a known
// limitation, not silently pretended to work.

import * as XLSX from 'xlsx';
import { normalizeHeader } from './columnMapping';

export interface ParsedSheet {
  sheetName: string;
  headers: string[];
  rows: Record<string, string>[];
}

const KNOWN_HEADER_WORDS = [
  'address', 'property', 'unit', 'tenant', 'resident', 'name', 'email', 'phone',
  'rent', 'amount', 'lease', 'start', 'end', 'deposit', 'status', 'occupancy',
  'city', 'province', 'zip', 'postal',
];

function looksLikeHeaderRow(row: unknown[]): boolean {
  const nonEmpty = row.filter((c) => String(c ?? '').trim().length > 0);
  if (nonEmpty.length < 2) return false;
  const hits = nonEmpty.filter((c) => {
    const norm = normalizeHeader(String(c));
    return KNOWN_HEADER_WORDS.some((w) => norm.includes(w));
  });
  return hits.length >= 2;
}

function isBlankOrTotalRow(row: Record<string, string>): boolean {
  const values = Object.values(row).map((v) => String(v ?? '').trim());
  if (values.every((v) => v.length === 0)) return true;
  const firstNonEmpty = values.find((v) => v.length > 0) ?? '';
  return /^total/i.test(firstNonEmpty);
}

/** Parses a base64-encoded spreadsheet/CSV file into one ParsedSheet per
 * non-empty sheet, scanning past title rows to find the real header. */
export function parseSpreadsheetBase64(base64: string): ParsedSheet[] {
  const workbook = XLSX.read(base64, { type: 'base64' });
  const sheets: ParsedSheet[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
    if (raw.length === 0) continue; // blank sheet — skip, don't error

    let headerRowIndex = raw.findIndex((row) => looksLikeHeaderRow(row));
    if (headerRowIndex === -1) headerRowIndex = 0; // fall back to row 1 rather than dropping the sheet

    const headerRow = raw[headerRowIndex].map((h) => String(h ?? '').trim());
    const dataRows = raw.slice(headerRowIndex + 1);

    const rows: Record<string, string>[] = dataRows
      .map((row) => {
        const obj: Record<string, string> = {};
        headerRow.forEach((h, i) => {
          if (!h) return;
          obj[h] = String(row[i] ?? '').trim();
        });
        return obj;
      })
      .filter((row) => !isBlankOrTotalRow(row));

    if (rows.length === 0) continue; // sheet had a header but no usable data — skip, don't error

    sheets.push({ sheetName, headers: headerRow.filter(Boolean), rows });
  }

  return sheets;
}
