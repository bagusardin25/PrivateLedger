// How each kind of ledger entry is shown, shared by the Data Boundary panel and
// the Privacy Ledger screen: emerald stays on the device, indigo went to the cloud,
// rose was blocked, amber was refused before sending.

import { Ban, CircleSlash, Cloud, Cpu, type LucideIcon } from 'lucide-react';
import type { LedgerSource } from '../lib/data/db';

export const SOURCE_META: Record<
  LedgerSource,
  {
    text: string;
    icon: LucideIcon;
    className: string;
    tone: 'device' | 'cloud' | 'danger' | 'review';
    dot: string;
    iconBg: string;
  }
> = {
  on_device: {
    text: 'On this device',
    icon: Cpu,
    className: 'text-emerald-700 dark:text-emerald-400',
    tone: 'device',
    dot: 'bg-emerald-600 dark:bg-emerald-400',
    iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  },
  in_cloud: {
    text: 'Sent to cloud',
    icon: Cloud,
    className: 'text-indigo-700 dark:text-indigo-400',
    tone: 'cloud',
    dot: 'bg-indigo-600 dark:bg-indigo-400',
    iconBg: 'bg-indigo-50 text-indigo-700 border-indigo-200/70 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20',
  },
  blocked: {
    text: 'Blocked on device',
    icon: Ban,
    className: 'text-rose-700 dark:text-rose-400',
    tone: 'danger',
    dot: 'bg-rose-600 dark:bg-rose-400',
    iconBg: 'bg-rose-50 text-rose-700 border-rose-200/70 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
  },
  refused: {
    text: 'Not sent',
    icon: CircleSlash,
    className: 'text-amber-800 dark:text-amber-400',
    tone: 'review',
    dot: 'bg-amber-500 dark:bg-amber-400',
    iconBg: 'bg-amber-50 text-amber-800 border-amber-200/70 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  },
};
