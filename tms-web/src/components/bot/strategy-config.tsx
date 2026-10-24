'use client';

import { BotConfig, SessionKey, SymbolCode, Timeframe } from '@/lib/types';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, NumberInput, ToggleRow } from '@/components/ui/form';
import { Segmented } from '@/components/ui/segmented';
import { Sliders } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { SESSIONS, SESSION_MAP, activeSessions } from '@/lib/engine';
import { SYMBOL_LIST } from '@/lib/market';
import { TIMEFRAMES } from '@/lib/engine';
import { cn } from '@/lib/utils';

interface StrategyConfigProps {
  config: BotConfig;
  onChange: (patch: Partial<BotConfig>) => void;
}

export function StrategyConfig({ config, onChange }: StrategyConfigProps) {
  const { t } = useLanguage();
  const activeNow = activeSessions();

  const handleSessionToggle = (key: SessionKey, val: boolean) => {
    onChange({
      sessions: {
        ...config.sessions,
        [key]: val,
      },
    });
  };

  const sessionNames: Record<string, string> = {
    asian: t.sessionStats.asianSession,
    london: t.sessionStats.londonSession,
    newYork: t.sessionStats.newYorkSession,
  };

  return (
    <Card className="p-0">
      <CardHeader
        title={t.strategyConfig.title}
        subtitle={t.strategyConfig.subtitle}
        icon={<Sliders />}
      />

      <div className="space-y-6 p-5">
        {/* Symbol & Timeframe Selection */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Target Symbol */}
          <Field label={t.strategyConfig.targetSymbol} hint={t.strategyConfig.targetSymbolHint}>
            <Segmented<SymbolCode>
              options={SYMBOL_LIST.map((sym) => ({ value: sym, label: sym }))}
              value={config.symbol}
              onChange={(sym) => onChange({ symbol: sym })}
              stretch
            />
          </Field>

          {/* Timeframe */}
          <Field label={t.strategyConfig.timeframe} hint={t.strategyConfig.timeframeHint}>
            <Segmented<Timeframe>
              options={TIMEFRAMES.map((tf) => ({ value: tf, label: tf }))}
              value={config.timeframe}
              onChange={(tf) => onChange({ timeframe: tf })}
              stretch
            />
          </Field>
        </div>

        {/* Session Filter Switches */}
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {t.strategyConfig.sessionFilterTitle}
            </span>
            <span className="text-[11px] text-zinc-500">
              {t.strategyConfig.sessionFilterHint}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {SESSIONS.map((s) => {
              const isEnabled = config.sessions[s.key];
              const isLive = activeNow.includes(s.key);

              return (
                <div
                  key={s.key}
                  className={cn(
                    'flex flex-col justify-between rounded-xl border p-3 transition-colors',
                    isEnabled
                      ? 'border-zinc-700/80 bg-zinc-900/40'
                      : 'border-zinc-800/80 bg-zinc-950/40 opacity-70',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn('size-2 rounded-full', s.dot)} />
                      <span className="text-xs font-semibold text-zinc-200">{s.short}</span>
                    </div>
                    {isLive && (
                      <span className="num rounded bg-emerald-500/10 px-1.5 py-0.2 text-[9px] font-bold text-emerald-400">
                        {t.strategyConfig.activeNowBadge}
                      </span>
                    )}
                  </div>

                  <p className="my-2 text-[11px] text-zinc-500 truncate" title={sessionNames[s.key]}>
                    {sessionNames[s.key] || s.name}
                  </p>

                  <div className="flex items-center justify-between border-t border-zinc-800/60 pt-2">
                    <span className="text-[11px] text-zinc-400">
                      {isEnabled ? t.strategyConfig.allowed : t.strategyConfig.blocked}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      onClick={() => handleSessionToggle(s.key, !isEnabled)}
                      className={cn(
                        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                        isEnabled ? 'bg-profit' : 'bg-zinc-700',
                      )}
                    >
                      <span
                        className={cn(
                          'size-3.5 rounded-full bg-white transition-transform',
                          isEnabled ? 'translate-x-4' : 'translate-x-1',
                        )}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Execution Rules: SL / TP / BE / Trailing */}
        <div>
          <div className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {t.strategyConfig.rulesTitle}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t.strategyConfig.slPoints} hint={t.strategyConfig.slPointsHint}>
              <NumberInput
                value={config.slPoints}
                onChange={(slPoints) => onChange({ slPoints })}
                step={10}
                min={20}
                max={5000}
                suffix={t.common.pts}
              />
            </Field>

            <Field label={t.strategyConfig.tpPoints} hint={t.strategyConfig.tpPointsHint}>
              <NumberInput
                value={config.tpPoints}
                onChange={(tpPoints) => onChange({ tpPoints })}
                step={10}
                min={20}
                max={10000}
                suffix={t.common.pts}
              />
            </Field>
          </div>

          <div className="mt-4 space-y-2.5">
            <ToggleRow
              id="auto-be"
              title={t.strategyConfig.autoBeTitle}
              description={t.strategyConfig.autoBeDesc}
              checked={config.autoBE}
              onChange={(autoBE) => onChange({ autoBE })}
              tone="profit"
            />

            <ToggleRow
              id="trailing-stop"
              title={t.strategyConfig.trailingTitle}
              description={t.strategyConfig.trailingDesc}
              checked={config.trailingStop}
              onChange={(trailingStop) => onChange({ trailingStop })}
              tone="warn"
            />

            {config.trailingStop && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5 animate-fade-in">
                <Field label={t.strategyConfig.trailingDistance} hint={t.strategyConfig.trailingDistanceHint}>
                  <NumberInput
                    value={config.trailingPoints}
                    onChange={(trailingPoints) => onChange({ trailingPoints })}
                    step={10}
                    min={50}
                    max={2000}
                    suffix={t.common.pts}
                  />
                </Field>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
