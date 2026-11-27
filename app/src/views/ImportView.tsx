// Drag-and-drop CSV, column mapping with automatic guesses, local preview.

import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, CircleAlert, FileSpreadsheet, Lock, Upload, X } from 'lucide-react';
import { useId, useState, type DragEvent } from 'react';
import { Badge, Button, Card } from '../components/ui';
import { navigate } from '../lib/state/actions';
import { detectDateOrder, guessMapping, mappingIsComplete, parseCsvFile, toRawRows, type ColumnMapping, type DateOrder, type ParsedCsv } from '../lib/core/csv';
import { db } from '../lib/data/db';
import { formatMoney, plural } from '../lib/util/format';
import { importRows } from '../lib/data/importer';
import { runOnDeviceLabeling } from '../lib/ai/labelingRunner';

export function ImportView() {
  const existingCount = useLiveQuery(() => db.transactions.count(), [], 0);
  const [file, setFile] = useState<{ name: string; parsed: ParsedCsv }>();
  const [mapping, setMapping] = useState<ColumnMapping>();
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const inputId = useId();
  const orderId = useId();

  const load = async (selected: File | undefined) => {
    if (!selected) return;
    setError(undefined);
    try {
      const parsed = await parseCsvFile(selected);
      setFile({ name: selected.name, parsed });
      setMapping(guessMapping(parsed.headers, parsed.rows));
    } catch (e) {
      setFile(undefined);
      setMapping(undefined);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const clearFile = () => {
    setFile(undefined);
    setMapping(undefined);
    setError(undefined);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void load(event.dataTransfer.files[0]);
  };

  const result = file && mapping && mappingIsComplete(mapping) ? toRawRows(file.parsed, mapping) : undefined;
  const dateInfo = file && mapping?.date ? detectDateOrder(file.parsed.rows.map((r) => r[mapping.date])) : undefined;
  const mostlyPositive = Boolean(result && mapping?.amountMode === 'single' && !mapping.spendingIsPositive && result.rows.length >= 5 && result.positiveShare > 0.8);

  const onImport = async () => {
    if (!file || !result) return;
    setImporting(true);
    try {
      await importRows(result.rows, { fileName: file.name, isDemo: false });
      navigate('transactions');
      void runOnDeviceLabeling();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">Import a bank statement</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Export a CSV from your bank. Parsed locally in this browser; nothing is uploaded.</p>
        </div>
        <Badge tone="device">
          <Lock aria-hidden className="size-3" /> 100% local parsing
        </Badge>
      </div>

      <Card>
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 text-center transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-zinc-900 ${
            file ? 'py-7' : 'py-14'
          } ${
            dragging
              ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-500/10'
              : 'border-zinc-300 bg-zinc-50/50 hover:border-zinc-400 hover:bg-zinc-50 dark:border-white/[0.14] dark:bg-white/[0.02] dark:hover:border-white/[0.25] dark:hover:bg-white/[0.04]'
          }`}
        >
          <span
            className={`flex size-11 items-center justify-center rounded-xl border transition-colors ${
              dragging
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-zinc-200/90 bg-white text-zinc-700 group-hover:border-zinc-300 dark:border-white/[0.1] dark:bg-[#111114] dark:text-zinc-200'
            }`}
          >
            <Upload aria-hidden className="size-4" />
          </span>
          <div className="space-y-1">
            <span className="block text-sm font-semibold text-zinc-950 dark:text-white">
              {file ? 'Drop another CSV file to replace' : 'Drop a bank CSV file here, or browse'}
            </span>
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">
              Supports standard exports with date, description, and amount (or debit &amp; credit).
            </span>
          </div>
          <input
            id={inputId}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              e.currentTarget.value = '';
              void load(selected);
            }}
          />
        </label>

        {error && (
          <p
            role="alert"
            className="mt-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
          >
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            Could not read the file: {error}
          </p>
        )}
      </Card>

      {file && mapping && (
        <Card className="fade-up">
          <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 pb-4 dark:border-white/[0.06]">
            <span className="flex size-9 items-center justify-center rounded-lg border border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
              <FileSpreadsheet aria-hidden className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-zinc-950 dark:text-white">{file.name}</h2>
              <p className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{plural(file.parsed.rows.length, 'row')} detected locally</p>
            </div>
            <Button variant="ghost" className="ml-auto min-h-8 px-2.5 text-xs" onClick={clearFile}>
              <X aria-hidden className="size-3.5" /> Clear file
            </Button>
          </div>

          <fieldset className="mt-5">
            <legend className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Match the columns</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <ColumnSelect
                label="Date"
                value={mapping.date}
                headers={file.parsed.headers}
                onChange={(date) => setMapping({ ...mapping, date, dateOrder: detectDateOrder(file.parsed.rows.map((r) => r[date])).order })}
              />
              <ColumnSelect
                label="Description"
                value={mapping.description}
                headers={file.parsed.headers}
                onChange={(description) => setMapping({ ...mapping, description })}
              />
              {mapping.amountMode === 'single' ? (
                <ColumnSelect label="Amount" value={mapping.amount} headers={file.parsed.headers} onChange={(amount) => setMapping({ ...mapping, amount })} />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <ColumnSelect label="Money out" value={mapping.debit} headers={file.parsed.headers} onChange={(debit) => setMapping({ ...mapping, debit })} />
                  <ColumnSelect label="Money in" value={mapping.credit} headers={file.parsed.headers} onChange={(credit) => setMapping({ ...mapping, credit })} />
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2.5 rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3.5 dark:border-white/[0.07] dark:bg-white/[0.02]">
              <label className="flex items-center gap-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={mapping.amountMode === 'split'}
                  onChange={(e) => setMapping({ ...mapping, amountMode: e.target.checked ? 'split' : 'single' })}
                  className="size-4 rounded accent-zinc-900"
                />
                Money in and money out are in separate columns
              </label>
              {mapping.amountMode === 'single' && (
                <label className="flex items-center gap-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={mapping.spendingIsPositive}
                    onChange={(e) => setMapping({ ...mapping, spendingIsPositive: e.target.checked })}
                    className="size-4 rounded accent-zinc-900"
                  />
                  Spending is written as positive numbers (common in card statements)
                </label>
              )}
              {dateInfo?.numeric && (
                <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200/75 pt-2.5 text-xs text-zinc-700 dark:border-white/[0.07] dark:text-zinc-300">
                  <label htmlFor={orderId}>Dates like 03/04/2026 are written</label>
                  <select
                    id={orderId}
                    value={mapping.dateOrder}
                    onChange={(e) => setMapping({ ...mapping, dateOrder: e.target.value as DateOrder })}
                    className="min-h-8 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-white/[0.1] dark:bg-[#111114] dark:text-zinc-100"
                  >
                    <option value="mdy">month / day / year</option>
                    <option value="dmy">day / month / year</option>
                  </select>
                  {dateInfo.ambiguous && <Badge tone="review">Both readings fit — check preview</Badge>}
                </div>
              )}
            </div>
          </fieldset>

          {result ? (
            <>
              <div className="mt-6 flex items-center justify-between gap-2">
                <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Preview (first 5 rows)</h3>
                <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{plural(result.rows.length, 'ready row')}</span>
              </div>

              <div className="mt-2.5 overflow-x-auto rounded-lg border border-zinc-200/80 dark:border-white/[0.08]">
                <table className="w-full text-[13px]">
                  <thead className="border-b border-zinc-200/80 bg-zinc-50/70 text-left text-[11px] font-medium text-zinc-500 dark:border-white/[0.07] dark:bg-white/[0.02] dark:text-zinc-400">
                    <tr>
                      <th className="px-3.5 py-2.5">Date</th>
                      <th className="px-3.5 py-2.5">Description</th>
                      <th className="px-3.5 py-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 bg-white dark:divide-white/[0.05] dark:bg-[#111114]">
                    {result.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-zinc-50/70 dark:hover:bg-white/[0.02]">
                        <td className="px-3.5 py-2.5 whitespace-nowrap text-zinc-500 tabular-nums dark:text-zinc-400">{row.date}</td>
                        <td className="px-3.5 py-2.5 font-mono text-xs text-zinc-800 dark:text-zinc-200">{row.description}</td>
                        <td
                          className={`px-3.5 py-2.5 text-right font-medium whitespace-nowrap tabular-nums ${
                            row.amount > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-900 dark:text-zinc-100'
                          }`}
                        >
                          {row.amount > 0 ? '+' : ''}
                          {formatMoney(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button variant="primary" className="min-h-10 px-4" onClick={() => void onImport()} disabled={importing || result.rows.length === 0}>
                  {importing ? 'Importing…' : `Import ${plural(result.rows.length, 'transaction')}`}
                  {!importing && <ArrowRight aria-hidden className="size-4" />}
                </Button>
                {existingCount > 0 && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Adds to your {plural(existingCount, 'existing transaction')}.</span>
                )}
                {result.skipped > 0 && <Badge tone="review">{plural(result.skipped, 'row')} skipped</Badge>}
              </div>

              {(result.unreadDates > 0 || mostlyPositive) && (
                <ul className="mt-4 space-y-1.5 rounded-lg border border-amber-200/80 bg-amber-50/60 p-3.5 text-xs text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                  {result.unreadDates > 0 && (
                    <li className="flex items-start gap-2">
                      <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
                      <span>
                        {plural(result.unreadDates, 'row')} {result.unreadDates === 1 ? 'has' : 'have'} a date this app could not read. They are imported,
                        but left out of monthly totals.
                      </span>
                    </li>
                  )}
                  {mostlyPositive && (
                    <li className="flex items-start gap-2">
                      <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
                      <span>Most amounts in this file are positive. If they are purchases, tick the positive-numbers box above.</span>
                    </li>
                  )}
                </ul>
              )}
            </>
          ) : (
            <p className="mt-5 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              Choose a column for each field above to see a preview.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

function ColumnSelect({ label, value, headers, onChange }: { label: string; value: string; headers: string[]; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 min-h-9 w-full rounded-lg border border-zinc-200/90 bg-white px-3 text-[13px] font-medium text-zinc-900 transition-colors hover:border-zinc-300 focus:border-zinc-900 focus:outline-none dark:border-white/[0.1] dark:bg-[#111114] dark:text-zinc-100 dark:hover:border-white/[0.18] dark:focus:border-zinc-400"
      >
        <option value="">Choose a column</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  );
}
