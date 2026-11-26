// Tests the pure CSV helpers (src/lib/csv.ts): dates, amounts, column guesses.
//
// Run: npm run test:csv

import { detectDateOrder, guessMapping, normalizeDate, parseAmount, toRawRows } from '../src/lib/csv.ts';

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

const total = DATES.length + 4 + AMOUNTS.length + 3 + 2;
console.log(`${failures === 0 ? 'PASS' : 'FAIL'}  CSV helpers: ${total - failures}/${total} checks`);
process.exitCode = failures ? 1 : 0;
