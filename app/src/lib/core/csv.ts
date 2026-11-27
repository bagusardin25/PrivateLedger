// CSV parsing happens entirely in the browser. No network request.
// Everything except parseCsvFile is a pure function, tested in scripts/csv.test.ts.

import Papa from 'papaparse';
import { currencyInText, detectCurrency, pickCurrency } from './currency.ts';
import type { RawRow } from './prepare';

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

/** For dates like 03/04/2026: is the first number the month or the day? */
export type DateOrder = 'mdy' | 'dmy';

/** "1,234.56" (dot) or "1.234,56" (comma): which character marks the decimals. */
export type DecimalMark = 'dot' | 'comma';

export interface ColumnMapping {
  date: string;
  description: string;
  amountMode: 'single' | 'split';
  amount: string;
  /** Money out, used when amountMode is "split". */
  debit: string;
  /** Money in, used when amountMode is "split". */
  credit: string;
  dateOrder: DateOrder;
  /** Card statements often list purchases as positive numbers. */
  spendingIsPositive: boolean;
  /** ISO 4217 code for every amount in the file, e.g. "IDR". */
  currency: string;
  decimalMark: DecimalMark;
  /** A column naming each row's currency, when the file has one. Rows in another currency are skipped. */
  currencyColumn: string;
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

/** day/month/year or month/day/year with "/" or "-"; the order is not knowable from one value. */
const NUMERIC_DATE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/;

/**
 * Looks at a whole column to decide the order: a first number above 12 can
 * only be a day. `ambiguous` means every date fits both readings, so the UI
 * asks the user to check.
 */
export function detectDateOrder(values: (string | undefined)[]): { order: DateOrder; ambiguous: boolean; numeric: boolean } {
  let numeric = false;
  let firstAbove12 = false;
  let secondAbove12 = false;
  for (const value of values) {
    const m = NUMERIC_DATE.exec((value ?? '').trim());
    if (!m) continue;
    numeric = true;
    if (Number(m[1]) > 12) firstAbove12 = true;
    if (Number(m[2]) > 12) secondAbove12 = true;
  }
  if (firstAbove12 && !secondAbove12) return { order: 'dmy', ambiguous: false, numeric };
  if (secondAbove12 && !firstAbove12) return { order: 'mdy', ambiguous: false, numeric };
  return { order: 'mdy', ambiguous: numeric, numeric };
}

/**
 * Looks at a whole amount column: "1.234,56" or "12,5" means a decimal comma;
 * "59.99" means a decimal dot; amounts with only "1.500.000" style groups
 * (rupiah, yen) also mean the dot is a thousands separator.
 * `evidence` is false when every value fits both readings.
 */
export function detectDecimalMark(values: (string | undefined)[]): { mark: DecimalMark; evidence: boolean } {
  let dot = 0;
  let comma = 0;
  let dotGroups = 0;
  let commaGroups = 0;
  for (const value of values) {
    const digits = (value ?? '').replace(/[^\d.,]/g, '');
    if (!/\d/.test(digits)) continue;
    if (/,\d{1,2}$/.test(digits) || /\.\d{3},/.test(digits)) comma += 1;
    else if (/\.\d{1,2}$/.test(digits) || /,\d{3}\./.test(digits)) dot += 1;
    else if (/^\d{1,3}(\.\d{3})+$/.test(digits)) dotGroups += 1;
    else if (/^\d{1,3}(,\d{3})+$/.test(digits)) commaGroups += 1;
  }
  if (comma !== dot) return { mark: comma > dot ? 'comma' : 'dot', evidence: true };
  if (dotGroups !== commaGroups) return { mark: dotGroups > commaGroups ? 'comma' : 'dot', evidence: true };
  return { mark: 'dot', evidence: false };
}

/** The columns that hold amounts under a mapping. */
export function amountColumns(mapping: Pick<ColumnMapping, 'amountMode' | 'amount' | 'debit' | 'credit'>): string[] {
  return (mapping.amountMode === 'single' ? [mapping.amount] : [mapping.debit, mapping.credit]).filter(Boolean);
}

export function decimalMarkFor(rows: Record<string, string>[], columns: string[]): DecimalMark {
  return detectDecimalMark(rows.flatMap((r) => columns.map((c) => r[c]))).mark;
}

/** `locale` is the browser's language, used only when the file does not name its currency. */
export function guessMapping(headers: string[], rows: Record<string, string>[] = [], locale?: string): ColumnMapping {
  const amount = find(headers, /^(amount|amt|value|transaction amount|jumlah|nominal|betrag|montant|importe)$/i) || find(headers, /amount|jumlah|nominal/i);
  const debit = find(headers, /debit|debet|withdrawal|money out|paid out|keluar/i);
  const credit = find(headers, /credit|kredit|deposit|money in|paid in|masuk/i);
  const date =
    find(headers, /^(date|posted date|transaction date|posting date|tanggal|tgl|tanggal transaksi|datum|buchungstag|buchungsdatum|fecha|data)$/i) ||
    find(headers, /date|tanggal|tgl|datum|buchung|fecha/i);
  const amountMode = !amount && debit && credit ? 'split' : 'single';
  const columns = amountColumns({ amountMode, amount, debit, credit });
  const currencyGuess = detectCurrency(headers, rows, columns);
  return {
    date,
    description: find(headers, /desc|memo|payee|merchant|details|narrative|name|keterangan|uraian|berita|verwendungszweck|buchungstext|beschreibung|libell|concepto|omschrijving/i),
    amountMode,
    amount,
    debit,
    credit,
    dateOrder: detectDateOrder(rows.map((r) => r[date])).order,
    spendingIsPositive: false,
    currency: pickCurrency(currencyGuess, locale),
    decimalMark: decimalMarkFor(rows, columns),
    currencyColumn: currencyGuess.column ?? '',
  };
}

/**
 * Reads "-59.99", "(59.99)", "59.99-", "$1,234.56", "1.234,56", "59.99 DR",
 * "Rp 85.000", "25,000.00 DB". With a decimal mark from the whole column the
 * reading is exact ("1.500" is 1500 in a rupiah file); without one it guesses
 * from the value alone. Returns undefined when there is no number, so the row
 * is skipped instead of imported as zero.
 */
export function parseAmount(value: string | undefined, mark?: DecimalMark): number | undefined {
  if (value === undefined) return undefined;
  let text = value.trim().replace(/[−‒–—]/g, '-');
  if (!/\d/.test(text)) return undefined;

  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  // DR and DB (Indonesian banks) both mark money out; CR and KR are money in.
  if (/\b(DR|DB|DEBIT)\b/i.test(text)) negative = true;
  text = text.replace(/[^\d.,-]/g, '');
  if (text.endsWith('-') || text.startsWith('-')) negative = true;
  text = text.replace(/-/g, '');

  // A value that does not fit the column's format falls through to the per-value guess below.
  const fits = mark === 'comma' ? /^(\d+|\d{1,3}(\.\d{3})+)(,\d+)?$/ : /^(\d+|\d{1,3}(,\d{3})+)(\.\d+)?$/;
  if (mark && fits.test(text)) {
    const number = Number(mark === 'comma' ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, ''));
    if (Number.isFinite(number)) return negative ? -Math.abs(number) : number;
  }

