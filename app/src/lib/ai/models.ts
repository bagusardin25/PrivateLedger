// Every Firebase AI Logic model instance in the app: one instance per inference
// configuration, and the mode of each one follows the sensitivity of the data
// it handles.
//
//   instance         mode               what it is given
//   ---------------  -----------------  ------------------------------------------
//   labeler          ONLY_ON_DEVICE     raw bank rows and the business profile
//   guard            ONLY_ON_DEVICE     a chat message, before it may leave
//   explainer        PREFER_ON_DEVICE   one cleaned merchant name
//   reporter         PREFER_IN_CLOUD    monthly totals
//   advisor          ONLY_IN_CLOUD      a question, plus totals from local functions
//   consentLabeler   ONLY_IN_CLOUD      rows the user explicitly agreed to send
//
// Firebase AI Logic sends an ONLY_ON_DEVICE request to the cloud when the
// browser has no `LanguageModel` API (see onDevice.ts). Callers of `labeler`
// and `guard` must therefore pass assertOnDeviceReady() first.
//
// The getter of every instance that can reach the cloud calls recoverAppCheck()
// first: if App Check was set up while offline, that finishes the setup (see
// firebase.ts).

import { getGenerativeModel, InferenceMode, Schema, type GenerativeModel } from 'firebase/ai';
import { getFirebase, recoverAppCheck } from './firebase';
import { FUNCTION_DECLARATIONS } from './localFunctions';
import { TEXT_EN } from './onDevice';
import { CATEGORIES } from '../core/taxonomy';

/** The only "billing not required" model that answered quickly and reliably in our tests (2 to 7 s). */
export const CLOUD_MODEL = 'gemini-3.5-flash-lite';
export const ON_DEVICE_MODEL = 'Gemini Nano in Chrome';

const systemPrompt = (text: string) => [{ role: 'system' as const, content: [{ type: 'text' as const, value: text }] }];

function onDevice(system: string, responseConstraint: object) {
  return {
    createOptions: { expectedInputs: TEXT_EN, expectedOutputs: TEXT_EN, initialPrompts: systemPrompt(system) },
    promptOptions: { responseConstraint },
  };
}

// ---------------------------------------------------------------------------
// labeler and consentLabeler: business or personal, plus a category.

export const LABELER_SYSTEM = [
  'You label bank transactions for a freelancer whose business and personal spending share one account.',
  'For every merchant return: id, type, category.',
  'type is "business" only if it is clearly a cost or income of the freelance business described in the profile.',
  'type is "personal" if it is clearly private: rent, groceries, entertainment, health, gym, streaming.',
  'type is "unsure" if it could reasonably be either, or if the profile does not clearly explain it.',
  'category must be exactly one value from the allowed list.',
  'Keep every id exactly as given, return one item per merchant, and never invent merchants.',
].join('\n');

const LABEL_JSON_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['business', 'personal', 'unsure'] },
          category: { type: 'string', enum: [...CATEGORIES] },
        },
        required: ['id', 'type', 'category'],
      },
    },
  },
  required: ['items'],
};

let labeler: GenerativeModel | undefined;

/** `labeler`: ONLY_ON_DEVICE. Raw rows never have a cloud path. */
export function getLabelerModel(): GenerativeModel {
  labeler ??= getGenerativeModel(getFirebase().ai, {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: onDevice(LABELER_SYSTEM, LABEL_JSON_SCHEMA),
  });
  return labeler;
}

let consentLabeler: GenerativeModel | undefined;

/**
 * `consentLabeler`: ONLY_IN_CLOUD, used only after the user explicitly agrees to
 * send rows because on-device AI is unavailable.
 */
export function getConsentLabelerModel(): GenerativeModel {
  recoverAppCheck();
  consentLabeler ??= getGenerativeModel(getFirebase().ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: {
      model: CLOUD_MODEL,
      systemInstruction: LABELER_SYSTEM,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: Schema.object({
          properties: {
            items: Schema.array({
              items: Schema.object({
                properties: {
                  id: Schema.string(),
                  type: Schema.enumString({ enum: ['business', 'personal', 'unsure'] }),
                  category: Schema.enumString({ enum: [...CATEGORIES] }),
                },
              }),
            }),
          },
        }),
      },
    },
  });
  return consentLabeler;
}

// ---------------------------------------------------------------------------
// guard: decides on this device whether a chat message may be sent.

const GUARD_SYSTEM = [
  'You are a privacy filter. A user is about to send a chat message to a cloud AI assistant.',
  'Answer "contains_transaction_data" if the message includes raw bank transaction details:',
  'a specific merchant or payee together with an amount or a date, or pasted statement rows.',
  'Answer "safe" for general questions about categories, totals, trends, or advice.',
].join('\n');

let guard: GenerativeModel | undefined;

