'use client';

import type { ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from './switch';

export function Field({
  label,
  hint,
  htmlFor,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-zinc-400">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-zinc-500">{hint}</p>}
    </div>
  );
}

export function NumberInput({
  id,
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
  className,
}: {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-10 items-center rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 transition-colors',
        'hover:border-zinc-700 focus-within:border-zinc-500 focus-within:ring-2 focus-within:ring-zinc-500/15',
        className,
      )}
    >
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => {
          const v = e.target.valueAsNumber;
          onChange(Number.isNaN(v) ? 0 : v);
        }}
        className="num w-full min-w-0 bg-transparent text-sm text-zinc-100 outline-none"
      />
      {suffix && <span className="ml-2 shrink-0 text-xs text-zinc-500">{suffix}</span>}
    </div>
  );
}

export function Stepper({
  id,
  value,
  onChange,
  min = 1,
  max = 10,
  suffix,
}: {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const btn =
    'flex h-full w-10 items-center justify-center text-zinc-400 transition-colors hover:text-zinc-100 disabled:opacity-30';
  return (
    <div className="flex h-10 items-center rounded-lg border border-zinc-800 bg-zinc-950/60">
      <button type="button" aria-label="Decrease" className={btn} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus className="size-4" />
      </button>
      <div id={id} className="flex-1 text-center text-sm text-zinc-100">
        <span className="num">{value}</span> {suffix && <span className="text-xs text-zinc-500">{suffix}</span>}
      </div>
      <button type="button" aria-label="Increase" className={btn} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}

export function ToggleRow({
  id,
  title,
  description,
  checked,
  onChange,
  tone,
  badge,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  tone?: 'profit' | 'warn' | 'loss';
  badge?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-lg border px-4 py-3 transition-colors duration-200',
        checked ? 'border-zinc-700/80 bg-zinc-900/50' : 'border-zinc-800/80 bg-zinc-950/40 hover:border-zinc-700/70',
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={id} className={cn('text-sm font-medium', checked ? 'text-zinc-100' : 'text-zinc-400')}>
            {title}
          </label>
          {badge}
        </div>
        {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onChange={onChange} tone={tone} label={title} />
    </div>
  );
}
