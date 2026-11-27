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
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Import a bank statement</h1>
            <p className="mt-1 text-sm text-slate-600">Export a CSV from your bank. It is parsed locally in this browser; nothing is uploaded.</p>
          </div>
          <Badge tone="device">
            <Lock aria-hidden className="size-3" /> 100% local parsing
          </Badge>
        </div>

        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`group relative mt-5 flex cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed px-6 text-center transition-all duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink-700 ${
            file ? 'py-7' : 'py-12'
          } ${
            dragging
              ? 'border-emerald-500 bg-emerald-50/70'
              : 'border-slate-300/90 bg-slate-50/60 hover:border-ink-400 hover:bg-ink-50/30'
          }`}
        >
          <span
            className={`flex size-12 items-center justify-center rounded-2xl shadow-xs ring-1 transition-all duration-200 ${
              dragging
                ? 'scale-105 bg-emerald-600 text-white ring-emerald-700'
                : 'bg-white text-ink-700 ring-slate-200/90 group-hover:-translate-y-0.5 group-hover:ring-ink-200'
            }`}
          >
            <Upload aria-hidden className="size-5" />
          </span>
          <div className="space-y-1">
            <span className="block text-base font-semibold text-slate-900">
              {file ? 'Drop another CSV file to replace' : 'Drop a bank CSV file here, or browse'}
            </span>
            <span className="block text-xs text-slate-500">
              Works with standard bank exports containing date, description, and amount (or debit &amp; credit).
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5 pt-1">
            {['Date', 'Description', 'Amount / Debit & Credit'].map((col) => (
              <span
                key={col}
                className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/80"
              >
                {col}
              </span>
            ))}
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
          <p role="alert" className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800 ring-1 ring-rose-200">
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            Could not read the file: {error}
          </p>
        )}
      </Card>

      {file && mapping && (
        <Card className="fade-up">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80">
              <FileSpreadsheet aria-hidden className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-slate-950">{file.name}</h2>
              <p className="text-xs text-slate-500 tabular-nums">{plural(file.parsed.rows.length, 'row')} detected locally</p>
            </div>
            <Button variant="ghost" className="ml-auto min-h-8 rounded-lg px-2.5 text-xs" onClick={clearFile}>
              <X aria-hidden className="size-3.5" /> Clear file
            </Button>
          </div>

          <fieldset className="mt-5">
            <legend className="text-xs font-bold tracking-wider text-slate-500 uppercase">Match the columns</legend>
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

            <div className="mt-4 flex flex-col gap-2.5 rounded-xl bg-slate-50/80 p-3.5 ring-1 ring-slate-200/75">
              <label className="flex items-center gap-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={mapping.amountMode === 'split'}
                  onChange={(e) => setMapping({ ...mapping, amountMode: e.target.checked ? 'split' : 'single' })}
                  className="size-4 rounded accent-ink-800"
                />
                Money in and money out are in separate columns
              </label>
              {mapping.amountMode === 'single' && (
                <label className="flex items-center gap-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={mapping.spendingIsPositive}
                    onChange={(e) => setMapping({ ...mapping, spendingIsPositive: e.target.checked })}
                    className="size-4 rounded accent-ink-800"
                  />
                  Spending is written as positive numbers (common in card statements)
                </label>
              )}
              {dateInfo?.numeric && (
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-2.5 text-sm text-slate-700">
                  <label htmlFor={orderId}>Dates like 03/04/2026 are written</label>
                  <select
                    id={orderId}
                    value={mapping.dateOrder}
                    onChange={(e) => setMapping({ ...mapping, dateOrder: e.target.value as DateOrder })}
                    className="min-h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-900 shadow-2xs focus:border-ink-700 focus:outline-none"
                  >
                    <option value="mdy">month / day / year</option>
                    <option value="dmy">day / month / year</option>
                  </select>
                  {dateInfo.ambiguous && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                      Both readings fit — check the preview below
                    </span>
                  )}
                </div>
              )}
            </div>
          </fieldset>

          {result ? (
            <>
              <div className="mt-6 flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">Preview (first 5 rows)</h3>
                <span className="text-xs text-slate-500 tabular-nums">{plural(result.rows.length, 'ready row')}</span>
              </div>

              <div className="mt-2.5 overflow-x-auto rounded-xl border border-slate-200/80">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/90 text-left text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                    <tr>
                      <th className="px-3.5 py-2.5">Date</th>
                      <th className="px-3.5 py-2.5">Description</th>
                      <th className="px-3.5 py-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {result.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/70">
                        <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-600 tabular-nums">{row.date}</td>
                        <td className="px-3.5 py-2.5 font-mono text-xs text-slate-800">{row.description}</td>
                        <td
                          className={`px-3.5 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums ${
                            row.amount > 0 ? 'text-emerald-700' : 'text-slate-900'
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
                <Button variant="primary" className="min-h-11 px-5" onClick={() => void onImport()} disabled={importing || result.rows.length === 0}>
                  {importing ? 'Importing…' : `Import ${plural(result.rows.length, 'transaction')}`}
                  {!importing && <ArrowRight aria-hidden className="size-4" />}
                </Button>
                {existingCount > 0 && (
                  <span className="text-xs text-slate-500">Adds to your {plural(existingCount, 'existing transaction')}.</span>
                )}
                {result.skipped > 0 && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
                    {plural(result.skipped, 'row')} skipped (missing description or amount)
                  </span>
                )}
              </div>

              {(result.unreadDates > 0 || mostlyPositive) && (
                <ul className="mt-4 space-y-1.5 rounded-xl bg-amber-50/80 p-3.5 text-sm text-amber-950 ring-1 ring-amber-200">
                  {result.unreadDates > 0 && (
                    <li className="flex items-start gap-2">
                      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-700" />
                      <span>
                        {plural(result.unreadDates, 'row')} {result.unreadDates === 1 ? 'has' : 'have'} a date this app could not read. They are imported,
                        but left out of monthly totals.
                      </span>
                    </li>
                  )}
                  {mostlyPositive && (
                    <li className="flex items-start gap-2">
                      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-700" />
                      <span>Most amounts in this file are positive. If they are purchases, tick the positive-numbers box above.</span>
                    </li>
                  )}
                </ul>
              )}
            </>
          ) : (
            <p className="mt-5 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">
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
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-2xs transition-colors hover:border-slate-300 focus:border-ink-700 focus:outline-none"
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
