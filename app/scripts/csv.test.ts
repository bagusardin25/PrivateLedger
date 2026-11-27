// Tests the pure CSV helpers (src/lib/core/csv.ts): dates, amounts, column guesses.
//
// Run: npm run test:csv

import { detectDateOrder, detectDecimalMark, guessMapping, normalizeDate, parseAmount, toRawRows } from '../src/lib/core/csv.ts';
import { currencyInText, detectCurrency, pickCurrency } from '../src/lib/core/currency.ts';
import { normalizeMerchant } from '../src/lib/core/merchant.ts';
import { readFileSync } from 'node:fs';
import Papa from 'papaparse';

let failures = 0;
function eq(actual: unknown, expected: unknown, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
    console.log(`FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
}

// Dates
const DATES: [string, string, 'mdy' | 'dmy'][] = [
  ['2026-10-05', '2026-10-05', 'mdy'],
  ['2026-10-05T08:30:00Z', '2026-10-05', 'mdy'],
  ['2026/10/05', '2026-10-05', 'mdy'],
  ['20261005', '2026-10-05', 'mdy'],
  ['10/05/2026', '2026-10-05', 'mdy'],
  ['10/05/2026', '2026-05-10', 'dmy'],
  ['25/10/2026', '2026-10-25', 'dmy'],
  ['5/10/26', '2026-05-10', 'mdy'],
  ['10-05-2026', '2026-10-05', 'mdy'],
  ['05.10.2026', '2026-10-05', 'mdy'],
  ['Oct 5, 2026', '2026-10-05', 'mdy'],
  ['October 5 2026', '2026-10-05', 'mdy'],
  ['5 Oct 2026', '2026-10-05', 'mdy'],
  ['05-Oct-2026', '2026-10-05', 'mdy'],
  ['05 Oct 26', '2026-10-05', 'mdy'],
  // Not a calendar date in this order: kept as written instead of inventing month 25.
  ['25/10/2026', '25/10/2026', 'mdy'],
  ['pending', 'pending', 'mdy'],
  ['', '', 'mdy'],
];
for (const [input, expected, order] of DATES) eq(normalizeDate(input, order), expected, `normalizeDate(${JSON.stringify(input)}, ${order})`);

eq(detectDateOrder(['03/04/2026', '25/04/2026']), { order: 'dmy', ambiguous: false, numeric: true }, 'detectDateOrder day first');
eq(detectDateOrder(['03/04/2026', '04/25/2026']), { order: 'mdy', ambiguous: false, numeric: true }, 'detectDateOrder month first');
eq(detectDateOrder(['03/04/2026', '05/06/2026']), { order: 'mdy', ambiguous: true, numeric: true }, 'detectDateOrder ambiguous');
eq(detectDateOrder(['2026-10-05']), { order: 'mdy', ambiguous: false, numeric: false }, 'detectDateOrder ISO');

// Amounts
const AMOUNTS: [string, number | undefined][] = [
  ['-59.99', -59.99],
  ['(59.99)', -59.99],
  ['59.99-', -59.99],
  ['−59.99', -59.99],
  ['$1,234.56', 1234.56],
  ['-$1,234.56', -1234.56],
  ['1.234,56', 1234.56],
  ['1,234', 1234],
  ['12,5', 12.5],
  ['1.500.000', 1500000],
  ['+2400', 2400],
  ['59.99 DR', -59.99],
  ['59.99 CR', 59.99],
  ['0.00', 0],
  ['abc', undefined],
  ['', undefined],
  ['-', undefined],
];
for (const [input, expected] of AMOUNTS) eq(parseAmount(input), expected, `parseAmount(${JSON.stringify(input)})`);

// Column guesses
eq(guessMapping(['Posting Date', 'Description', 'Amount', 'Balance']).amount, 'Amount', 'guess single amount');
eq(guessMapping(['Date', 'Payee', 'Debit', 'Credit']).amountMode, 'split', 'guess split columns');
eq(guessMapping(['Date', 'Description', 'Amount'], [{ Date: '25/10/2026' }]).dateOrder, 'dmy', 'guess date order from rows');

// Rows
const parsed = {
  headers: ['Date', 'Description', 'Amount'],
  rows: [
    { Date: '25/10/2026', Description: 'COFFEE', Amount: '4.50' },
    { Date: '26/10/2026', Description: 'REFUND', Amount: '-10.00' },
    { Date: 'pending', Description: 'HOLD', Amount: '1.00' },
    { Date: '27/10/2026', Description: 'NO AMOUNT', Amount: 'n/a' },
    { Date: '27/10/2026', Description: '', Amount: '3.00' },
  ],
};
const mapping = { ...guessMapping(parsed.headers, parsed.rows), spendingIsPositive: true };
const result = toRawRows(parsed, mapping);
eq(result.rows, [
  { date: '2026-10-25', description: 'COFFEE', amount: -4.5 },
  { date: '2026-10-26', description: 'REFUND', amount: 10 },
  { date: 'pending', description: 'HOLD', amount: -1 },
], 'toRawRows with positive spending');
eq([result.skipped, result.unreadDates], [2, 1], 'toRawRows skipped and unread dates');

// Amounts read with the column's decimal mark: "1.500" is fifteen hundred in a rupiah file.
const MARKED: [string, 'dot' | 'comma', number | undefined][] = [
  ['Rp 85.000', 'comma', 85000],
  ['-Rp1.500.000,00', 'comma', -1500000],
  ['1.500', 'comma', 1500],
  ['1.234,56 €', 'comma', 1234.56],
  ['25,000.00 DB', 'dot', -25000],
  ['25,000.00 CR', 'dot', 25000],
  ['1,500', 'dot', 1500],
  ['IDR 54.990', 'comma', 54990],
  // Does not fit the column's format: falls back to reading the value alone.
  ['59.99', 'comma', 59.99],
];
for (const [input, mark, expected] of MARKED) eq(parseAmount(input, mark), expected, `parseAmount(${JSON.stringify(input)}, ${mark})`);

eq(detectDecimalMark(['Rp 85.000', 'Rp 1.500.000', '-Rp 32.500']), { mark: 'comma', evidence: true }, 'decimal mark: rupiah groups');
eq(detectDecimalMark(['1.234,56', '-12,50']), { mark: 'comma', evidence: true }, 'decimal mark: euro style');
eq(detectDecimalMark(['-59.99', '2,400.00']), { mark: 'dot', evidence: true }, 'decimal mark: US style');
eq(detectDecimalMark(['150000', '-20000']), { mark: 'dot', evidence: false }, 'decimal mark: no evidence');

// Currency detection
const currencyOf = (headers: string[], rows: Record<string, string>[], amount: string[]) => {
  const g = detectCurrency(headers, rows, amount);
  return [g.code, g.confidence, g.source];
};
eq(currencyOf(['Date', 'Amount', 'Currency'], [{ Currency: 'IDR' }, { Currency: 'IDR' }], ['Amount']), ['IDR', 'high', 'column'], 'currency column');
eq(detectCurrency(['Date', 'Amount', 'Currency'], [{ Currency: 'EUR' }, { Currency: 'USD' }, { Currency: 'EUR' }], ['Amount']).codes, ['EUR', 'USD'], 'mixed currency column');
eq(currencyOf(['Date', 'Amount'], [{ Amount: 'Rp 85.000' }], ['Amount']), ['IDR', 'high', 'amounts'], 'rupiah symbol in amounts');
eq(currencyOf(['Date', 'Amount'], [{ Amount: '1.234,56 €' }], ['Amount']), ['EUR', 'high', 'amounts'], 'euro sign after amount');
eq(currencyOf(['Date', 'Amount'], [{ Amount: 'CA$20.00' }], ['Amount']), ['CAD', 'high', 'amounts'], 'CA$ is not A$');
eq(currencyOf(['Date', 'Amount'], [{ Amount: '$20.00' }], ['Amount']), ['USD', 'low', 'amounts'], 'bare dollar is a low guess');
eq(currencyOf(['Tanggal', 'Jumlah (IDR)'], [{ 'Jumlah (IDR)': '85.000' }], ['Jumlah (IDR)']), ['IDR', 'high', 'header'], 'code in column name');
eq(currencyOf(['Date', 'Amount'], [{ Amount: '-20.00' }], ['Amount']), [undefined, 'none', 'none'], 'no currency in file');
eq(currencyInText('Try again'), undefined, 'the word "Try" is not Turkish lira');
eq(pickCurrency({ code: 'USD', confidence: 'low', source: 'amounts', codes: [] }, 'en-AU'), 'AUD', 'bare dollar in Australia');
eq(pickCurrency({ confidence: 'none', source: 'none', codes: [] }, 'id-ID'), 'IDR', 'no evidence: browser region');
eq(pickCurrency({ confidence: 'none', source: 'none', codes: [] }, 'de-DE'), 'EUR', 'no evidence: euro area');
eq(pickCurrency({ confidence: 'none', source: 'none', codes: [] }, undefined), 'USD', 'no evidence, no locale');

// A rupiah statement exported from an Indonesian bank, end to end.
const idr = {
  headers: ['Tanggal Transaksi', 'Keterangan', 'Jumlah', 'Saldo'],
  rows: [
    { 'Tanggal Transaksi': '03/10/2026', Keterangan: 'TRSF E-BANKING CR KLIEN', Jumlah: '7,500,000.00 CR', Saldo: '9,000,000.00' },
    { 'Tanggal Transaksi': '05/10/2026', Keterangan: 'KARTU DEBIT GRAB*FOOD', Jumlah: '85,000.00 DB', Saldo: '8,915,000.00' },
    { 'Tanggal Transaksi': '25/10/2026', Keterangan: 'CANVA PRO', Jumlah: '165,000.00 DB', Saldo: '8,750,000.00' },
  ],
};
const idrMapping = guessMapping(idr.headers, idr.rows, 'id-ID');
eq([idrMapping.date, idrMapping.description, idrMapping.amount, idrMapping.currency, idrMapping.decimalMark, idrMapping.dateOrder], ['Tanggal Transaksi', 'Keterangan', 'Jumlah', 'IDR', 'dot', 'dmy'], 'guess an Indonesian statement');
eq(toRawRows(idr, idrMapping).rows.map((r) => r.amount), [7500000, -85000, -165000], 'Indonesian statement amounts');

// Rows the currency column puts in another currency are skipped, not converted.
const mixed = {
  headers: ['Date', 'Description', 'Amount', 'Currency'],
  rows: [
    { Date: '2026-10-01', Description: 'HETZNER', Amount: '-12,50', Currency: 'EUR' },
    { Date: '2026-10-02', Description: 'CLIENT', Amount: '1.200,00', Currency: 'EUR' },
    { Date: '2026-10-03', Description: 'AWS', Amount: '-20.00', Currency: 'USD' },
  ],
};
const mixedResult = toRawRows(mixed, guessMapping(mixed.headers, mixed.rows));
eq([mixedResult.rows.map((r) => r.amount), mixedResult.otherCurrency], [[-12.5, 1200], 1], 'mixed file keeps the chosen currency');

// Merchant names from local bank formats: each purchase keeps its own merchant key.
const MERCHANTS: [string, string][] = [
  ['KARTU DEBIT GRAB*FOOD JAKARTA', 'GRAB FOOD'],
  ['KARTU DEBIT INDOMARET CILANDAK', 'INDOMARET CILANDAK'],
  ['TRSF E-BANKING DB 0710/FTSCY/WS95031 KOST BULANAN', 'KOST BULANAN'],
  ['TRSF E-BANKING CR 0110/FTSCY/WS95031 STUDIO ARUNA', 'STUDIO ARUNA'],
  ['BI-FAST DB BIF TRANSFER KE 014 BUDI SANTOSO', 'BUDI SANTOSO'],
  ['PT GOJEK INDONESIA TBK', 'GOJEK INDONESIA'],
  ['SEPA LASTSCHRIFT HETZNER ONLINE GMBH', 'HETZNER GMBH'],
  // US formats are unchanged.
  ['SQ *BLUE BOTTLE COFFEE', 'BLUE BOTTLE'],
  ['POS DEBIT 0312 SHELL OIL 57444', 'SHELL OIL'],
  ['TRANSFER TO SAVINGS 4521', 'TRANSFER SAVINGS'],
];
for (const [input, key] of MERCHANTS) eq(normalizeMerchant(input).key, key, `normalizeMerchant(${JSON.stringify(input)})`);

// The sample statements in samples/ import cleanly with no help from the browser's locale.
function readSample(name: string) {
  const text = readFileSync(new URL(`../../samples/${name}`, import.meta.url), 'utf8');
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: 'greedy', transformHeader: (h) => h.trim() });
  return { headers: (result.meta.fields ?? []).filter(Boolean), rows: result.data };
}
const SAMPLES: [string, string, string, number, number][] = [
  // file, currency, decimal mark, rows, first amount
  ['statement-rupiah.csv', 'IDR', 'comma', 26, 7500000],
  ['statement-euro.csv', 'EUR', 'comma', 22, 2400],
  ['statement-usd.csv', 'USD', 'dot', 40, -59.99],
];
for (const [file, currency, decimalMark, count, first] of SAMPLES) {
  const sample = readSample(file);
  const mapping = guessMapping(sample.headers, sample.rows);
  const imported = toRawRows(sample, mapping);
  const keys = new Set(imported.rows.map((r) => normalizeMerchant(r.description).key));
  eq(
    [mapping.currency, mapping.decimalMark, imported.rows.length, imported.skipped, imported.unreadDates, imported.rows[0]?.amount, keys.size === imported.rows.length],
    [currency, decimalMark, count, 0, 0, first, true],
    `sample ${file}`,
  );
}

const total = DATES.length + 4 + AMOUNTS.length + 3 + 2 + MARKED.length + 4 + 13 + 2 + 1 + MERCHANTS.length + SAMPLES.length;
console.log(`${failures === 0 ? 'PASS' : 'FAIL'}  CSV helpers: ${total - failures}/${total} checks`);
process.exitCode = failures ? 1 : 0;
