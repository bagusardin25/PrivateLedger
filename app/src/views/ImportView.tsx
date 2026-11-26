// Drag-and-drop CSV, column mapping with automatic guesses, local preview.

import { useLiveQuery } from 'dexie-react-hooks';
import { FileSpreadsheet, Upload, X } from 'lucide-react';
import { useId, useState, type DragEvent } from 'react';
import { Button, Card } from '../components/ui';
import { navigate } from '../lib/actions';
import { detectDateOrder, guessMapping, mappingIsComplete, parseCsvFile, toRawRows, type ColumnMapping, type DateOrder, type ParsedCsv } from '../lib/csv';
import { db } from '../lib/db';
import { formatMoney, plural } from '../lib/format';
import { importRows } from '../lib/importer';
import { runOnDeviceLabeling } from '../lib/labelingRunner';

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
        <h1 className="text-xl font-semibold">Import a bank statement</h1>
        <p className="mt-1 text-sm text-slate-700">Export a CSV from your bank. It is read in this browser; nothing is uploaded.</p>

        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink-800 ${
            file ? 'py-6' : 'py-10'
          } ${dragging ? 'border-emerald-600 bg-emerald-50' : 'border-slate-300 hover:border-slate-500'}`}
        >
          <Upload aria-hidden className="size-6 text-slate-600" />
          <span className="font-medium">{file ? 'Drop another CSV file to replace' : 'Drop a CSV file here, or choose one'}</span>
          <span className="text-xs text-slate-600">Needs columns for date, description, and amount (or debit and credit).</span>
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
          <p role="alert" className="mt-3 text-sm text-rose-800">
            Could not read the file: {error}
          </p>
        )}
      </Card>

      {file && mapping && (
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <FileSpreadsheet aria-hidden className="size-5 text-slate-600" />
            <h2 className="font-semibold">{file.name}</h2>
            <span className="text-sm text-slate-600">{plural(file.parsed.rows.length, 'row')}</span>
            <Button variant="ghost" className="ml-auto min-h-8 px-2.5 text-xs" onClick={clearFile}>
              <X aria-hidden className="size-3.5" /> Clear file
            </Button>
          </div>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium">Match the columns</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
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
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={mapping.amountMode === 'split'}
                onChange={(e) => setMapping({ ...mapping, amountMode: e.target.checked ? 'split' : 'single' })}
                className="size-4 accent-ink-800"
              />
              Money in and money out are in separate columns
            </label>
            {mapping.amountMode === 'single' && (
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={mapping.spendingIsPositive}
                  onChange={(e) => setMapping({ ...mapping, spendingIsPositive: e.target.checked })}
                  className="size-4 accent-ink-800"
                />
                Spending is written as positive numbers (common in card statements)
              </label>
            )}
            {dateInfo?.numeric && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                <label htmlFor={orderId}>Dates like 03/04/2026 are written</label>
                <select
                  id={orderId}
                  value={mapping.dateOrder}
                  onChange={(e) => setMapping({ ...mapping, dateOrder: e.target.value as DateOrder })}
                  className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-sm focus:border-ink-800"
                >
                  <option value="mdy">month / day / year</option>
                  <option value="dmy">day / month / year</option>
                </select>
                {dateInfo.ambiguous && <span className="text-xs text-amber-900">Both readings fit this file, so check the preview.</span>}
              </div>
            )}
          </fieldset>

          {result ? (
            <>
              <h3 className="mt-5 text-sm font-medium">Preview</h3>
              <div className="mt-2 overflow-x-auto rounded-md ring-1 ring-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-2 whitespace-nowrap tabular-nums">{row.date}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.description}</td>
                        <td className={`px-3 py-2 text-right whitespace-nowrap tabular-nums ${row.amount > 0 ? 'font-medium text-emerald-800' : ''}`}>
                          {row.amount > 0 ? '+' : ''}
                          {formatMoney(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button variant="primary" onClick={() => void onImport()} disabled={importing || result.rows.length === 0}>
                  {importing ? 'Importing…' : `Import ${plural(result.rows.length, 'transaction')}`}
                </Button>
                {existingCount > 0 && (
                  <span className="text-xs text-slate-600">Adds to your {plural(existingCount, 'existing transaction')}.</span>
                )}
                {result.skipped > 0 && (
                  <span className="text-sm text-amber-900">{plural(result.skipped, 'row')} skipped (no description or amount).</span>
                )}
              </div>
              {(result.unreadDates > 0 || mostlyPositive) && (
                <ul className="mt-3 space-y-1 text-sm text-amber-900">
                  {result.unreadDates > 0 && (
                    <li>
                      {plural(result.unreadDates, 'row')} {result.unreadDates === 1 ? 'has' : 'have'} a date this app could not read. They are imported, but left
                      out of monthly totals.
                    </li>
                  )}
                  {mostlyPositive && <li>Most amounts in this file are positive. If they are purchases, tick the positive-numbers box above.</li>}
                </ul>
              )}
            </>
          ) : (
            <p className="mt-4 text-sm text-amber-900">Choose a column for each field to see a preview.</p>
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
      <label htmlFor={id} className="block text-xs font-medium text-slate-600">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm focus:border-ink-800"
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
