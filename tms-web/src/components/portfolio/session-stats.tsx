'use client';

import { useMemo } from 'react';
import { useTrading } from '@/context/trading-context';
import { useLanguage } from '@/context/language-context';
import { Card, CardHeader } from '@/components/ui/card';
import { BarChart3, Sun, Moon, Globe } from 'lucide-react';
import { SESSION_MAP, activeSessions } from '@/lib/engine';
import { fmtMoney } from '@/lib/utils';
import { computeJournalStats } from '@/lib/market';
import { cn } from '@/lib/utils';

export function SessionStats() {
  const { state } = useTrading();
  const { t } = useLanguage();
  const viewMode = state.portfolioViewMode;
  const currentAccount = state.accounts[state.selectedAccountId];

  const filteredJournal = useMemo(() => {
    if (viewMode === 'manual') {
      return currentAccount.journal.filter((j) => j.execution_type === 'MANUAL');
    }
    if (viewMode === 'bot') {
      return currentAccount.journal.filter((j) => j.execution_type === 'BOT');
    }
    return currentAccount.journal;
  }, [viewMode, currentAccount.journal]);

  const { stats, sessions } = useMemo(() => {
    return computeJournalStats(filteredJournal);
  }, [filteredJournal]);

  const activeNow = activeSessions();

  const sessionIcons = {
    asian: Moon,
    london: Globe,
    newYork: Sun,
  };

  const statItems = [
    { label: t.sessionStats.winRate, value: `${stats.winRate}%`, tone: 'profit' },
    { label: t.sessionStats.profitFactor, value: stats.profitFactor.toFixed(2), tone: 'profit' },
    { label: t.sessionStats.avgRR, value: `1 : ${stats.avgRR}`, tone: 'neutral' },
    { label: t.sessionStats.maxDrawdown, value: `${stats.maxDrawdown}%`, tone: 'loss' },
  ];

  const totalPositivePnl = sessions.reduce((acc, s) => acc + Math.max(0, s.pnl), 0) || 1;

  const headerTitle =
    viewMode === 'manual'
      ? 'Manual Edge & Session Stats'
      : viewMode === 'bot'
        ? 'Bot Algorithm & Session Stats'
        : t.sessionStats.title;

  const headerSubtitle =
    viewMode === 'manual'
      ? `คำนวณจาก ${stats.totalTrades} ไม้ที่กดมือเอง (วัดวินัยช่วง London/NY)`
      : viewMode === 'bot'
        ? `คำนวณจาก ${stats.totalTrades} ไม้ที่บอทยิงคำสั่ง (วัดประสิทธิภาพระบบ)`
        : `${stats.totalTrades} ${t.sessionStats.subtitle}`;

  return (
    <Card className="flex flex-col justify-between p-0">
      <div>
        <CardHeader
          title={headerTitle}
          subtitle={headerSubtitle}
          icon={<BarChart3 />}
          action={
            <span
              className={cn(
                'num rounded-full px-2 py-0.5 text-[10px] font-bold border',
                viewMode === 'manual'
                  ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                  : viewMode === 'bot'
                    ? 'border-violet-500/30 bg-violet-500/10 text-violet-300'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
              )}
            >
              {viewMode === 'manual' ? 'MANUAL STATS' : viewMode === 'bot' ? 'BOT STATS' : 'COMBINED STATS'}
            </span>
          }
        />

        {/* 4 Stat Badges Grid */}
        <div className="grid grid-cols-2 gap-2.5 p-5 pb-3">
          {statItems.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-2.5 transition-colors hover:border-zinc-700"
            >
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 truncate" title={item.label}>
                {item.label}
              </div>
              <div
                className={cn(
                  'num mt-1 text-base font-bold',
                  item.tone === 'profit'
                    ? 'text-profit'
                    : item.tone === 'loss'
                      ? 'text-loss'
                      : 'text-zinc-100',
                )}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Session Profit Breakdown */}
      <div className="border-t border-zinc-800/80 px-5 py-4">
        <div className="mb-3 flex items-center justify-between text-xs text-zinc-400">
          <span className="font-semibold text-zinc-300">{t.sessionStats.sessionProfitability}</span>
          <span className="text-[10px] text-zinc-500">{t.sessionStats.netPnlWinRate}</span>
        </div>

        <div className="space-y-3">
          {sessions.map((s) => {
            const def = SESSION_MAP[s.key];
            const Icon = sessionIcons[s.key];
            const isRunningNow = activeNow.includes(s.key);
            const pctShare = Math.max(8, Math.min(100, (Math.max(0, s.pnl) / totalPositivePnl) * 100));

            return (
              <div key={s.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Icon className="size-3 text-zinc-400" />
                    <span className="font-medium text-zinc-300">{def.short}</span>
                    {isRunningNow && (
                      <span className="rounded bg-emerald-500/10 px-1 py-0.2 text-[9px] font-semibold text-emerald-400">
                        {t.common.live}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="num text-[11px] text-zinc-500">
                      {s.trades} {t.common.trades} · WR {s.winRate}%
                    </span>
                    <span
                      className={cn(
                        'num font-medium',
                        s.pnl >= 0 ? 'text-profit' : 'text-loss',
                      )}
                    >
                      {fmtMoney(s.pnl, { sign: true })}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      s.pnl >= 0 ? 'bg-profit' : 'bg-loss',
                    )}
                    style={{ width: `${pctShare}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
