import type { ReactNode } from 'react';
import type { Side } from '@/lib/types';
import { cn } from '@/lib/utils';

type BadgeTone = 'profit' | 'loss' | 'warn' | 'info' | 'neutral';

const TONES: Record<BadgeTone, string> = {
  profit: 'bg-profit/10 text-profit ring-profit/25',
  loss: 'bg-loss/10 text-loss ring-loss/25',
  warn: 'bg-warn/10 text-warn ring-warn/25',
  info: 'bg-sky-500/10 text-sky-400 ring-sky-500/25',
  neutral: 'bg-zinc-800/60 text-zinc-300 ring-zinc-700/60',
};

export function Badge({
  tone = 'neutral',
  mono,
  className,
  children,
}: {
  tone?: BadgeTone;
  mono?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset [&>svg]:size-3',
        mono && 'num',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SideBadge({ side }: { side: Side }) {
  return (
    <Badge tone={side === 'BUY' ? 'profit' : 'loss'} className="w-12 justify-center tracking-wider">
      {side}
    </Badge>
  );
}

export function StatusDot({
  active = true,
  tone = 'profit',
  className,
}: {
  active?: boolean;
  tone?: 'profit' | 'loss' | 'warn';
  className?: string;
}) {
  const color = { profit: 'bg-profit', loss: 'bg-loss', warn: 'bg-warn' }[tone];
  return (
    <span className={cn('relative flex size-2 shrink-0', className)}>
      {active && (
        <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-60', color)} />
      )}
      <span className={cn('relative inline-flex size-2 rounded-full', active ? color : 'bg-zinc-600')} />
    </span>
  );
}
