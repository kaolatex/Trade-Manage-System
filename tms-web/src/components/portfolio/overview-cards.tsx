'use client';

import { useTrading } from '@/context/trading-context';
import { useLanguage } from '@/context/language-context';
import { Card } from '@/components/ui/card';
import { getAccountMetrics } from '@/lib/market';
import { fmtMoney, fmtPct } from '@/lib/utils';
import {
  Wallet,
  TrendingUp,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function OverviewCards() {
  const { state } = useTrading();
  const { t } = useLanguage();
  const viewMode = state.portfolioViewMode;
  const currentAccount = state.accounts[state.selectedAccountId] || state.accounts.all;
  const balance = currentAccount?.balance ?? 0;
  const server = currentAccount?.server || 'HFM Multi-Broker';
  const leverage = currentAccount?.leverage || 500;

  const filter = viewMode === 'manual' ? 'MANUAL' : viewMode === 'bot' ? 'BOT' : undefined;
  const metrics = getAccountMetrics(currentAccount, state.prices, filter);

  const isProfit = metrics.floating >= 0;

  const cards = [
    {
      title: t.overviewCards.balanceTitle,
      value: fmtMoney(balance),
      subtext: `${t.overviewCards.balanceSub} ${server}`,
      icon: Wallet,
      tone: 'neutral',
    },
    {
      title: t.overviewCards.equityTitle,
      value: fmtMoney(metrics.equity),
      subtext: `${t.overviewCards.equitySub} 1:${leverage}`,
      icon: TrendingUp,
      tone: isProfit ? 'profit' : 'loss',
      badge: isProfit ? `+${fmtMoney(metrics.floating)}` : fmtMoney(metrics.floating),
    },
    {
      title:
        viewMode === 'manual'
          ? 'Manual Floating P&L'
          : viewMode === 'bot'
            ? 'Bot Floating P&L'
            : t.overviewCards.floatingTitle,
      value: fmtMoney(metrics.floating, { sign: true }),
      subtext: `${fmtPct(metrics.floatingPct, true)} ${
        viewMode === 'manual'
          ? '(เฉพาะไม้กดมือ)'
          : viewMode === 'bot'
            ? '(เฉพาะไม้บอท)'
            : t.overviewCards.floatingSub
      }`,
      icon: isProfit ? ArrowUpRight : ArrowDownRight,
      tone: isProfit ? 'profit' : 'loss',
      isPnl: true,
      badge:
        viewMode === 'manual'
          ? '🖐️ MANUAL'
          : viewMode === 'bot'
            ? '🤖 BOT'
            : undefined,
    },
    {
      title: t.overviewCards.freeMarginTitle,
      value: fmtMoney(metrics.freeMargin),
      subtext:
        metrics.marginLevel !== null
          ? `${t.overviewCards.marginLevelSub} ${metrics.marginLevel.toFixed(0)}%`
          : t.overviewCards.noMargin,
      icon: Shield,
      tone: 'neutral',
      badge: metrics.marginLevel ? `${metrics.marginLevel.toFixed(0)}%` : t.common.safe,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card
            key={c.title}
            className="group relative overflow-hidden p-4 transition-all duration-300 hover:border-zinc-700 hover:shadow-lg hover:shadow-black/40"
          >
            {/* Top row */}
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                {c.title}
              </span>
              <div className="flex size-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-400 group-hover:text-zinc-200">
                <Icon className="size-3.5" />
              </div>
            </div>

            {/* Value */}
            <div className="mt-2.5 flex items-baseline gap-2">
              <div
                className={cn(
                  'num text-2xl font-bold tracking-tight',
                  c.isPnl
                    ? c.tone === 'profit'
                      ? 'text-profit'
                      : 'text-loss'
                    : 'text-zinc-50',
                )}
              >
                {c.value}
              </div>
              {c.badge && (
                <span
                  className={cn(
                    'num rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                    c.tone === 'profit'
                      ? 'bg-profit/10 text-profit ring-1 ring-profit/20'
                      : c.tone === 'loss'
                        ? 'bg-loss/10 text-loss ring-1 ring-loss/20'
                        : 'bg-zinc-800 text-zinc-400',
                  )}
                >
                  {c.badge}
                </span>
              )}
            </div>

            {/* Subtext */}
            <div className="mt-1 text-xs text-zinc-500">{c.subtext}</div>
          </Card>
        );
      })}
    </div>
  );
}