  const dots = (text.match(/\./g) ?? []).length;
  const commas = (text.match(/,/g) ?? []).length;
  if (commas === 1 && /,\d{1,2}$/.test(text)) {
    // "1.234,56" or "12,5": the comma is the decimal mark.
    text = text.replace(/\./g, '').replace(',', '.');
  } else {
    text = text.replace(/,/g, '');
    // "1.500.000": several dots can only be thousands separators.
    if (dots > 1) text = text.replace(/\./g, '');
  }

  const number = Number(text);
  if (!text || !Number.isFinite(number)) return undefined;
  return negative ? -Math.abs(number) : number;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function iso(year: string, month: number, day: number): string | undefined {
  const fullYear = year.length === 2 ? `20${year}` : year;
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthIndex(name: string): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;
}

/**
 * Returns YYYY-MM-DD, or the text as given when the format is not recognized
 * (the row is still imported; it just cannot be grouped by month).
 */
export function normalizeDate(value: string | undefined, order: DateOrder = 'mdy'): string {
  const text = (value ?? '').trim();
  let m: RegExpExecArray | null;

  // 2026-10-05, 2026/10/05, with or without a time after it
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/.exec(text))) return iso(m[1], Number(m[2]), Number(m[3])) ?? text;
  // 20261005
  if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(text))) return iso(m[1], Number(m[2]), Number(m[3])) ?? text;
  // 10/05/2026 or 05/10/2026, decided for the whole column
  if ((m = NUMERIC_DATE.exec(text))) {
    const [first, second] = [Number(m[1]), Number(m[2])];
    return (order === 'dmy' ? iso(m[3], second, first) : iso(m[3], first, second)) ?? text;
  }
  // 05.10.2026 is written day first wherever dots are used
  if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(text))) return iso(m[3], Number(m[2]), Number(m[1])) ?? text;
  // Oct 5, 2026 / October 5 2026
  if ((m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(text)) && monthIndex(m[1])) {
    return iso(m[3], monthIndex(m[1]), Number(m[2])) ?? text;
  }
  // 5 Oct 2026 / 05-Oct-2026 / 05 Oct 26
  if ((m = /^(\d{1,2})[\s-]([A-Za-z]{3,9})\.?[\s,-]+(\d{2}|\d{4})$/.exec(text)) && monthIndex(m[2])) {
    return iso(m[3], monthIndex(m[2]), Number(m[1])) ?? text;
  }
  return text;
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function mappingIsComplete(mapping: ColumnMapping): boolean {
  if (!mapping.date || !mapping.description || !mapping.currency) return false;
  return mapping.amountMode === 'single' ? Boolean(mapping.amount) : Boolean(mapping.debit && mapping.credit);
}

