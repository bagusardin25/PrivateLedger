// Export: files are built and saved entirely in the browser. No AI, no network.

import type { Transaction } from './db';

const SOURCE_TEXT: Record<Transaction['source'], string> = {
  pending: 'Not labeled',
  rule: 'Rule',
  memory: 'Remembered',
  'on-device': 'On-device AI',
  cloud: 'Cloud AI (with consent)',
  you: 'You',
};

function cell(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function businessCsv(rows: Transaction[]): string {
  const header = ['Date', 'Merchant', 'Bank description', 'Category', 'Kind', 'Amount', 'Labeled by'];
  const lines = rows.map((t) =>
    [t.date, t.cleanMerchant, t.rawDescription, t.category ?? 'Other', t.amount < 0 ? 'Expense' : 'Income', t.amount.toFixed(2), SOURCE_TEXT[t.source]]
      .map(cell)
      .join(','),
  );
  return [header.join(','), ...lines].join('\r\n') + '\r\n';
}

/** "business-transactions-2026-10.csv", or a date range when the rows span several months. */
export function exportFileName(rows: Transaction[]): string {
  const months = [...new Set(rows.map((t) => t.date.slice(0, 7)).filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort();
  const span = months.length === 0 ? 'all' : months.length === 1 ? months[0] : `${months[0]}_to_${months.at(-1)}`;
  return `business-transactions-${span}.csv`;
}

export function downloadText(fileName: string, text: string, type = 'text/csv'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
