// Tests the rule layer of the outgoing-message guard (src/lib/core/guardRules.ts).
// The on-device model layer needs Gemini Nano and is checked in the app.
//
// Set A: written AFTER rules v1 were locked, so it measures how v1 generalizes.
// Set B: found in an audit BEFORE rule v2 (merchant names) was added, so it only
//        proves that gap is closed. It is reported separately on purpose.
//
// Run: npm run test:g9

import { DEMO_ROWS } from '../src/lib/core/demoData.ts';
import { deterministicGuard, merchantPhrases, merchantTokens } from '../src/lib/core/guardRules.ts';
import { normalizeMerchant } from '../src/lib/core/merchant.ts';

const UNSAFE_A = [
  'Can you tell me if the 312.40 Delta flight on Oct 12 counts as travel?',
  'Shutterstock charged me $29, business or not?',
  '10/16 QUICKBOOKS ONLINE 30.00',
  'I paid Kaiser Permanente 30 dollars for a copay, is that deductible?',
  'Here is my statement:\nOCT 20 SQUARESPACE ANNUAL PLAN 192.00\nOCT 22 STEAMGAMES.COM 19.99',
  'Was the Wacom tablet from B&H on the 7th a business expense? It was 379.99',
  'MAILCHIMP *MONTHLY -20.00',
  'Got 1800 from Nordlicht GmbH via Wise on October 30',
];

const SAFE_A = [
  'What was my biggest business category last month?',
  'How does my personal spending compare to business spending?',
  'Is a coworking membership usually a business expense?',
  'Summarize my spending for October.',
  'Which months do I have data for?',
  'Did my software costs go up?',
  'How many transactions do I still need to review?',
  'Give me three tips to keep receipts organized.',
];

const UNSAFE_B = [
  'What did I pay Adobe Creative Cloud?',
  'adobe creative cloud fifty nine ninety nine on october first',
  'Did the payment to J. Rivera count as personal?',
  'How much went to Target and Costco?',
  'Oakwood Property Mgmt rent 1450',
  'Is Whole Foods a personal expense?',
];

const SAFE_B = [
  'How much did I spend on travel in 2026?',
  'What did I spend in October 2026?',
  'Compare 2026-09 and 2026-10 for business.',
  'Is my software spend above 300 dollars?',
  'How much did I spend on design software this month?',
  'Can I deduct 50% of meals?',
  'What is the total for Q4 2026?',
  'Did I spend more than $500 on equipment?',
];

const tokens = merchantTokens(DEMO_ROWS.map((r) => r.description));
const phrases = merchantPhrases(DEMO_ROWS.map((r) => normalizeMerchant(r.description).key));

function run(name: string, unsafe: string[], safe: string[], maxFalseBlocks: number): boolean {
  let caught = 0;
  let falseBlocks = 0;
  console.log(`\n== Set ${name} ==`);
  for (const message of unsafe) {
    const d = deterministicGuard(message, tokens, phrases);
    if (d.block) caught += 1;
    console.log(`${d.block ? 'BLOCK ' : 'MISSED'}  unsafe  ${JSON.stringify(message).slice(0, 70)}${d.block ? `  (${d.reasons.join('; ')})` : ''}`);
  }
  for (const message of safe) {
    const d = deterministicGuard(message, tokens, phrases);
    if (d.block) falseBlocks += 1;
    console.log(`${d.block ? 'FALSE ' : 'ALLOW '}  safe    ${JSON.stringify(message).slice(0, 70)}${d.block ? `  (${d.reasons.join('; ')})` : ''}`);
  }
  const pass = caught === unsafe.length && falseBlocks <= maxFalseBlocks;
  console.log(`${pass ? 'PASS' : 'FAIL'}  set ${name}: caught ${caught}/${unsafe.length} unsafe, ${falseBlocks} false blocks out of ${safe.length} safe (allowed: ${maxFalseBlocks})`);
  return pass;
}

const a = run('A (written after rules v1 were locked)', UNSAFE_A, SAFE_A, 1);
const b = run('B (audit findings, written before rule v2)', UNSAFE_B, SAFE_B, 0);
process.exitCode = a && b ? 0 : 1;
