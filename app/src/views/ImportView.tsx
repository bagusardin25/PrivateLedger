// Drag-and-drop CSV, column mapping with automatic guesses, local preview.

import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, CircleAlert, FileSpreadsheet, Lock, Upload, X } from 'lucide-react';
import { useId, useState, type DragEvent, type ReactNode } from 'react';
import { Badge, Button, Card } from '../components/ui';
import { navigate, resetSessionState } from '../lib/state/actions';
import {
  amountColumns,
  decimalMarkFor,
  detectDateOrder,
  guessMapping,
  mappingIsComplete,
  parseCsvFile,
  toRawRows,
  type ColumnMapping,
  type DateOrder,
  type DecimalMark,
  type ParsedCsv,
} from '../lib/core/csv';
import { detectCurrency } from '../lib/core/currency';
import { clearTransactions, db } from '../lib/data/db';
import { importRows } from '../lib/data/importer';
import { runOnDeviceLabeling } from '../lib/ai/labelingRunner';
import { COMMON_CURRENCIES, currencyName } from '../lib/util/currency';
import { formatMoney, plural } from '../lib/util/format';
import { ledgerCurrencyStore } from '../lib/util/ledgerCurrency';
import { useStore } from '../lib/util/store';

const SELECT =
  'min-h-8 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-fg transition-colors hover:border-line-strong focus:border-focus focus:outline-none';

