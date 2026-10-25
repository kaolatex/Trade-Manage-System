'use client';

import { useState } from 'react';
import { useTrading } from '@/context/trading-context';
import { useLanguage } from '@/context/language-context';
import { Card } from '@/components/ui/card';
import { Play, Pause, AlertOctagon, Flame, Beaker } from 'lucide-react';
import { botAccountId } from '@/lib/engine';
import { PanicModal } from './panic-modal';
import { cn } from '@/lib/utils';

export function EnvironmentBanner() {
  const { state, setBotRunning, setBotMode } = useTrading();
  const { t } = useLanguage();
  const [showPanicModal, setShowPanicModal] = useState(false);

  const targetId = botAccountId(state.botMode, state.accounts);
  const attachedAccount = state.accounts[targetId] || Object.values(state.accounts).find((a) => a.id !== 'all') || state.accounts.all;
  const isLive = state.botMode === 'live';

  return (
    <>
      <Card
        className={cn(
          'relative overflow-hidden p-5 transition-all duration-300',
          isLive
            ? 'border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-surface to-surface'
            : 'border-amber-500/30 bg-gradient-to-r from-amber-950/20 via-surface to-surface',
        )}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Mode Switcher & Status */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              {/* Segmented Mode Button */}
              <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-950/70 p-1">
                <button
                  type="button"
                  onClick={() => setBotMode('demo')}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200',
                    !isLive
                      ? 'bg-amber-500/15 text-amber-400 shadow-sm border border-amber-500/30'
                      : 'text-zinc-500 hover:text-zinc-300',
                  )}
                >
                  <Beaker className="size-3.5" />
                  <span>{t.environmentBanner.demoMode}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBotMode('live')}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200',
                    isLive
                      ? 'bg-emerald-500/15 text-emerald-400 shadow-sm border border-emerald-500/30'
                      : 'text-zinc-500 hover:text-zinc-300',
                  )}
                >
                  <Flame className="size-3.5" />
                  <span>{t.environmentBanner.liveMode}</span>
                </button>
              </div>

              {/* Bot State Badge */}
              <div
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset',
                  state.botRunning
                    ? 'bg-profit/10 text-profit ring-profit/25'
                    : 'bg-zinc-800 text-zinc-400 ring-zinc-700/60',
                )}
              >
                <span
                  className={cn(
                    'size-2 rounded-full',
                    state.botRunning ? 'bg-profit animate-pulse' : 'bg-zinc-500',
                  )}
                />
                <span>
                  {state.botRunning
                    ? t.environmentBanner.engineRunning
                    : t.environmentBanner.enginePaused}
                </span>
              </div>
            </div>

            <p className="text-xs text-zinc-400">
              {t.environmentBanner.attachedTo}{' '}
              <strong className="text-zinc-200">{attachedAccount?.name || 'No Synced Account'}</strong> &bull;{' '}
              <span className="num">#{attachedAccount?.login || 'NONE'}</span> ({attachedAccount?.server || 'HFM'}) &bull;{' '}
              {t.environmentBanner.balanceLabel}{' '}
              <span className="num text-zinc-200">${(attachedAccount?.balance ?? 0).toLocaleString()}</span>
            </p>
          </div>

          {/* Right: Master Control Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Start / Pause Button */}
            <button
              type="button"
              onClick={() => setBotRunning(!state.botRunning)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold shadow-lg transition-all duration-200 active:scale-95',
                state.botRunning
                  ? 'border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                  : 'bg-profit text-ink hover:bg-emerald-400 font-bold shadow-profit/20',
              )}
            >
              {state.botRunning ? (
                <>
                  <Pause className="size-4" />
                  <span>{t.environmentBanner.pauseBot}</span>
                </>
              ) : (
                <>
                  <Play className="size-4 fill-ink" />
                  <span>{t.environmentBanner.startBot}</span>
                </>
              )}
            </button>

            {/* Emergency Panic Close */}
            <button
              type="button"
              onClick={() => setShowPanicModal(true)}
              className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-400 shadow-lg shadow-rose-950/40 transition-all duration-200 hover:bg-rose-500/20 hover:text-rose-300 active:scale-95"
            >
              <AlertOctagon className="size-4" />
              <span>{t.environmentBanner.emergencyPanic}</span>
            </button>
          </div>
        </div>
      </Card>

      <PanicModal
        open={showPanicModal}
        onClose={() => setShowPanicModal(false)}
      />
    </>
  );
}
