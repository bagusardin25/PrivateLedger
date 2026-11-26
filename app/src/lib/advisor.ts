// Advisor: multi-turn chat in the cloud with function calling. The cloud model
// can only reach the user's data by calling LOCAL_FUNCTIONS, which run on this
// device and return totals. Every request is logged with what it carried.

import type { Content, EnhancedGenerateContentResponse, FunctionCall, Part } from 'firebase/ai';
import { cloudRequest } from './cloudCall';
import { db } from './db';
import { FEATURE } from './ledger';
import { runLocalFunction } from './localFunctions';
import { getAdvisorModel } from './models';
import { CLOUD_TIMEOUT_MS } from './withTimeout';

export interface CallTrace {
  name: string;
  args: Record<string, unknown>;
  result: object;
}

/** The conversation so far. It only moves forward when a request succeeds. */
export interface AdvisorSession {
  history: Content[];
}

const MAX_ROUNDS = 4;
const CONTEXT_NOTE = '(The request also carries earlier turns of this chat, the system instruction, and the function definitions.)';

export function newAdvisorSession(): AdvisorSession {
  return { history: [] };
}

async function isDemoData(): Promise<boolean> {
  const all = await db.transactions.toArray();
  return all.length > 0 && all.every((t) => t.isDemo);
}

async function send(session: AdvisorSession, content: string | Part[], preview: string, isDemo: boolean): Promise<EnhancedGenerateContentResponse> {
  const bytes = new TextEncoder().encode(typeof content === 'string' ? content : JSON.stringify(content)).length;
  const { response, history } = await cloudRequest(
    {
      feature: FEATURE.advisor,
      mode: 'ONLY_IN_CLOUD',
      payloadPreview: `${preview}\n${CONTEXT_NOTE}`,
      bytes,
      rawRowCount: 0,
      merchantNameCount: 0,
      consent: false,
      isDemo,
    },
    async () => {
      // A failed sendMessage leaves the SDK's ChatSession rejected for good, so
      // every attempt gets a fresh ChatSession built from the last good history.
      const chat = getAdvisorModel().startChat({ history: session.history });
      const result = await chat.sendMessage(content, { timeout: CLOUD_TIMEOUT_MS });
      return { response: result.response, history: await chat.getHistory() };
    },
    'The cloud advisor',
  );
  session.history = history;
  return response;
}

/**
 * Sends one user message (already cleared by the outgoing-message guard), runs
 * any function calls on this device, and returns the final answer.
 */
export async function askAdvisor(session: AdvisorSession, message: string, onCall: (trace: CallTrace) => void): Promise<string> {
  const isDemo = await isDemoData();
  const before = session.history;
  try {
    let response = await send(session, message, `User message: "${message}"`, isDemo);

    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const calls: FunctionCall[] = response.functionCalls() ?? [];
      if (calls.length === 0) return response.text().trim();

      const parts: Part[] = [];
      const sent: Record<string, object> = {};
      for (const call of calls) {
        const args = (call.args ?? {}) as Record<string, unknown>;
        const result = await runLocalFunction(call.name, args);
        onCall({ name: call.name, args, result });
        sent[call.name] = result;
        parts.push({ type: 'functionResponse', functionResponse: { id: call.id, name: call.name, response: result } });
      }
      response = await send(session, parts, `Function results computed on this device:\n${JSON.stringify(sent, null, 2)}`, isDemo);
    }

    if ((response.functionCalls() ?? []).length > 0) {
      // Still asking for functions: drop the unfinished turn so the next message starts clean.
      session.history = before;
      return 'I could not finish that answer. Try asking in a simpler way.';
    }
    return response.text().trim();
  } catch (error) {
    // A turn that failed halfway would leave a function call without its
    // response in the history, and the API rejects every message after that.
    session.history = before;
    throw error;
  }
}