export function ImportView() {
  const existing = useLiveQuery(
    async () => ({ total: await db.transactions.count(), demo: await db.transactions.filter((t) => t.isDemo).count() }),
    [],
    { total: 0, demo: 0 },
  );
  const ledgerCurrency = useStore(ledgerCurrencyStore).code;
  const [file, setFile] = useState<{ name: string; parsed: ParsedCsv }>();
  const [mapping, setMapping] = useState<ColumnMapping>();
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  /** True once the user picks a currency themselves, so the "Please check" prompt goes away. */
  const [currencyChosen, setCurrencyChosen] = useState(false);
  const inputId = useId();
  const orderId = useId();
  const currencyId = useId();
  const markId = useId();

  const load = async (selected: File | undefined) => {
    if (!selected) return;
    setError(undefined);
    try {
      const parsed = await parseCsvFile(selected);
      setFile({ name: selected.name, parsed });
      setMapping(guessMapping(parsed.headers, parsed.rows, navigator.language));
      setCurrencyChosen(false);
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

  /** Column changes also re-read how the new amount columns write their decimals. */
  const updateColumns = (patch: Partial<ColumnMapping>) => {
    if (!file || !mapping) return;
    const next = { ...mapping, ...patch };
    setMapping({ ...next, decimalMark: decimalMarkFor(file.parsed.rows, amountColumns(next)) });
  };

  const result = file && mapping && mappingIsComplete(mapping) ? toRawRows(file.parsed, mapping) : undefined;
  const dateInfo = file && mapping?.date ? detectDateOrder(file.parsed.rows.map((r) => r[mapping.date])) : undefined;
  const currencyGuess = file && mapping ? detectCurrency(file.parsed.headers, file.parsed.rows, amountColumns(mapping)) : undefined;
  const currencyFromFile = Boolean(currencyGuess?.confidence === 'high' && currencyGuess.code === mapping?.currency);
  const currencyOptions = mapping ? [...new Set([...COMMON_CURRENCIES, ...(currencyGuess?.codes ?? []), mapping.currency])] : [];
  const mostlyPositive = Boolean(result && mapping?.amountMode === 'single' && !mapping.spendingIsPositive && result.rows.length >= 5 && result.positiveShare > 0.8);

  // One ledger holds one currency: a file in another one replaces what is there.
  const replaces = Boolean(mapping && existing.total > 0 && ledgerCurrency !== mapping.currency);
  const replacesOnlyDemo = replaces && existing.demo === existing.total;

  const onImport = async () => {
    if (!file || !mapping || !result) return;
    setImporting(true);
    try {
      if (replaces) {
        await clearTransactions();
        resetSessionState();
      }
      await importRows(result.rows, { fileName: file.name, isDemo: false, currency: mapping.currency });
      navigate('transactions');
      void runOnDeviceLabeling();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setImporting(false);
    }
  };

  const importLabel = importing
    ? 'Importing…'
    : replacesOnlyDemo
      ? `Replace the demo and import ${plural(result?.rows.length ?? 0, 'transaction')}`
      : replaces
        ? `Replace and import ${plural(result?.rows.length ?? 0, 'transaction')}`
        : `Import ${plural(result?.rows.length ?? 0, 'transaction')}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Import a bank statement</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Download a CSV file from your bank&apos;s website and drop it here. It&apos;s read on your laptop and never uploaded.
          </p>
        </div>
        <Badge tone="device">
          <Lock aria-hidden className="size-3" /> Stays on your laptop
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
          className={`group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 text-center transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
            file ? 'py-7' : 'py-14'
          } ${dragging ? 'border-device bg-device-soft' : 'border-line-strong bg-sunken hover:border-line-strong hover:bg-sunken'}`}
        >
          <span
            className={`flex size-11 items-center justify-center rounded-xl border transition-colors ${
              dragging ? 'border-device bg-device text-on-inverse' : 'border-line bg-surface text-fg-secondary group-hover:border-line-strong'
            }`}
          >
            <Upload aria-hidden className="size-4" />
          </span>
          <div className="space-y-1">
            <span className="block text-sm font-semibold text-fg">{file ? 'Drop another CSV file to replace this one' : 'Drop your bank CSV file here, or browse'}</span>
            <span className="block text-xs text-fg-muted">
              Works with most banks: a date, a description, and an amount (or money in and money out), in any currency.
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
          <p role="alert" className="mt-4 flex items-center gap-2 rounded-lg border border-danger-line bg-danger-soft px-3.5 py-2.5 text-sm text-danger-ink">
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            {file ? error : `We couldn't read this file. ${error}`}
          </p>
        )}
      </Card>

      {file && mapping && (
        <Card className="fade-up">
          <div className="flex flex-wrap items-center gap-3 border-b border-line-soft pb-4">
            <span className="flex size-9 items-center justify-center rounded-lg border border-device-line bg-device-soft text-device-fg">
              <FileSpreadsheet aria-hidden className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-fg">{file.name}</h2>
              <p className="text-xs text-fg-muted tabular-nums">{plural(file.parsed.rows.length, 'row')} found</p>
            </div>
            <Button variant="ghost" className="ml-auto min-h-8 px-2.5 text-xs" onClick={clearFile}>
              <X aria-hidden className="size-3.5" /> Remove file
            </Button>
          </div>

          <fieldset className="mt-5">
            <legend className="text-xs font-medium text-fg-muted">Check that each column is right</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <ColumnSelect
                label="Date"
                value={mapping.date}
                headers={file.parsed.headers}
                onChange={(date) => setMapping({ ...mapping, date, dateOrder: detectDateOrder(file.parsed.rows.map((r) => r[date])).order })}
              />
              <ColumnSelect label="Description" value={mapping.description} headers={file.parsed.headers} onChange={(description) => setMapping({ ...mapping, description })} />
              {mapping.amountMode === 'single' ? (
                <ColumnSelect label="Amount" value={mapping.amount} headers={file.parsed.headers} onChange={(amount) => updateColumns({ amount })} />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <ColumnSelect label="Money out" value={mapping.debit} headers={file.parsed.headers} onChange={(debit) => updateColumns({ debit })} />
                  <ColumnSelect label="Money in" value={mapping.credit} headers={file.parsed.headers} onChange={(credit) => updateColumns({ credit })} />
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2.5 rounded-lg border border-line bg-sunken p-3.5">
              <OptionRow>
                <label htmlFor={currencyId}>Currency</label>
                <select
                  id={currencyId}
                  value={mapping.currency}
                  onChange={(e) => {
                    setMapping({ ...mapping, currency: e.target.value });
                    setCurrencyChosen(true);
                  }}
                  className={`${SELECT} max-w-full`}
                >
                  {currencyOptions.map((code) => (
                    <option key={code} value={code}>
                      {code} · {currencyName(code)}
                    </option>
                  ))}
                </select>
                {currencyFromFile ? (
                  <Badge tone="device">Found in your file</Badge>
                ) : currencyChosen ? null : (
                  <Badge tone="review">Please check</Badge>
                )}
              </OptionRow>
              {!currencyFromFile && !(currencyChosen && currencyGuess?.confidence !== 'high') && (
                <p className="-mt-1 text-xs text-fg-muted">
                  {currencyGuess?.confidence === 'high'
                    ? `Your file says ${currencyName(currencyGuess.code ?? '')}. Change it back if you picked another one by mistake.`
                    : "Your file doesn't say which currency it uses. Pick the currency of this bank account."}
                </p>
              )}

              <OptionRow divider>
                <label htmlFor={markId}>Numbers in this file look like</label>
                <select
                  id={markId}
                  value={mapping.decimalMark}
                  onChange={(e) => setMapping({ ...mapping, decimalMark: e.target.value as DecimalMark })}
                  className={SELECT}
                >
                  <option value="dot">1,234.56</option>
                  <option value="comma">1.234,56</option>
                </select>
              </OptionRow>

              <label className="flex items-center gap-2.5 border-t border-line pt-2.5 text-xs font-medium text-fg-secondary">
                <input
                  type="checkbox"
                  checked={mapping.amountMode === 'split'}
                  onChange={(e) => updateColumns({ amountMode: e.target.checked ? 'split' : 'single' })}
                  className="size-4 rounded accent-inverse"
                />
                Money in and money out are in separate columns
              </label>
              {mapping.amountMode === 'single' && (
                <label className="flex items-center gap-2.5 text-xs font-medium text-fg-secondary">
                  <input
                    type="checkbox"
                    checked={mapping.spendingIsPositive}
                    onChange={(e) => setMapping({ ...mapping, spendingIsPositive: e.target.checked })}
                    className="size-4 rounded accent-inverse"
                  />
                  Spending is written as positive numbers (common in card statements)
                </label>
              )}
              {dateInfo?.numeric && (
                <OptionRow divider>
                  <label htmlFor={orderId}>Dates like 03/04/2026 are written</label>
                  <select id={orderId} value={mapping.dateOrder} onChange={(e) => setMapping({ ...mapping, dateOrder: e.target.value as DateOrder })} className={SELECT}>
                    <option value="mdy">month / day / year</option>
                    <option value="dmy">day / month / year</option>
                  </select>
                  {dateInfo.ambiguous && <Badge tone="review">Both could fit: check the preview</Badge>}
                </OptionRow>
              )}
            </div>
          </fieldset>

          {result ? (
            <>
              <div className="mt-6 flex items-center justify-between gap-2">
                <h3 className="text-xs font-medium text-fg-muted">Preview (first 5 transactions)</h3>
                <span className="text-xs text-fg-muted tabular-nums">{result.rows.length.toLocaleString('en-US')} ready to import</span>
              </div>

              <div className="mt-2.5 overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-[13px]">
                  <thead className="border-b border-line bg-sunken text-left text-[11px] font-medium text-fg-muted">
                    <tr>
                      <th className="px-3.5 py-2.5">Date</th>
                      <th className="px-3.5 py-2.5">Description</th>
                      <th className="px-3.5 py-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft bg-surface">
                    {result.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-sunken">
                        <td className="px-3.5 py-2.5 whitespace-nowrap text-fg-muted tabular-nums">{row.date}</td>
                        <td className="px-3.5 py-2.5 font-mono text-xs text-fg-secondary">{row.description}</td>
                        <td className={`px-3.5 py-2.5 text-right font-medium whitespace-nowrap tabular-nums ${row.amount > 0 ? 'text-device-fg' : 'text-fg'}`}>
                          {row.amount > 0 ? '+' : ''}
                          {formatMoney(row.amount, mapping.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {replaces && (
                <p className="mt-5 flex items-start gap-2 rounded-lg border border-review-line bg-review-soft px-3.5 py-2.5 text-xs leading-relaxed text-review-ink">
                  <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-review-fg" />
                  {replacesOnlyDemo ? (
                    <span>This file replaces the demo data, which is in {currencyName(ledgerCurrency)}.</span>
                  ) : (
                    <span>
                      Your {plural(existing.total, 'transaction')} {existing.total === 1 ? 'is' : 'are'} in {currencyName(ledgerCurrency)}, and this file is in{' '}
                      {currencyName(mapping.currency)}. Amounts in two currencies can&apos;t be added up, so this file replaces them. Merchants you sorted and
                      your Privacy Ledger are kept.
                    </span>
                  )}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button variant="primary" className="min-h-10 px-4" onClick={() => void onImport()} disabled={importing || result.rows.length === 0}>
                  {importLabel}
                  {!importing && <ArrowRight aria-hidden className="size-4" />}
                </Button>
                {existing.total > 0 && !replaces && <span className="text-xs text-fg-muted">Adds to your {plural(existing.total, 'transaction')}.</span>}
                {result.skipped > 0 && (
                  <span title="Rows without a description or an amount">
                    <Badge tone="review">{plural(result.skipped, 'row')} skipped</Badge>
                  </span>
                )}
              </div>

              {(result.unreadDates > 0 || mostlyPositive || result.otherCurrency > 0) && (
                <ul className="mt-4 space-y-1.5 rounded-lg border border-review-line bg-review-soft p-3.5 text-xs text-review-ink">
                  {result.otherCurrency > 0 && (
                    <Warning>
                      {plural(result.otherCurrency, 'transaction')} in other currencies ({(currencyGuess?.codes ?? []).filter((c) => c !== mapping.currency).join(', ')})
                      {result.otherCurrency === 1 ? ' is' : ' are'} left out. Only {currencyName(mapping.currency)} is imported, because amounts in different
                      currencies can&apos;t be added up.
                    </Warning>
                  )}
                  {result.unreadDates > 0 && (
                    <Warning>
                      {plural(result.unreadDates, 'row')} {result.unreadDates === 1 ? 'has' : 'have'} a date we couldn&apos;t read. They&apos;re imported, but
                      left out of monthly totals.
                    </Warning>
                  )}
                  {mostlyPositive && (
                    <Warning>Most amounts in this file are positive. If they&apos;re purchases, tick &ldquo;Spending is written as positive numbers&rdquo; above.</Warning>
                  )}
                </ul>
              )}
            </>
          ) : (
            <p className="mt-5 rounded-lg border border-review-line bg-review-soft px-3.5 py-2.5 text-xs text-review-ink">
              Choose a column for each field above to see a preview.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

function OptionRow({ children, divider = false }: { children: ReactNode; divider?: boolean }) {
  return <div className={`flex flex-wrap items-center gap-2 text-xs text-fg-secondary ${divider ? 'border-t border-line pt-2.5' : ''}`}>{children}</div>;
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-review-fg" />
      <span>{children}</span>
    </li>
  );
}

function ColumnSelect({ label, value, headers, onChange }: { label: string; value: string; headers: string[]; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-fg-secondary">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 min-h-9 w-full rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-fg transition-colors hover:border-line-strong focus:border-focus focus:outline-none"
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
