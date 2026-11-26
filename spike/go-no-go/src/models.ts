import { getGenerativeModel, InferenceMode, Schema, type AI, type GenerativeModel } from 'firebase/ai';
import { CATEGORIES, CONFIDENCE, TYPES } from './data';
import { TEXT_EN } from './onDevice';

/** Cloud models from the PRD (all "billing not required" in the Firebase AI Logic model list). */
export const CLOUD_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-4-hydrogen'] as const;

/** PRD model per feature (section 7.1). */
export const REPORTER_MODEL = 'gemini-3.8-flash';
export const ADVISOR_MODEL = 'gemini-4-hydrogen';

/**
 * Smallest PRD model. On 26 Nov the two larger models returned 500 "high demand"
 * and 429 quota errors, so the cloud features are also checked on this one.
 */
export const FALLBACK_CLOUD_MODEL = 'gemini-3.5-flash-lite';

const LABELER_SYSTEM = [
  'You label bank transactions for a freelancer whose business and personal spending share one account.',
  'For every transaction return:',
  '- type: "business" if it is clearly a cost or income of the freelance business, "personal" if it is clearly private, "unsure" if it could reasonably be either.',
  '- category: exactly one value from the allowed list.',
  '- cleanMerchant: a short, readable merchant name.',
  '- confidence: high, medium, or low.',
  'Keep every id exactly as given, return one item per transaction, and never invent transactions.',
].join('\n');

const EXPLAINER_SYSTEM = [
  'You explain merchant names that appear on bank statements, in one short sentence.',
  'If you do not recognise the specific business, set known to false and say that you do not recognise it.',
  'Never guess what an unknown merchant sells.',
].join('\n');

const GUARD_SYSTEM = [
  'You are a privacy filter. A user is about to send a chat message to a cloud AI assistant.',
  'Answer "contains_transaction_data" if the message includes raw bank transaction details:',
  'a specific merchant or payee together with an amount or a date, or pasted statement rows.',
  'Answer "safe" for general questions about categories, totals, trends, or advice.',
].join('\n');

const REPORTER_SYSTEM =
  'You write a short spending summary for a freelancer from monthly totals. Use only the numbers given. Do not give tax or financial advice.';

const ADVISOR_SYSTEM = [
  'You help a freelancer understand their spending. You never see raw transactions.',
  "To answer questions about their data, call the provided functions. They run on the user's device and return totals only.",
  'If a question needs individual transactions, say that this assistant cannot see them.',
  'Do not give tax or financial advice.',
].join(' ');

// JSON Schemas for on-device structured output (Chrome Prompt API `responseConstraint`).
export const labelJsonSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          cleanMerchant: { type: 'string' },
          type: { type: 'string', enum: [...TYPES] },
          category: { type: 'string', enum: [...CATEGORIES] },
          confidence: { type: 'string', enum: [...CONFIDENCE] },
        },
        required: ['id', 'cleanMerchant', 'type', 'category', 'confidence'],
      },
    },
  },
  required: ['items'],
};

const explainJsonSchema = {
  type: 'object',
  properties: { known: { type: 'boolean' }, explanation: { type: 'string' } },
  required: ['known', 'explanation'],
};

const guardJsonSchema = {
  type: 'object',
  properties: { verdict: { type: 'string', enum: ['safe', 'contains_transaction_data'] } },
  required: ['verdict'],
};

const reportJsonSchema = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    highlights: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['headline', 'highlights', 'warnings'],
};

export function onDevice(system: string, responseConstraint: object) {
  return {
    createOptions: {
      expectedInputs: TEXT_EN,
      expectedOutputs: TEXT_EN,
      initialPrompts: [{ role: 'system' as const, content: [{ type: 'text' as const, value: system }] }],
    },
    promptOptions: { responseConstraint },
  };
}

const spendingByCategoryDeclaration = {
  name: 'get_spending_by_category',
  description: "Returns the user's total spending per category for one month. Runs on the user's device and returns totals only.",
  parameters: Schema.object({
    properties: {
      period: Schema.string({ description: 'Month in YYYY-MM format, for example 2026-10.' }),
      type: Schema.enumString({
        enum: ['business', 'personal', 'all'],
        description: 'Which spending to include.',
      }),
    },
  }),
};

const splitDeclaration = {
  name: 'get_business_personal_split',
  description: "Returns the user's total business and personal spending for one month. Runs on the user's device and returns totals only.",
  parameters: Schema.object({
    properties: {
      period: Schema.string({ description: 'Month in YYYY-MM format, for example 2026-10.' }),
    },
  }),
};

export interface Models {
  labeler: GenerativeModel;
  explainer: GenerativeModel;
  guard: GenerativeModel;
}

/** On-device instances (L0/L1 data). Every call must pass `assertOnDeviceReady()` first. */
export function createOnDeviceModels(ai: AI): Models {
  return {
    labeler: getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_ON_DEVICE,
      onDeviceParams: onDevice(LABELER_SYSTEM, labelJsonSchema),
    }),
    explainer: getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_ON_DEVICE,
      onDeviceParams: onDevice(EXPLAINER_SYSTEM, explainJsonSchema),
    }),
    guard: getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_ON_DEVICE,
      onDeviceParams: onDevice(GUARD_SYSTEM, guardJsonSchema),
    }),
  };
}

export function createPingModel(ai: AI, model: string): GenerativeModel {
  return getGenerativeModel(ai, { mode: InferenceMode.ONLY_IN_CLOUD, inCloudParams: { model } });
}

export function createReporter(ai: AI, model: string = REPORTER_MODEL): GenerativeModel {
  return getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_IN_CLOUD,
    inCloudParams: {
      model,
      systemInstruction: REPORTER_SYSTEM,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: Schema.object({
          properties: {
            headline: Schema.string(),
            highlights: Schema.array({ items: Schema.string() }),
            warnings: Schema.array({ items: Schema.string() }),
          },
        }),
      },
    },
    onDeviceParams: onDevice(REPORTER_SYSTEM, reportJsonSchema),
  });
}

export function createAdvisor(ai: AI, withSearch: boolean, model: string = ADVISOR_MODEL): GenerativeModel {
  return getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: {
      model,
      systemInstruction: ADVISOR_SYSTEM,
      tools: withSearch
        ? [{ functionDeclarations: [spendingByCategoryDeclaration, splitDeclaration] }, { googleSearch: {} }]
        : [{ functionDeclarations: [spendingByCategoryDeclaration, splitDeclaration] }],
    },
  });
}

/** PREFER_ON_DEVICE, used only to confirm that `inferenceSource` is reported. */
export function createPreferOnDevice(ai: AI): GenerativeModel {
  return getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_ON_DEVICE,
    inCloudParams: { model: 'gemini-3.5-flash-lite' },
    onDeviceParams: {
      createOptions: { expectedInputs: TEXT_EN, expectedOutputs: TEXT_EN },
    },
  });
}
