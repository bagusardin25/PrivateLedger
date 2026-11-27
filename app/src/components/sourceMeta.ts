// How each kind of ledger entry is shown, shared by the Data Boundary panel and
// the Privacy Ledger screen: green stays on the device, blue went to the cloud,
// red was blocked, amber was refused before sending.

import { Ban, CircleSlash, Cloud, Cpu, type LucideIcon } from 'lucide-react';
import type { LedgerSource } from '../lib/data/db';

export const SOURCE_META: Record<
  LedgerSource,
  {
    text: string;
    icon: LucideIcon;
    className: string;
    tone: 'device' | 'cloud' | 'danger' | 'review';
    accentBar: string;
    iconBg: string;
  }
> = {
  on_device: {
    text: 'On this device',
    icon: Cpu,
    className: 'text-emerald-700',
    tone: 'device',
    accentBar: 'bg-emerald-500',
    iconBg: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
  },
  in_cloud: {
    text: 'Sent to cloud',
    icon: Cloud,
    className: 'text-sky-700',
    tone: 'cloud',
    accentBar: 'bg-sky-500',
    iconBg: 'bg-sky-50 text-sky-700 ring-sky-200/80',
  },
  blocked: {
    text: 'Blocked on device',
    icon: Ban,
    className: 'text-rose-700',
    tone: 'danger',
    accentBar: 'bg-rose-500',
    iconBg: 'bg-rose-50 text-rose-700 ring-rose-200/80',
  },
  refused: {
    text: 'Not sent',
    icon: CircleSlash,
    className: 'text-amber-700',
    tone: 'review',
    accentBar: 'bg-amber-500',
    iconBg: 'bg-amber-50 text-amber-700 ring-amber-200/80',
  },
};