export interface RawRowsResult {
  rows: RawRow[];
  /** Rows without a description or a readable amount. */
  skipped: number;
  /** Rows kept with a date that could not be read as a calendar date. */
  unreadDates: number;
  /** Share of amounts above zero as written in the file, so the UI can hint at a card statement. */
  positiveShare: number;
  /** Rows the currency column puts in another currency than the one chosen. */
  otherCurrency: number;
}

export function toRawRows(parsed: ParsedCsv, mapping: ColumnMapping): RawRowsResult {
  const rows: RawRow[] = [];
  let skipped = 0;
  let unreadDates = 0;
  let positive = 0;
  let otherCurrency = 0;
  for (const record of parsed.rows) {
    if (mapping.currencyColumn) {
      const rowCurrency = currencyInText(record[mapping.currencyColumn])?.code;
      if (rowCurrency && rowCurrency !== mapping.currency) {
        otherCurrency += 1;
        continue;
      }
    }
    const description = (record[mapping.description] ?? '').trim();
    let amount: number | undefined;
    let writtenPositive = false;
    if (mapping.amountMode === 'single') {
      amount = parseAmount(record[mapping.amount], mapping.decimalMark);
      writtenPositive = amount !== undefined && amount > 0;
      if (amount !== undefined && mapping.spendingIsPositive) amount = -amount;
    } else {
      const out = parseAmount(record[mapping.debit], mapping.decimalMark);
      const inn = parseAmount(record[mapping.credit], mapping.decimalMark);
      if (out !== undefined && out !== 0) amount = -Math.abs(out);
      else if (inn !== undefined) amount = Math.abs(inn);
    }
    if (!description || amount === undefined) {
      skipped += 1;
      continue;
    }
    if (writtenPositive) positive += 1;
    const date = normalizeDate(record[mapping.date], mapping.dateOrder);
    if (!isIsoDate(date)) unreadDates += 1;
    rows.push({ date, description, amount });
  }
  return { rows, skipped, unreadDates, positiveShare: rows.length ? positive / rows.length : 0, otherCurrency };
}