/** `guard`: ONLY_ON_DEVICE. The message is checked before it is allowed to leave. */
export function getGuardModel(): GenerativeModel {
  guard ??= getGenerativeModel(getFirebase().ai, {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: onDevice(GUARD_SYSTEM, {
      type: 'object',
      properties: { verdict: { type: 'string', enum: ['safe', 'contains_transaction_data'] } },
      required: ['verdict'],
    }),
  });
  return guard;
}

// ---------------------------------------------------------------------------
// explainer: what is this merchant?

const EXPLAINER_SYSTEM = [
  'You explain what a merchant on a bank statement is.',
  'Given a merchant name, say in one short sentence what the company sells or does.',
  'If you do not recognize the merchant with confidence, set known to false and leave explanation empty. Never guess.',
  'Do not say whether the charge is a business or personal expense.',
].join('\n');

let explainer: GenerativeModel | undefined;

/**
 * `explainer`: PREFER_ON_DEVICE. A merchant name is better kept local, so
 * Gemini Nano answers when it is available. Without it the SDK routes to the
 * cloud, which the app only allows after the user agrees (see explainer.ts).
 */
export function getExplainerModel(): GenerativeModel {
  recoverAppCheck();
  explainer ??= getGenerativeModel(getFirebase().ai, {
    mode: InferenceMode.PREFER_ON_DEVICE,
    inCloudParams: {
      model: CLOUD_MODEL,
      systemInstruction: EXPLAINER_SYSTEM,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: Schema.object({ properties: { known: Schema.boolean(), explanation: Schema.string() } }),
      },
    },
    onDeviceParams: onDevice(EXPLAINER_SYSTEM, {
      type: 'object',
      properties: { known: { type: 'boolean' }, explanation: { type: 'string' } },
      required: ['known', 'explanation'],
    }),
  });
  return explainer;
}

// ---------------------------------------------------------------------------
// reporter: a short written summary from monthly totals.

const REPORTER_SYSTEM = [
  'You write a short spending summary for a freelancer from monthly totals. Use only the numbers given.',
  'headline: one sentence with the single most useful insight, not a title.',
  'highlights: 2 to 3 short sentences. Name the biggest business cost and any notable change from the previous period.',
  'warnings: mention unsorted transactions if there are any; otherwise leave it empty.',
  'Write amounts in the currency named in the data, with its usual symbol: $1,234.56 for USD, Rp 1,500,000 for IDR, €1,234.56 for EUR. Never convert between currencies. Do not give tax or financial advice.',
].join('\n');

let reporter: GenerativeModel | undefined;

/**
 * `reporter`: PREFER_IN_CLOUD. Totals are safe to send and the cloud model
 * writes better; when the cloud cannot answer, the SDK falls back to Gemini Nano.
 */
export function getReporterModel(): GenerativeModel {
  recoverAppCheck();
  reporter ??= getGenerativeModel(getFirebase().ai, {
    mode: InferenceMode.PREFER_IN_CLOUD,
    inCloudParams: {
      model: CLOUD_MODEL,
      systemInstruction: REPORTER_SYSTEM,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: Schema.object({
          properties: { headline: Schema.string(), highlights: Schema.array({ items: Schema.string() }), warnings: Schema.array({ items: Schema.string() }) },
        }),
      },
    },
    onDeviceParams: onDevice(REPORTER_SYSTEM, {
      type: 'object',
      properties: {
        headline: { type: 'string' },
        highlights: { type: 'array', items: { type: 'string' } },
        warnings: { type: 'array', items: { type: 'string' } },
      },
      required: ['headline', 'highlights', 'warnings'],
    }),
  });
  return reporter;
}

// ---------------------------------------------------------------------------
// advisor: multi-turn chat whose only access to the data is local functions.

const ADVISOR_SYSTEM = [
  'You are the advisor in Private Ledger, an app that helps a freelancer separate business and personal spending.',
  "You never see individual transactions. To answer questions about the user's money, call the provided functions.",
  "They run on the user's device and return totals only. If you do not know which month the user means, call get_available_periods first.",
  "Every function result names its currency; write amounts in that currency with its usual symbol and never convert between currencies. If a question needs individual transactions or merchant names, say this assistant cannot see them and point to the Transactions screen.",
  'Answer in 2 to 4 short sentences with the key numbers. Do not give tax, legal, or investment advice; for general questions give general information and suggest checking with an accountant.',
].join(' ');

let advisor: GenerativeModel | undefined;

/** `advisor`: ONLY_IN_CLOUD. Multi-turn chat and function calling only exist in the cloud. */
export function getAdvisorModel(): GenerativeModel {
  recoverAppCheck();
  advisor ??= getGenerativeModel(getFirebase().ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: { model: CLOUD_MODEL, systemInstruction: ADVISOR_SYSTEM, tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }] },
  });
  return advisor;
}
