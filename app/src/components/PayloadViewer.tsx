// Lightweight zero-dependency syntax-highlighted terminal viewer for cloud payloads,
// local function responses, and on-device ledger previews.

import { Terminal } from 'lucide-react';
import type { ReactNode } from 'react';
import { CopyButton } from './ui';

type Accent = 'cloud' | 'device' | 'danger' | 'neutral';

const DOT: Record<Accent, string> = {
  cloud: 'text-indigo-400',
  device: 'text-teal-400',
  danger: 'text-rose-400',
  neutral: 'text-zinc-400',
};

const JSON_TOKEN = /("(?:\\.|[^"\\])*"(?=\s*:))|("(?:\\.|[^"\\])*")|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

function highlightLine(line: string, lineIndex: number): ReactNode {
  const headerMatch = /^([A-Za-z][A-Za-z0-9 /_-]{1,36}:)(\s.*)$/.exec(line);
  if (headerMatch && !line.trimStart().startsWith('"')) {
    return (
      <span key={lineIndex}>
        <span className="font-semibold text-indigo-300">{headerMatch[1]}</span>
        <span className="text-zinc-200">{headerMatch[2]}</span>
      </span>
    );
  }

  const parts: ReactNode[] = [];
  let cursor = 0;
  JSON_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  let k = 0;

  while ((match = JSON_TOKEN.exec(line)) !== null) {
    if (match.index > cursor) {
      parts.push(
        <span key={`${lineIndex}-${k++}`} className="text-zinc-400">
          {line.slice(cursor, match.index)}
        </span>,
      );
    }
    const [full, key, str, boolNull, num] = match;
    if (key) {
      parts.push(
        <span key={`${lineIndex}-${k++}`} className="text-indigo-300">
          {key}
        </span>,
      );
    } else if (str) {
      parts.push(
        <span key={`${lineIndex}-${k++}`} className="text-teal-300">
          {str}
        </span>,
      );
    } else if (boolNull) {
      parts.push(
        <span key={`${lineIndex}-${k++}`} className="text-violet-300">
          {boolNull}
        </span>,
      );
    } else if (num) {
      parts.push(
        <span key={`${lineIndex}-${k++}`} className="text-amber-300">
          {num}
        </span>,
      );
    } else {
      parts.push(full);
    }
    cursor = match.index + full.length;
  }

  if (cursor < line.length) {
    parts.push(
      <span key={`${lineIndex}-tail`} className={parts.length > 0 ? 'text-zinc-400' : 'text-zinc-200'}>
        {line.slice(cursor)}
      </span>,
    );
  }

  return parts.length > 0 ? parts : line;
}

export function PayloadViewer({
  title,
  content,
  emptyText = 'Nothing has left this device yet.',
  accent = 'cloud',
  maxHeightClass = 'max-h-56',
  showCopy = true,
  className = '',
}: {
  title: string;
  content?: string;
  emptyText?: string;
  accent?: Accent;
  maxHeightClass?: string;
  showCopy?: boolean;
  className?: string;
}) {
  const hasContent = Boolean(content && content.trim().length > 0);
  const lines = hasContent ? content!.split('\n') : [];

  return (
    <div className={`overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b0c14] shadow-inner ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] bg-[#141624] px-3 py-1.5 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
          <Terminal aria-hidden className={`size-3 shrink-0 ${DOT[accent]}`} />
          <span className="truncate">{title}</span>
        </span>
        {showCopy && hasContent && <CopyButton text={content!} label="Copy" dark />}
      </div>
      <pre className={`code-inspector ${maxHeightClass} overflow-auto p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap`}>
        {hasContent ? (
          lines.map((line, i) => (
            <span key={i} className="block">
              {highlightLine(line, i)}
              {line === '' ? '\u00A0' : null}
            </span>
          ))
        ) : (
          <span className="text-zinc-400/90">{emptyText}</span>
        )}
      </pre>
    </div>
  );
}
