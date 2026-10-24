'use client';

import { cn } from '@/lib/utils';

interface SwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  tone?: 'profit' | 'warn' | 'loss';
  size?: 'sm' | 'md';
  disabled?: boolean;
  id?: string;
  label?: string;
}

export function Switch({ checked, onChange, tone = 'profit', size = 'md', disabled, id, label }: SwitchProps) {
  const on = { profit: 'bg-profit', warn: 'bg-warn', loss: 'bg-loss' }[tone];
  const d =
    size === 'sm'
      ? { track: 'h-5 w-9', knob: 'size-4', tx: 'translate-x-4' }
      : { track: 'h-6 w-11', knob: 'size-5', tx: 'translate-x-5' };

  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors duration-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink',
        'disabled:opacity-40',
        d.track,
        checked ? on : 'bg-zinc-700/70',
      )}
    >
      <span
        className={cn(
          'rounded-full bg-white shadow-sm transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)]',
          d.knob,
          checked ? d.tx : 'translate-x-0',
        )}
      />
    </button>
  );
}
