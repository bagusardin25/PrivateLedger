// How each kind of ledger entry is shown, shared by the Data Boundary panel and
// the Privacy Ledger screen: green stays on the device, blue went to the cloud,
// red was blocked, amber was refused before sending.

import { Ban, CircleSlash, Cloud, Cpu, type LucideIcon } from 'lucide-react';
import type { LedgerSource } from '../lib/db';

export const SOURCE_META: Record<LedgerSource, { text: string; icon: LucideIcon; className: string; tone: 'device' | 'cloud' | 'danger' | 'review' }> = {
  on_device: { text: 'On this device', icon: Cpu, className: 'text-emerald-700', tone: 'device' },
  in_cloud: { text: 'Sent to cloud', icon: Cloud, className: 'text-sky-700', tone: 'cloud' },
  blocked: { text: 'Blocked on device', icon: Ban, className: 'text-rose-700', tone: 'danger' },
  refused: { text: 'Not sent', icon: CircleSlash, className: 'text-amber-700', tone: 'review' },
};
