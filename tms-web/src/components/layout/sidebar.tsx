'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTrading } from '@/context/trading-context';
import { useLanguage } from '@/context/language-context';
import {
  LayoutDashboard,
  Cpu,
} from 'lucide-react';
import { StatusDot } from '@/components/ui/badge';
import { TmsLogo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';
import { fmtPrice } from '@/lib/market';

export function Sidebar() {
  const pathname = usePathname();
  const { state } = useTrading();
  const { t, language } = useLanguage();

  const navItems = [
    {
      name: t.nav.portfolio,
      href: '/',
      icon: LayoutDashboard,
      active: pathname === '/',
    },
    {
      name: t.nav.botSystem,
      href: '/bot-system',
      icon: Cpu,
      active: pathname === '/bot-system',
      badge: state.botRunning
        ? language === 'th'
          ? 'ทำงาน'
          : 'RUNNING'
        : language === 'th'
          ? 'หยุดชั่วคราว'
          : 'PAUSED',
      badgeTone: state.botRunning ? 'profit' : 'warn',
    },
  ];

  return (
    <aside className="sticky top-14 z-30 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 self-start flex-col justify-between border-r border-zinc-800/80 bg-ink px-3 py-4 overflow-y-auto md:flex">
      {/* Navigation Links */}
      <div className="space-y-6">
        <div>
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {t.nav.navigationSection}
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-all duration-200',
                    item.active
                      ? 'border border-zinc-800/90 bg-surface text-zinc-100 shadow-sm'
                      : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={cn(
                        'size-4 transition-colors',
                        item.active
                          ? 'text-emerald-400'
                          : 'text-zinc-500 group-hover:text-zinc-300',
                      )}
                    />
                    <span>{item.name}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                        item.badgeTone === 'profit'
                          ? 'bg-profit/15 text-profit'
                          : 'bg-warn/15 text-warn',
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Live Market Feeds Card */}
        <div className="rounded-xl border border-zinc-800/80 bg-surface/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              {t.nav.liveFeedSection}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-zinc-500">
              <StatusDot active={true} tone="profit" /> {t.common.active}
            </span>
          </div>

          <div className="space-y-2">
            {(['XAUUSD', 'EURUSD', 'GBPUSD'] as const).map((sym) => {
              const p = state.prices[sym];
              const prev = state.prevPrices[sym];
              const isUp = p >= prev;
              return (
                <div
                  key={sym}
                  className="flex items-center justify-between rounded-lg bg-zinc-950/50 px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-200">{sym}</span>
                    {sym === state.config.symbol && (
                      <span className="rounded bg-zinc-800 px-1 py-0.2 text-[9px] text-zinc-400">
                        {t.nav.target}
                      </span>
                    )}
                  </div>
                  <div
                    className={cn(
                      'num text-xs font-medium transition-colors',
                      isUp ? 'text-profit' : 'text-loss',
                    )}
                  >
                    {fmtPrice(p, sym)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bot State Pill with Logo & Engine Version Footer */}
      <div className="space-y-3">
        <div className="rounded-xl border border-zinc-800/80 bg-surface p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TmsLogo variant="mark" size="xs" />
              <span className="text-xs font-semibold text-zinc-300">{t.nav.engineTitle}</span>
            </div>
            <span
              className={cn(
                'num rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
                state.botMode === 'demo'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
              )}
            >
              {state.botMode}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            {state.botRunning
              ? `${t.nav.engineRunningDesc} (${state.config.symbol} ${state.config.timeframe})`
              : t.nav.enginePausedDesc}
          </p>
        </div>

        <div className="px-1 text-[10px] text-zinc-600 flex justify-between">
          <span>{t.nav.footerVersion}</span>
          <span>{t.nav.footerTheme}</span>
        </div>
      </div>
    </aside>
  );
}
