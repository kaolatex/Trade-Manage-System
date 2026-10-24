'use client';

import { useTrading } from '@/context/trading-context';
import { X, CheckCircle2, AlertTriangle, AlertOctagon, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ToastViewport() {
  const { toasts, dismissToast } = useTrading();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 flex max-w-sm flex-col gap-2 md:bottom-6 md:right-6">
      {toasts.map((t) => {
        const Icon =
          t.tone === 'profit'
            ? CheckCircle2
            : t.tone === 'loss'
              ? AlertOctagon
              : t.tone === 'warn'
                ? AlertTriangle
                : Info;

        const border =
          t.tone === 'profit'
            ? 'border-profit/40'
            : t.tone === 'loss'
              ? 'border-loss/40'
              : t.tone === 'warn'
                ? 'border-warn/40'
                : 'border-sky-500/40';

        const iconColor =
          t.tone === 'profit'
            ? 'text-profit'
            : t.tone === 'loss'
              ? 'text-loss'
              : t.tone === 'warn'
                ? 'text-warn'
                : 'text-sky-400';

        return (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-3 rounded-xl border bg-surface/95 p-3.5 shadow-2xl backdrop-blur-md animate-slide-up',
              border,
            )}
          >
            <Icon className={cn('size-5 shrink-0 mt-0.5', iconColor)} />
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-semibold text-zinc-100">{t.title}</h4>
              {t.description && (
                <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">
                  {t.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
