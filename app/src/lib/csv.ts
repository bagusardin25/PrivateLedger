// F2: CSV parsing happens entirely in the browser. No network request.

import Papa from 'papaparse';
import type { RawRow } from './prepare';

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export interface ColumnMapping {
  date: string;
  description: string;
  amountMode: 'single' | 'split';
  amount: string;
  /** Money out, used when amountMode is "split". */
  debit: string;
  /** Money in, used when amountMode is "split". */
  credit: string;
}

export function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        const headers = (result.meta.fields ?? []).filter(Boolean);
        if (headers.length < 2) reject(new Error('This file has no header row with column names.'));
        else resolve({ headers, rows: result.data });
      },
      error: (error) => reject(error),
    });
  });
}

function find(headers: string[], pattern: RegExp): string {
  return headers.find((h) => pattern.test(h)) ?? '';
}

export function guessMapping(headers: string[]): ColumnMapping {
  const amount = find(headers, /^(amount|amt|value|transaction amount)$/i) || find(headers, /amount/i);
  const debit = find(headers, /debit|withdrawal|money out|paid out/i);
  const credit = find(headers, /credit|deposit|money in|paid in/i);
  return {
    date: find(headers, /^(date|posted date|transaction date|posting date)$/i) || find(headers, /date/i),
    description: find(headers, /desc|memo|payee|merchant|details|narrative|name/i),
    amountMode: !amount && debit && credit ? 'split' : 'single',
    amount,
    debit,
    credit,
  };
}

export function parseAmount(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  let text = value.trim();
  if (!text) return undefined;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text.endsWith('-')) {
    negative = true;
    text = text.slice(0, -1);
  }
  text = text.replace(/[^\d.,-]/g, '');
  // "1.234,56" (comma decimal) vs "1,234.56"
  if (/,\d{2}$/.test(text) && !/\.\d{2}$/.test(text)) text = text.replace(/\./g, '').replace(',', '.');
  else text = text.replace(/,/g, '');
  const number = Number(text);
  if (!Number.isFinite(number)) return undefined;
  return negative ? -Math.abs(number) : number;
}

export function normalizeDate(value: string | undefined): string {
  const text = (value ?? '').trim();
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; // US order: month/day
  }
  m = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; // day.month.year
  return text;
}

export function mappingIsComplete(mapping: ColumnMapping): boolean {
  if (!mapping.date || !mapping.description) return false;
  return mapping.amountMode === 'single' ? Boolean(mapping.amount) : Boolean(mapping.debit && mapping.credit);
}

export function toRawRows(parsed: ParsedCsv, mapping: ColumnMapping): { rows: RawRow[]; skipped: number } {
  const rows: RawRow[] = [];
  let skipped = 0;
  for (const record of parsed.rows) {
    const description = (record[mapping.description] ?? '').trim();
    let amount: number | undefined;
    if (mapping.amountMode === 'single') {
      amount = parseAmount(record[mapping.amount]);
    } else {
      const out = parseAmount(record[mapping.debit]);
      const inn = parseAmount(record[mapping.credit]);
      if (out !== undefined && out !== 0) amount = -Math.abs(out);
      else if (inn !== undefined) amount = Math.abs(inn);
    }
    if (!description || amount === undefined) {
      skipped += 1;
      continue;
    }
    rows.push({ date: normalizeDate(record[mapping.date]), description, amount });
  }
  return { rows, skipped };
}
