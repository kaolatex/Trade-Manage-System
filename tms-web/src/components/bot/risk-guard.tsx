'use client';

import { useState } from 'react';
import { BotConfig, LotMode } from '@/lib/types';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, NumberInput, Stepper } from '@/components/ui/form';
import { Segmented } from '@/components/ui/segmented';
import { ShieldAlert, Save, Gauge } from 'lucide-react';
import { useTrading } from '@/context/trading-context';
import { useLanguage } from '@/context/language-context';
import { botAccountId } from '@/lib/engine';
import { cn } from '@/lib/utils';

interface RiskGuardProps {
  config: BotConfig;
  onChange: (patch: Partial<BotConfig>) => void;
  onSave: () => Promise<void>;
}

export function RiskGuard({ config, onChange, onSave }: RiskGuardProps) {
  const { state } = useTrading();
  const { t } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);

  const acc = state.accounts[botAccountId(state.botMode)];
  const dailyDrawdown = acc.dailyLossPct;
  const dailyLimit = config.dailyLossLimit;
  const ddPercentage = Math.min(100, (dailyDrawdown / dailyLimit) * 100);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave();
    setIsSaving(false);
  };

  return (
    <Card className="flex flex-col justify-between p-0">
      <div>
        <CardHeader
          title={t.riskGuard.title}
          subtitle={t.riskGuard.subtitle}
          icon={<ShieldAlert />}
        />

        <div className="space-y-6 p-5">
          {/* Lot Sizing Mode */}
          <div>
            <Field label={t.riskGuard.lotMode} hint={t.riskGuard.lotModeHint}>
              <Segmented<LotMode>
                options={[
                  { value: 'risk', label: t.riskGuard.dynamicRiskLabel },
                  { value: 'fixed', label: t.riskGuard.fixedLotLabel },
                ]}
                value={config.lotMode}
                onChange={(lotMode) => onChange({ lotMode })}
                stretch
              />
            </Field>

            <div className="mt-3">
              {config.lotMode === 'risk' ? (
                <Field
                  label={t.riskGuard.riskPercentLabel}
                  hint={t.riskGuard.riskPercentHint(
                    ((acc.balance * config.riskPercent) / 100).toFixed(2),
                  )}
                >
                  <NumberInput
                    value={config.riskPercent}
                    onChange={(riskPercent) => onChange({ riskPercent })}
                    step={0.1}
                    min={0.1}
                    max={10.0}
                    suffix="%"
                  />
                </Field>
              ) : (
                <Field label={t.riskGuard.fixedLotInputLabel} hint={t.riskGuard.fixedLotInputHint}>
                  <NumberInput
                    value={config.fixedLot}
                    onChange={(fixedLot) => onChange({ fixedLot })}
                    step={0.01}
                    min={0.01}
                    max={50.0}
                    suffix={t.common.lot}
                  />
                </Field>
              )}
            </div>
          </div>

          {/* Circuit Breaker (Daily Loss Limit) */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge className="size-4 text-rose-400" />
                <span className="text-xs font-semibold text-zinc-200">
                  {t.riskGuard.circuitBreakerTitle}
                </span>
              </div>
              <span className="num text-xs font-bold text-zinc-300">
                {t.riskGuard.limitLabel} {dailyLimit.toFixed(1)}%
              </span>
            </div>

            <p className="mt-1 text-[11px] text-zinc-500">
              {t.riskGuard.circuitBreakerDesc}
            </p>

            {/* Visual Bar */}
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-400">{t.riskGuard.currentDrawdown}</span>
                <span
                  className={cn(
                    'num font-semibold',
                    ddPercentage > 75 ? 'text-loss' : 'text-warn',
                  )}
                >
                  {dailyDrawdown.toFixed(2)}% / {dailyLimit.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    ddPercentage > 75 ? 'bg-loss' : 'bg-warn',
                  )}
                  style={{ width: `${ddPercentage}%` }}
                />
              </div>
            </div>

            <div className="mt-3">
              <Field label={t.riskGuard.adjustLimitLabel} hint={t.riskGuard.adjustLimitHint}>
                <NumberInput
                  value={config.dailyLossLimit}
                  onChange={(dailyLossLimit) => onChange({ dailyLossLimit })}
                  step={0.5}
                  min={0.5}
                  max={20.0}
                  suffix="%"
                />
              </Field>
            </div>
          </div>

          {/* Concurrent Trades & Spread Guard */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t.riskGuard.maxConcurrentLabel} hint={t.riskGuard.maxConcurrentHint}>
              <Stepper
                value={config.maxConcurrent}
                onChange={(maxConcurrent) => onChange({ maxConcurrent })}
                min={1}
                max={6}
                suffix={t.common.trades}
              />
            </Field>

            <Field label={t.riskGuard.maxSpreadLabel} hint={t.riskGuard.maxSpreadHint}>
              <NumberInput
                value={config.maxSpread}
                onChange={(maxSpread) => onChange({ maxSpread })}
                step={1}
                min={5}
                max={200}
                suffix={t.common.pts}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Save Button Footer */}
      <div className="border-t border-zinc-800/80 p-5">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-100 py-3 text-xs font-bold text-ink shadow-lg shadow-white/5 transition-all hover:bg-white active:scale-98 disabled:opacity-50"
        >
          {isSaving ? (
            <div className="flex items-center gap-2">
              <div className="size-3.5 animate-spin rounded-full border-2 border-zinc-800 border-t-zinc-400" />
              <span>{t.riskGuard.savingBtn}</span>
            </div>
          ) : (
            <>
              <Save className="size-4" />
              <span>{t.riskGuard.saveBtn}</span>
            </>
          )}
        </button>
      </div>
    </Card>
  );
}
