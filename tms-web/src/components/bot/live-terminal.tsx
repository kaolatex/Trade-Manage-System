'use client';

import { useEffect, useRef, useState } from 'react';
import { useTrading } from '@/context/trading-context';
import { useLanguage } from '@/context/language-context';
import { Card } from '@/components/ui/card';
import { Terminal, Trash2, Zap } from 'lucide-react';
import { fmtTime } from '@/lib/utils';
import { LogLevel } from '@/lib/types';
import { cn } from '@/lib/utils';

export function LiveTerminal() {
  const { state, clearLogs, simulateSignal, isSimulating } = useTrading();
  const { t } = useLanguage();
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [state.logs, autoScroll]);

  const levelStyles: Record<LogLevel, { tag: string; color: string; bg: string }> = {
    system: { tag: 'SYSTEM', color: 'text-zinc-400', bg: 'bg-zinc-800/60' },
    market: { tag: 'MARKET', color: 'text-sky-400', bg: 'bg-sky-500/10' },
    scanner: { tag: 'SCANNER', color: 'text-violet-400', bg: 'bg-violet-500/10' },
    signal: { tag: 'SIGNAL', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    exec: { tag: 'EXEC', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    risk: { tag: 'RISK', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    warn: { tag: 'WARN', color: 'text-amber-400', bg: 'bg-amber-500/15' },
    error: { tag: 'ERROR', color: 'text-rose-400', bg: 'bg-rose-500/15' },
    config: { tag: 'CONFIG', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  };

  return (
    <Card className="flex flex-col overflow-hidden border-zinc-800 bg-[#060608] p-0 shadow-2xl">
      {/* Terminal Title Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-800/80 bg-zinc-950/90 px-4 py-2.5">
        <div className="flex items-center gap-3">
          {/* macOS window indicator dots */}
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-rose-500/80" />
            <span className="size-2.5 rounded-full bg-amber-500/80" />
            <span className="size-2.5 rounded-full bg-emerald-500/80" />
          </div>

          <div className="flex items-center gap-2">
            <Terminal className="size-3.5 text-zinc-500" />
            <span className="text-xs font-semibold tracking-wider text-zinc-300">
              {t.liveTerminal.title}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Simulate Signal Button */}
          <button
            type="button"
            onClick={simulateSignal}
            disabled={isSimulating}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300 transition-all hover:bg-amber-500/20 active:scale-95 disabled:opacity-50',
              isSimulating && 'animate-pulse',
            )}
          >
            <Zap className="size-3 text-amber-400" />
            <span>
              {isSimulating ? t.liveTerminal.simulatingBtn : t.liveTerminal.simulateBtn}
            </span>
          </button>

          {/* Auto scroll toggle */}
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={cn(
              'rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors',
              autoScroll
                ? 'border-zinc-700 bg-zinc-800 text-zinc-200'
                : 'border-zinc-800 bg-zinc-950 text-zinc-500',
            )}
            title={t.liveTerminal.autoScroll}
          >
            {t.liveTerminal.autoScroll}
          </button>

          {/* Clear Button */}
          <button
            type="button"
            onClick={clearLogs}
            className="flex size-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            title={t.liveTerminal.clearConsole}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Log Output Window */}
      <div
        ref={logContainerRef}
        className="h-80 w-full overflow-y-auto p-4 font-mono text-xs leading-relaxed selection:bg-zinc-800"
      >
        <div className="space-y-1">
          {state.logs.map((log) => {
            const meta = levelStyles[log.level] || levelStyles.system;
            return (
              <div
                key={log.id}
                className="group flex items-start gap-2 rounded px-1.5 py-0.5 transition-colors hover:bg-zinc-900/50"
              >
                {/* Timestamp */}
                <span className="num shrink-0 text-zinc-600 select-none">
                  [{fmtTime(log.ts)}]
                </span>

                {/* Tag */}
                <span
                  className={cn(
                    'num shrink-0 rounded px-1.5 py-0.2 text-[10px] font-bold tracking-wider select-none',
                    meta.color,
                    meta.bg,
                  )}
                >
                  [{meta.tag}]
                </span>

                {/* Message */}
                <span
                  className={cn(
                    'flex-1 break-words font-mono text-[11px]',
                    log.level === 'warn'
                      ? 'text-amber-300'
                      : log.level === 'error'
                        ? 'text-rose-400 font-semibold'
                        : log.level === 'exec'
                          ? 'text-emerald-300 font-medium'
                          : log.level === 'signal'
                            ? 'text-amber-200'
                            : 'text-zinc-300',
                  )}
                >
                  {log.message}
                </span>
              </div>
            );
          })}
        </div>

        {/* Blinking Cursor at Bottom */}
        <div className="mt-2 flex items-center gap-2 text-zinc-600 text-xs px-1.5">
          <span>&gt;</span>
          <span className="size-2 rounded-sm bg-profit/80 animate-blink" />
        </div>
      </div>
    </Card>
  );
}
