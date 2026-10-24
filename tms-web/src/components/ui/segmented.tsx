'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  id?: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  stretch?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  stretch,
  className,
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex gap-0.5 rounded-lg border border-zinc-800 bg-zinc-900/60 p-0.5',
        stretch && 'flex w-full',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            id={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-all duration-200 [&>svg]:size-3.5',
              size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
              stretch && 'flex-1',
              active
                ? 'bg-zinc-800 text-zinc-50 shadow-sm ring-1 ring-zinc-700/60'
                : 'text-zinc-500 hover:text-zinc-200',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
