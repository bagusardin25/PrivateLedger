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
    text: 'On your laptop',
    icon: Cpu,
    className: 'text-device-fg',
    tone: 'device',
    dot: 'bg-device',
    iconBg: 'bg-device-soft text-device-fg border-device-line',
  },
  in_cloud: {
    text: 'Sent to the cloud',
    icon: Cloud,
    className: 'text-cloud-fg',
    tone: 'cloud',
    dot: 'bg-cloud',
    iconBg: 'bg-cloud-soft text-cloud-fg border-cloud-line',
  },
  blocked: {
    text: 'Stopped on your laptop',
    icon: Ban,
    className: 'text-danger-fg',
    tone: 'danger',
    dot: 'bg-danger',
    iconBg: 'bg-danger-soft text-danger-fg border-danger-line',
  },
  refused: {
    text: 'Not sent',
    icon: CircleSlash,
    className: 'text-review-fg',
    tone: 'review',
    dot: 'bg-review',
    iconBg: 'bg-review-soft text-review-fg border-review-line',
  },
};
