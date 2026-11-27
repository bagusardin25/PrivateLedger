// How each kind of ledger entry is shown, shared by the Data Boundary panel and
// the Privacy Ledger screen: jade stays on the device, indigo went to the cloud,
// crimson was blocked, champagne-amber was refused before sending.

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
    className: 'text-teal-700 dark:text-teal-400',
    tone: 'device',
    accentBar: 'bg-teal-600 dark:bg-teal-400',
    iconBg: 'bg-teal-50 text-teal-800 ring-teal-200/85 dark:bg-teal-950/70 dark:text-teal-300 dark:ring-teal-700/60',
  },
  in_cloud: {
    text: 'Sent to cloud',
    icon: Cloud,
    className: 'text-indigo-700 dark:text-indigo-400',
    tone: 'cloud',
    accentBar: 'bg-indigo-600 dark:bg-indigo-400',
    iconBg: 'bg-indigo-50 text-indigo-800 ring-indigo-200/85 dark:bg-indigo-950/70 dark:text-indigo-300 dark:ring-indigo-700/60',
  },
  blocked: {
    text: 'Blocked on device',
    icon: Ban,
    className: 'text-rose-700 dark:text-rose-400',
    tone: 'danger',
    accentBar: 'bg-rose-600 dark:bg-rose-400',
    iconBg: 'bg-rose-50 text-rose-800 ring-rose-200/85 dark:bg-rose-950/70 dark:text-rose-300 dark:ring-rose-700/60',
  },
  refused: {
    text: 'Not sent',
    icon: CircleSlash,
    className: 'text-amber-800 dark:text-amber-400',
    tone: 'review',
    accentBar: 'bg-amber-500 dark:bg-amber-400',
    iconBg: 'bg-amber-50 text-amber-800 ring-amber-200/85 dark:bg-amber-950/70 dark:text-amber-300 dark:ring-amber-700/60',
  },
};
