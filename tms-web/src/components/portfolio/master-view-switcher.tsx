'use client';

import { useTrading } from '@/context/trading-context';
import { useLanguage } from '@/context/language-context';
import { PortfolioViewMode } from '@/lib/types';
import { cn } from '@/lib/utils';
import { UserCheck, Bot, Globe, Shield } from 'lucide-react';

export function MasterViewSwitcher() {
  const { state, setPortfolioViewMode } = useTrading();
  const { t } = useLanguage();
  const currentMode = state.portfolioViewMode;
  const currentAccount = state.accounts[state.selectedAccountId] || state.accounts.all;
  const journal = currentAccount?.journal || [];

  const manualCount = journal.filter((j) => j.execution_type === 'MANUAL').length;
  const botCount = journal.filter((j) => j.execution_type === 'BOT').length;
  const totalCount = journal.length;

  const views: Array<{
    id: PortfolioViewMode;
    label: string;
    sublabel: string;
    icon: typeof UserCheck;
    count: number;
    activeBorder: string;
    activeGlow: string;
    activeBg: string;
    textColor: string;
    tagTone: string;
  }> = [
    {
      id: 'manual',
      label: t.viewSwitcher.manual,
      sublabel: t.viewSwitcher.manualDesc,
      icon: UserCheck,
      count: manualCount,
      activeBorder: 'border-cyan-500/60',
      activeGlow: 'shadow-cyan-500/10 shadow-lg',
      activeBg: 'bg-cyan-500/10',
      textColor: 'text-cyan-400',
      tagTone: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    },
    {
      id: 'bot',
      label: t.viewSwitcher.bot,
      sublabel: t.viewSwitcher.botDesc,
      icon: Bot,
      count: botCount,
      activeBorder: 'border-violet-500/60',
      activeGlow: 'shadow-violet-500/10 shadow-lg',
      activeBg: 'bg-violet-500/10',
      textColor: 'text-violet-400',
      tagTone: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    },
    {
      id: 'combined',
      label: t.viewSwitcher.combined,
      sublabel: t.viewSwitcher.combinedDesc,
      icon: Globe,
      count: totalCount,
      activeBorder: 'border-emerald-500/60',
      activeGlow: 'shadow-emerald-500/10 shadow-lg',
      activeBg: 'bg-emerald-500/10',
      textColor: 'text-emerald-400',
      tagTone: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    },
  ];

  return (
    <div className="rounded-2xl border border-zinc-800/90 bg-gradient-to-b from-zinc-900/70 to-surface/80 p-2 shadow-xl backdrop-blur-xl">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {views.map((v) => {
          const Icon = v.icon;
          const isActive = currentMode === v.id;

          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setPortfolioViewMode(v.id)}
              className={cn(
                'group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all duration-300',
                isActive
                  ? cn('border-opacity-100 bg-surface/95', v.activeBorder, v.activeGlow)
                  : 'border-zinc-800/60 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-900/50',
              )}
            >
              {/* Header row: Icon, Label, Badge */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors',
                      isActive
                        ? cn(v.activeBg, v.textColor, 'border-current/30')
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-500 group-hover:text-zinc-300',
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <span
                    className={cn(
                      'text-xs font-bold tracking-tight transition-colors sm:text-sm',
                      isActive ? 'text-zinc-50' : 'text-zinc-400 group-hover:text-zinc-200',
                    )}
                  >
                    {v.label}
                  </span>
                </div>

                <span
                  className={cn(
                    'num shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold transition-all',
                    isActive ? v.tagTone : 'border-zinc-800 bg-zinc-900/80 text-zinc-500',
                  )}
                >
                  {v.count} {t.common.trades}
                </span>
              </div>

              {/* Subtitle / Description */}
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                {v.sublabel}
              </p>

              {/* Active Bottom Glow Indicator */}
              {isActive && (
                <div
                  className={cn(
                    'absolute bottom-0 left-6 right-6 h-[2px] rounded-full blur-[1px]',
                    v.id === 'manual'
                      ? 'bg-cyan-400'
                      : v.id === 'bot'
                        ? 'bg-violet-400'
                        : 'bg-emerald-400',
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
