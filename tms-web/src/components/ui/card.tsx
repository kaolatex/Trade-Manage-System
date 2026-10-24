import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-zinc-800/80 bg-surface', className)}
      {...props}
    />
  );
}

interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, icon, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 px-5 pt-5', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/70 text-zinc-400 [&>svg]:size-4">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-tight text-zinc-100">{title}</h2>
          {subtitle && <p className="mt-0.5 truncate text-xs text-zinc-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function SectionLabel({
  title,
  icon,
  hint,
}: {
  title: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 [&>svg]:size-3.5">
        {icon}
        {title}
      </h3>
      {hint && <span className="text-[11px] text-zinc-600">{hint}</span>}
    </div>
  );
}
