// Tests the labeling steps that need no model (src/lib/core/prepare.ts):
// - every mixed-use row lands in the review queue;
// - transfers, P2P payments, and savings are never labeled business;
// - how many unique merchants are left for the on-device model.
// "First row under 3 s" needs Gemini Nano and is measured in the app instead.
//
// Run: npm run test:g8

import { DEMO_ROWS } from '../src/lib/core/demoData.ts';
import { prepareRows } from '../src/lib/core/prepare.ts';

const { rows, modelMerchants } = prepareRows(DEMO_ROWS, new Map());
let failures = 0;
const check = (ok: boolean, message: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${message}`);
  if (!ok) failures += 1;
};

const mixedUse = rows.filter((r) => r.rule?.startsWith('mixed-use:'));
check(mixedUse.every((r) => r.needsReview), `${mixedUse.length} mixed-use rows, all in the review queue`);

const neverBusiness = rows.filter((r) => /VENMO|ZELLE|TRANSFER TO SAVINGS|TRANSFER FROM SAVINGS/.test(r.description));
check(
  neverBusiness.length > 0 && neverBusiness.every((r) => r.source === 'rule' && r.type !== 'business'),
  `${neverBusiness.length} transfer/P2P/savings rows labeled by rules, none as business`,
);

const ambiguous = DEMO_ROWS.map((d, i) => ({ d, r: rows[i] })).filter(({ d }) => d.expectedType === 'ambiguous');
const ambiguousInReview = ambiguous.filter(({ r }) => r.needsReview).length;
check(ambiguousInReview === ambiguous.length, `ambiguous rows in review queue before any model: ${ambiguousInReview}/${ambiguous.length}`);

const wrongByRules = DEMO_ROWS.map((d, i) => ({ d, r: rows[i] })).filter(
  ({ d, r }) => r.source === 'rule' && d.expectedType !== 'ambiguous' && r.type !== 'unsure' && r.type !== d.expectedType,
);
check(wrongByRules.length === 0, `rule labels that contradict the ground truth: ${wrongByRules.length}`);
for (const { d, r } of wrongByRules) console.log(`      ${d.description}: rule says ${r.type}, expected ${d.expectedType}`);

const byRule = rows.filter((r) => r.source === 'rule').length;
console.log(`INFO  ${rows.length} rows: ${byRule} labeled by rules, ${rows.length - byRule} left for the model`);
console.log(`INFO  unique merchants sent to the on-device model: ${modelMerchants.length} (rows: ${rows.length - byRule})`);
const merged = modelMerchants.filter((m) => m.rowCount > 1);
if (merged.length) console.log(`INFO  merchants that merged several rows: ${merged.map((m) => `${m.key} ×${m.rowCount}`).join(', ')}`);

process.exitCode = failures ? 1 : 0;
