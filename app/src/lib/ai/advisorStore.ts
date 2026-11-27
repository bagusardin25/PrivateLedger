// Chat state lives outside the view, so leaving the Advisor screen and coming
// back keeps the conversation.

import { askAdvisor, newAdvisorSession } from './advisor';
import { friendlyCloudError } from './cloudCall';
import { describeCall } from './localFunctions';
import { checkOutgoingMessage } from './guard';
import { createStore } from '../util/store';

export type ChatItem =
  | { id: number; kind: 'user'; text: string; status: 'checking' | 'sent' | 'blocked' }
  | { id: number; kind: 'blocked'; reasons: string[] }
  | { id: number; kind: 'call'; label: string; result: object }
  | { id: number; kind: 'assistant'; text: string }
  | { id: number; kind: 'error'; text: string };

export interface AdvisorState {
  items: ChatItem[];
  busy: false | 'checking' | 'asking';
}

export const advisorStore = createStore<AdvisorState>({ items: [], busy: false });

let session = newAdvisorSession();
let nextId = 1;

type NewItem = ChatItem extends unknown ? (ChatItem extends infer T ? (T extends ChatItem ? Omit<T, 'id'> : never) : never) : never;

function push(item: NewItem): number {
  const id = nextId++;
  advisorStore.set({ items: [...advisorStore.get().items, { ...item, id } as ChatItem] });
  return id;
}

function updateUser(id: number, status: 'sent' | 'blocked') {
  advisorStore.set({ items: advisorStore.get().items.map((i) => (i.id === id && i.kind === 'user' ? { ...i, status } : i)) });
}

export async function sendToAdvisor(text: string): Promise<void> {
  const message = text.trim();
  if (!message || advisorStore.get().busy) return;

  const userId = push({ kind: 'user', text: message, status: 'checking' });
  advisorStore.set({ busy: 'checking' });
  try {
    const guard = await checkOutgoingMessage(message);
    if (!guard.allowed) {
      updateUser(userId, 'blocked');
      push({ kind: 'blocked', reasons: guard.reasons });
      return;
    }
    updateUser(userId, 'sent');
    advisorStore.set({ busy: 'asking' });
    const answer = await askAdvisor(session, message, (trace) => push({ kind: 'call', label: describeCall(trace.name, trace.args), result: trace.result }));
    push({ kind: 'assistant', text: answer || 'No answer came back.' });
  } catch (error) {
    push({ kind: 'error', text: friendlyCloudError(error, 'The cloud advisor') });
  } finally {
    advisorStore.set({ busy: false });
  }
}

export function resetAdvisor(): void {
  session = newAdvisorSession();
  advisorStore.set({ items: [], busy: false });
}
