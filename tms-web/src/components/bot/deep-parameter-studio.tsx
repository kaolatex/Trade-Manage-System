'use client';

import { useState } from 'react';
import {
  AdvancedEaParams,
  BotConfig,
  DEFAULT_ADVANCED_PARAMS,
  StrategyMode,
  SymbolCode,
  Timeframe,
} from '@/lib/types';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, NumberInput, ToggleRow } from '@/components/ui/form';
import { Segmented } from '@/components/ui/segmented';
import { SYMBOL_LIST } from '@/lib/market';
import { TIMEFRAMES } from '@/lib/engine';
import { cn } from '@/lib/utils';
import {
  Sliders,
  Zap,
  Layers,
  CircleDollarSign,
  ShieldCheck,
  Download,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Cpu,
  Flame,
  Binary,
  Clock,
  HardDriveDownload,
  ExternalLink,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useLanguage } from '@/context/language-context';

interface DeepParameterStudioProps {
  config: BotConfig;
  onChange: (patch: Partial<BotConfig>) => void;
  onSave: () => Promise<void>;
  isSyncing?: boolean;
}

type TabKey = 'strategy' | 'layering' | 'basket' | 'risk' | 'download';

export function DeepParameterStudio({
  config,
  onChange,
  onSave,
  isSyncing = false,
}: DeepParameterStudioProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabKey>('strategy');
  const [isSavingLocal, setIsSavingLocal] = useState(false);

  const adv: AdvancedEaParams = config.advancedParams || DEFAULT_ADVANCED_PARAMS;

  // Helper to patch nested advanced parameters
  const patchAdv = (category: keyof AdvancedEaParams, patch: Record<string, any>) => {
    const updatedCategory = {
      ...adv[category],
      ...patch,
    };
    const updatedAdv: AdvancedEaParams = {
      ...adv,
      [category]: updatedCategory,
    };
    onChange({
      advancedParams: updatedAdv,
      // Mirror key fields to top-level BotConfig for backward compatibility
      ...(category === 'strategy' && patch.strategyMode
        ? { strategyMode: patch.strategyMode }
        : {}),
      ...(category === 'strategy' && patch.timeframe
        ? { timeframe: patch.timeframe }
        : {}),
      ...(category === 'strategy' && patch.magicNumber
        ? { magicNumber: patch.magicNumber }
        : {}),
      ...(category === 'layering' && patch.lotMode ? { lotMode: patch.lotMode } : {}),
      ...(category === 'layering' && patch.baseLot !== undefined
        ? { fixedLot: patch.baseLot }
        : {}),
      ...(category === 'layering' && patch.riskPercent !== undefined
        ? { riskPercent: patch.riskPercent }
        : {}),
      ...(category === 'layering' && patch.maxLayers !== undefined
        ? { maxConcurrent: patch.maxLayers }
        : {}),
      ...(category === 'basket' && patch.singleSlPoints !== undefined
        ? { slPoints: patch.singleSlPoints }
        : {}),
      ...(category === 'basket' && patch.singleTpPoints !== undefined
        ? { tpPoints: patch.singleTpPoints }
        : {}),
      ...(category === 'basket' && patch.useAutoBreakEven !== undefined
        ? { autoBE: patch.useAutoBreakEven }
        : {}),
      ...(category === 'basket' && patch.useTrailingStop !== undefined
        ? { trailingStop: patch.useTrailingStop }
        : {}),
      ...(category === 'basket' && patch.trailStartPoints !== undefined
        ? { trailingPoints: patch.trailStartPoints }
        : {}),
      ...(category === 'risk' && patch.maxSpreadPoints !== undefined
        ? { maxSpread: patch.maxSpreadPoints }
        : {}),
      ...(category === 'risk' && patch.dailyMaxLossUsd !== undefined
        ? { dailyLossLimit: patch.dailyMaxLossUsd }
        : {}),
    });
  };

  // Quick Preset Handlers
  const applyPreset = (presetName: 'btcusd' | 'safe' | 'spam' | 'quant') => {
    if (presetName === 'btcusd') {
      onChange({
        symbol: 'BTCUSD',
        timeframe: 'M15',
        strategyMode: 'MODE_ADAPTIVE_QUANT',
        advancedParams: {
          ...adv,
          strategy: {
            ...adv.strategy,
            strategyMode: 'MODE_ADAPTIVE_QUANT',
            timeframe: 'M15',
            lookbackBars: 2500,
            patternLength: 5,
            forwardHorizonBars: 3,
            minWinProbabilityPct: 65.0,
            zScoreThreshold: 1.5,
            dynamicAtrSlMult: 1.8,
            dynamicAtrTpMult: 2.8,
          },
          layering: {
            ...adv.layering,
            lotMode: 'fixed',
            baseLot: 0.01,
            maxLayers: 5,
            lotMultiplier: 1.0,
            minStepPoints: 2500, // Scaled for Bitcoin's price range
            useDynamicAtrStep: true,
            atrStepMult: 0.9,
            layerCooldownSec: 20,
          },
          basket: {
            ...adv.basket,
            useBasketClose: true,
            basketTargetUsd: 15.0, // $15 basket target
            singleTpUsd: 8.0,
            singleTpPoints: 4000,
            singleSlPoints: 8000,
            useAutoBreakEven: true,
            beTriggerPoints: 2500,
            beLockPoints: 400,
            useTrailingStop: true,
            trailStartPoints: 3500,
            trailStepPoints: 500,
          },
          risk: {
            ...adv.risk,
            maxSpreadPoints: 80,
            dailyMaxLossUsd: 100.0,
            dailyTargetProfitUsd: 250.0,
            tradeAsianSession: true,
            tradeLondonSession: true,
            tradeNySession: true,
          },
        },
      });
    } else if (presetName === 'safe') {
      onChange({
        symbol: 'XAUUSD',
        timeframe: 'M15',
        strategyMode: 'MODE_AGGRESSIVE_SCALPER',
        advancedParams: {
          ...adv,
          strategy: {
            ...adv.strategy,
            strategyMode: 'MODE_AGGRESSIVE_SCALPER',
            timeframe: 'M15',
            emaTrendPeriod: 50,
            bbPeriod: 20,
            bbDeviation: 1.8,
            stochRsiK: 14,
            stochRsiOversold: 22.0,
            stochRsiOverbought: 78.0,
            minRejectionWickPct: 25.0,
            newsSpikeFilterAtr: 2.8,
          },
          layering: {
            ...adv.layering,
            lotMode: 'fixed',
            baseLot: 0.01,
            maxLayers: 5,
            lotMultiplier: 1.0, // Flat
            minStepPoints: 80,
            useDynamicAtrStep: true,
            atrStepMult: 0.7,
            layerCooldownSec: 15,
          },
          basket: {
            ...adv.basket,
            useBasketClose: true,
            basketTargetUsd: 1.5,
            singleTpUsd: 1.0,
            singleTpPoints: 150,
            singleSlPoints: 400,
            useAutoBreakEven: true,
            beTriggerPoints: 120,
            beLockPoints: 20,
            useTrailingStop: true,
            trailStartPoints: 150,
            trailStepPoints: 30,
          },
          risk: {
            ...adv.risk,
            maxSpreadPoints: 35,
            dailyMaxLossUsd: 50.0,
            dailyTargetProfitUsd: 100.0,
            tradeAsianSession: true,
            tradeLondonSession: true,
            tradeNySession: true,
          },
        },
      });
    } else if (presetName === 'spam') {
      onChange({
        symbol: 'XAUUSD',
        timeframe: 'M5',
        strategyMode: 'MODE_AGGRESSIVE_SCALPER',
        advancedParams: {
          ...adv,
          strategy: {
            ...adv.strategy,
            strategyMode: 'MODE_AGGRESSIVE_SCALPER',
            timeframe: 'M5',
            emaTrendPeriod: 34,
            bbPeriod: 20,
            bbDeviation: 1.6,
            stochRsiK: 10,
            stochRsiOversold: 20.0,
            stochRsiOverbought: 80.0,
            minRejectionWickPct: 20.0,
            newsSpikeFilterAtr: 2.5,
          },
          layering: {
            ...adv.layering,
            lotMode: 'fixed',
            baseLot: 0.01,
            maxLayers: 8,
            lotMultiplier: 1.25, // Recovery
            minStepPoints: 50,
            useDynamicAtrStep: false,
            layerCooldownSec: 10,
          },
          basket: {
            ...adv.basket,
            useBasketClose: true,
            basketTargetUsd: 2.0,
            singleTpUsd: 1.0,
            singleTpPoints: 100,
            singleSlPoints: 300,
            useAutoBreakEven: true,
            beTriggerPoints: 90,
            beLockPoints: 15,
            useTrailingStop: true,
            trailStartPoints: 100,
            trailStepPoints: 25,
          },
          risk: {
            ...adv.risk,
            maxSpreadPoints: 40,
            dailyMaxLossUsd: 80.0,
            dailyTargetProfitUsd: 150.0,
            tradeAsianSession: true,
            tradeLondonSession: true,
            tradeNySession: true,
          },
        },
      });
    } else if (presetName === 'quant') {
      onChange({
        symbol: 'XAUUSD',
        timeframe: 'M15',
        strategyMode: 'MODE_ADAPTIVE_QUANT',
        advancedParams: {
          ...adv,
          strategy: {
            ...adv.strategy,
            strategyMode: 'MODE_ADAPTIVE_QUANT',
            timeframe: 'M15',
            lookbackBars: 3000,
            patternLength: 5,
            forwardHorizonBars: 3,
            minWinProbabilityPct: 70.0,
            zScoreThreshold: 1.8,
            dynamicAtrSlMult: 1.5,
            dynamicAtrTpMult: 2.5,
          },
          layering: {
            ...adv.layering,
            lotMode: 'risk',
            riskPercent: 1.0,
            baseLot: 0.01,
            maxLayers: 3,
            lotMultiplier: 1.0,
            minStepPoints: 100,
            useDynamicAtrStep: true,
            atrStepMult: 1.0,
            layerCooldownSec: 30,
          },
          basket: {
            ...adv.basket,
            useBasketClose: true,
            basketTargetUsd: 3.0,
            singleTpUsd: 2.5,
            singleTpPoints: 250,
            singleSlPoints: 350,
            useAutoBreakEven: true,
            beTriggerPoints: 150,
            beLockPoints: 30,
            useTrailingStop: true,
            trailStartPoints: 180,
            trailStepPoints: 40,
          },
          risk: {
            ...adv.risk,
            maxSpreadPoints: 30,
            dailyMaxLossUsd: 50.0,
            dailyTargetProfitUsd: 120.0,
            tradeAsianSession: false,
            tradeLondonSession: true,
            tradeNySession: true,
          },
        },
      });
    }
  };

  const handleSaveClick = async () => {
    setIsSavingLocal(true);
    try {
      await onSave();
    } finally {
      setIsSavingLocal(false);
    }
  };

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: 'strategy', label: '1. Strategy & Indicator', icon: Zap },
    { key: 'layering', label: '2. Layering & Sizing', icon: Layers },
    { key: 'basket', label: '3. Basket TP & Trailing', icon: CircleDollarSign },
    { key: 'risk', label: '4. Risk Guard & Sessions', icon: ShieldCheck },
    { key: 'download', label: '5. Download EA & Presets', icon: Download },
  ];

  return (
    <Card className="overflow-hidden border-zinc-800/80 bg-zinc-950/80 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="border-b border-zinc-800/80 bg-gradient-to-r from-zinc-900/80 via-zinc-950 to-zinc-900/80 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 shadow-lg shadow-cyan-500/10">
              <Cpu className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-zinc-100">
                  Pro EA Deep Parameter Studio
                </h2>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  MQL5 Native v2.0
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Precision properties editor for MetaTrader 5 EA & Cloud sync bridge
              </p>
            </div>
          </div>

          {/* Quick Presets Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-zinc-500">Presets:</span>
            <button
              type="button"
              onClick={() => applyPreset('btcusd')}
              className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-orange-500/15 px-3 py-1.5 text-xs font-bold text-amber-300 shadow-md shadow-amber-500/10 transition-colors hover:border-amber-500/60 hover:from-amber-500/25 hover:to-orange-500/25 active:scale-95"
            >
              <Zap className="size-3.5 text-amber-400" />
              🚀 BTCUSD Backtest Master
            </button>
            <button
              type="button"
              onClick={() => applyPreset('safe')}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/10"
            >
              <ShieldCheck className="size-3.5 text-emerald-400" />
              Safe Gold Scalper
            </button>
            <button
              type="button"
              onClick={() => applyPreset('spam')}
              className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:border-amber-500/40 hover:bg-amber-500/10"
            >
              <Flame className="size-3.5 text-amber-400" />
              High-Speed Spam
            </button>
            <button
              type="button"
              onClick={() => applyPreset('quant')}
              className="flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/5 px-2.5 py-1.5 text-xs font-medium text-violet-300 transition-colors hover:border-violet-500/40 hover:bg-violet-500/10"
            >
              <Binary className="size-3.5 text-violet-400" />
              Strict Quant 70%
            </button>
          </div>
        </div>

        {/* Live Overview Badges */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Mode</span>
            <div className="mt-0.5 truncate text-xs font-semibold text-zinc-200">
              {adv.strategy.strategyMode === 'MODE_ADAPTIVE_QUANT'
                ? 'Adaptive Quant'
                : 'Aggressive Scalper'}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Layers & Lot</span>
            <div className="mt-0.5 text-xs font-semibold text-zinc-200">
              Max {adv.layering.maxLayers} Layers ({adv.layering.baseLot} lot, {adv.layering.lotMultiplier}x)
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Basket Target</span>
            <div className="mt-0.5 text-xs font-semibold text-emerald-400">
              ${adv.basket.basketTargetUsd.toFixed(2)} USD
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Risk Circuit</span>
            <div className="mt-0.5 text-xs font-semibold text-zinc-200">
              -$ {adv.risk.dailyMaxLossUsd} / +$ {adv.risk.dailyTargetProfitUsd}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-zinc-800 bg-zinc-900/40 px-3 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition-colors',
                isActive
                  ? 'border-cyan-400 text-cyan-300 bg-zinc-900/80'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700',
              )}
            >
              <Icon className={cn('size-4', isActive ? 'text-cyan-400' : 'text-zinc-500')} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="p-6">
        {/* =================================================================== */}
        {/* Tab 1: Strategy & Indicator Tuning                                  */}
        {/* =================================================================== */}
        {activeTab === 'strategy' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field
                label="Strategy Engine Mode"
                hint="Choose between aggressive mean-reversion scalping or mathematical pattern scanning"
              >
                <Segmented<StrategyMode>
                  options={[
                    { value: 'MODE_AGGRESSIVE_SCALPER', label: '⚡ Aggressive Scalper' },
                    { value: 'MODE_ADAPTIVE_QUANT', label: '🧠 Adaptive Quant' },
                  ]}
                  value={adv.strategy.strategyMode}
                  onChange={(mode) => patchAdv('strategy', { strategyMode: mode })}
                  stretch
                />
              </Field>

              <Field label="Target Symbol & Chart Timeframe" hint="Standard HFM MT5 market pair and candle horizon">
                <div className="grid grid-cols-2 gap-2">
                  <Segmented<SymbolCode>
                    options={SYMBOL_LIST.map((sym) => ({ value: sym, label: sym }))}
                    value={config.symbol}
                    onChange={(sym) => onChange({ symbol: sym })}
                    stretch
                  />
                  <Segmented<Timeframe>
                    options={TIMEFRAMES.map((tf) => ({ value: tf, label: tf }))}
                    value={adv.strategy.timeframe}
                    onChange={(tf) => patchAdv('strategy', { timeframe: tf })}
                    stretch
                  />
                </div>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Magic Number (Identification)" hint="Unique ticket magic ID separating EA trades from manual trades">
                <NumberInput
                  value={adv.strategy.magicNumber}
                  onChange={(v) => patchAdv('strategy', { magicNumber: v })}
                  step={1}
                  min={1000}
                  max={9999999}
                />
              </Field>

              <Field label="Order Comment" hint="Appended to MT5 ticket comments for telemetry tracking">
                <div className="flex h-10 items-center rounded-lg border border-zinc-800 bg-zinc-950/60 px-3">
                  <input
                    type="text"
                    value={adv.strategy.orderComment}
                    onChange={(e) => patchAdv('strategy', { orderComment: e.target.value })}
                    className="w-full bg-transparent text-sm text-zinc-100 outline-none"
                  />
                </div>
              </Field>
            </div>

            {/* Mode Specific Deep Tuning Sub-panel */}
            {adv.strategy.strategyMode === 'MODE_AGGRESSIVE_SCALPER' ? (
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5 space-y-5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                  <Flame className="size-4" />
                  Aggressive Scalper & Multi-EMA Ribbon Parameters
                </div>

                {/* Multi-EMA Ribbon Section */}
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 space-y-3">
                  <ToggleRow
                    id="multi-ema-ribbon"
                    title="Multi-EMA Ribbon Alignment & Slope"
                    description="Enforces trend direction using EMA 9 / 21 / 50 / 200 ribbon & micro-pullback zone"
                    checked={adv.strategy.useMultiEmaRibbon}
                    onChange={(v) => patchAdv('strategy', { useMultiEmaRibbon: v })}
                    tone="profit"
                  />

                  {adv.strategy.useMultiEmaRibbon && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-1">
                      <Field label="EMA 9 (Fast)" hint="Momentum trigger">
                        <NumberInput
                          value={adv.strategy.ema9Fast}
                          onChange={(v) => patchAdv('strategy', { ema9Fast: v })}
                          step={1}
                          min={3}
                          max={30}
                        />
                      </Field>
                      <Field label="EMA 21 (Pullback)" hint="Pullback zone">
                        <NumberInput
                          value={adv.strategy.ema21Pullback}
                          onChange={(v) => patchAdv('strategy', { ema21Pullback: v })}
                          step={1}
                          min={10}
                          max={50}
                        />
                      </Field>
                      <Field label="EMA 50 (Medium)" hint="Medium trend">
                        <NumberInput
                          value={adv.strategy.ema50Medium}
                          onChange={(v) => patchAdv('strategy', { ema50Medium: v })}
                          step={5}
                          min={25}
                          max={100}
                        />
                      </Field>
                      <Field label="EMA 200 (Macro)" hint="Macro structural filter">
                        <NumberInput
                          value={adv.strategy.ema200Macro}
                          onChange={(v) => patchAdv('strategy', { ema200Macro: v })}
                          step={10}
                          min={100}
                          max={400}
                        />
                      </Field>
                    </div>
                  )}
                </div>

                {/* 3,000-Bar Quant Confluence Filter */}
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
                  <ToggleRow
                    id="quant-3000-filter"
                    title="3,000-Bar Empirical Quant Engine"
                    description="Scans 3,000 historical bars to verify that similar setups achieved >= 65% win rate before firing"
                    checked={adv.strategy.use3000BarQuantFilter}
                    onChange={(v) => patchAdv('strategy', { use3000BarQuantFilter: v })}
                    tone="warn"
                  />

                  {adv.strategy.use3000BarQuantFilter && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
                      <Field label="Lookback Historical Bars" hint="Memory depth scanned for pattern matches">
                        <NumberInput
                          value={adv.strategy.lookbackBars}
                          onChange={(v) => patchAdv('strategy', { lookbackBars: v })}
                          step={250}
                          min={1000}
                          max={5000}
                          suffix="bars"
                        />
                      </Field>
                      <Field label="Min Win-Rate Threshold (%)" hint="Rejects signals with lower statistical win rate">
                        <NumberInput
                          value={adv.strategy.minWinProbabilityPct}
                          onChange={(v) => patchAdv('strategy', { minWinProbabilityPct: v })}
                          step={1}
                          min={50}
                          max={90}
                          suffix="%"
                        />
                      </Field>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="BB Period" hint="Bollinger Bands lookback bars">
                    <NumberInput
                      value={adv.strategy.bbPeriod}
                      onChange={(v) => patchAdv('strategy', { bbPeriod: v })}
                      step={1}
                      min={5}
                      max={100}
                    />
                  </Field>

                  <Field label="BB Deviation" hint="Standard deviation multiplier">
                    <NumberInput
                      value={adv.strategy.bbDeviation}
                      onChange={(v) => patchAdv('strategy', { bbDeviation: v })}
                      step={0.1}
                      min={0.5}
                      max={4.0}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label="StochRSI K Period" hint="Momentum oscillator smoothing">
                    <NumberInput
                      value={adv.strategy.stochRsiK}
                      onChange={(v) => patchAdv('strategy', { stochRsiK: v })}
                      step={1}
                      min={5}
                      max={50}
                    />
                  </Field>

                  <Field label="StochRSI Oversold Level" hint="Trigger buy rebound threshold">
                    <NumberInput
                      value={adv.strategy.stochRsiOversold}
                      onChange={(v) => patchAdv('strategy', { stochRsiOversold: v })}
                      step={1}
                      min={5}
                      max={40}
                    />
                  </Field>

                  <Field label="StochRSI Overbought Level" hint="Trigger sell rebound threshold">
                    <NumberInput
                      value={adv.strategy.stochRsiOverbought}
                      onChange={(v) => patchAdv('strategy', { stochRsiOverbought: v })}
                      step={1}
                      min={60}
                      max={95}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Min Rejection Wick %" hint="Minimum candle wick tail size relative to total bar range">
                    <NumberInput
                      value={adv.strategy.minRejectionWickPct}
                      onChange={(v) => patchAdv('strategy', { minRejectionWickPct: v })}
                      step={1}
                      min={5}
                      max={80}
                      suffix="%"
                    />
                  </Field>

                  <Field label="News Spike Filter" hint="Skips bars with abnormal range exceeding multiple of ATR">
                    <NumberInput
                      value={adv.strategy.newsSpikeFilterAtr}
                      onChange={(v) => patchAdv('strategy', { newsSpikeFilterAtr: v })}
                      step={0.1}
                      min={1.0}
                      max={10.0}
                      suffix="x ATR"
                    />
                  </Field>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5 space-y-5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-400">
                  <Binary className="size-4" />
                  Adaptive Quant Historical Pattern Tuning
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label="Lookback Bars" hint="Historical depth scanned for patterns">
                    <NumberInput
                      value={adv.strategy.lookbackBars}
                      onChange={(v) => patchAdv('strategy', { lookbackBars: v })}
                      step={250}
                      min={500}
                      max={10000}
                      suffix="bars"
                    />
                  </Field>

                  <Field label="Vector Pattern Length" hint="Length of recent normalized return vector">
                    <NumberInput
                      value={adv.strategy.patternLength}
                      onChange={(v) => patchAdv('strategy', { patternLength: v })}
                      step={1}
                      min={3}
                      max={15}
                      suffix="bars"
                    />
                  </Field>

                  <Field label="Forward Horizon" hint="Outcome evaluation window">
                    <NumberInput
                      value={adv.strategy.forwardHorizonBars}
                      onChange={(v) => patchAdv('strategy', { forwardHorizonBars: v })}
                      step={1}
                      min={1}
                      max={10}
                      suffix="bars"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Min Win Probability %" hint="Empirical win rate threshold among historical matches">
                    <NumberInput
                      value={adv.strategy.minWinProbabilityPct}
                      onChange={(v) => patchAdv('strategy', { minWinProbabilityPct: v })}
                      step={1}
                      min={50}
                      max={90}
                      suffix="%"
                    />
                  </Field>

                  <Field label="Z-Score Statistical Threshold" hint="Statistical significance barrier (higher = stricter)">
                    <NumberInput
                      value={adv.strategy.zScoreThreshold}
                      onChange={(v) => patchAdv('strategy', { zScoreThreshold: v })}
                      step={0.1}
                      min={0.5}
                      max={3.5}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Dynamic ATR SL Multiplier" hint="ATR-based Stop Loss distance">
                    <NumberInput
                      value={adv.strategy.dynamicAtrSlMult}
                      onChange={(v) => patchAdv('strategy', { dynamicAtrSlMult: v })}
                      step={0.1}
                      min={0.5}
                      max={5.0}
                      suffix="x ATR"
                    />
                  </Field>

                  <Field label="Dynamic ATR TP Multiplier" hint="ATR-based Take Profit distance">
                    <NumberInput
                      value={adv.strategy.dynamicAtrTpMult}
                      onChange={(v) => patchAdv('strategy', { dynamicAtrTpMult: v })}
                      step={0.1}
                      min={0.5}
                      max={8.0}
                      suffix="x ATR"
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* Tab 2: Layering & Lot Sizing                                        */}
        {/* =================================================================== */}
        {activeTab === 'layering' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Lot Sizing Mode" hint="Fixed volume per layer or dynamic percentage of account balance">
                <Segmented<'fixed' | 'risk'>
                  options={[
                    { value: 'fixed', label: 'Fixed Base Lot' },
                    { value: 'risk', label: 'Dynamic % Balance Risk' },
                  ]}
                  value={adv.layering.lotMode}
                  onChange={(mode) => patchAdv('layering', { lotMode: mode })}
                  stretch
                />
              </Field>

              {adv.layering.lotMode === 'fixed' ? (
                <Field label="Base Lot Size" hint="Initial volume for layer #1 (0.01 = micro lot)">
                  <NumberInput
                    value={adv.layering.baseLot}
                    onChange={(v) => patchAdv('layering', { baseLot: v })}
                    step={0.01}
                    min={0.01}
                    max={10.0}
                  />
                </Field>
              ) : (
                <Field label="Risk Percent (%)" hint="Percent of account equity risked per trade setup">
                  <NumberInput
                    value={adv.layering.riskPercent}
                    onChange={(v) => patchAdv('layering', { riskPercent: v })}
                    step={0.1}
                    min={0.1}
                    max={10.0}
                    suffix="%"
                  />
                </Field>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Max Open Layers" hint="Maximum number of simultaneous open positions">
                <NumberInput
                  value={adv.layering.maxLayers}
                  onChange={(v) => patchAdv('layering', { maxLayers: v })}
                  step={1}
                  min={1}
                  max={20}
                  suffix="layers"
                />
              </Field>

              <Field label="Lot Multiplier" hint="Scaling multiplier (1.0 = flat lot, >1.0 = martingalish scale-in)">
                <NumberInput
                  value={adv.layering.lotMultiplier}
                  onChange={(v) => patchAdv('layering', { lotMultiplier: v })}
                  step={0.05}
                  min={1.0}
                  max={3.0}
                  suffix="x"
                />
              </Field>

              <Field label="Layer Cooldown (Seconds)" hint="Minimum time pause before firing next layer">
                <NumberInput
                  value={adv.layering.layerCooldownSec}
                  onChange={(v) => patchAdv('layering', { layerCooldownSec: v })}
                  step={5}
                  min={5}
                  max={300}
                  suffix="sec"
                />
              </Field>
            </div>

            {/* Smart Pyramiding (Free-Risk Scaling) */}
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
              <ToggleRow
                id="smart-pyramiding"
                title="🚀 Smart Pyramiding (Free-Risk Scale-In)"
                description="Allows continuous scale-in as long as prior positions are secured at Break-Even (0% capital risk)"
                checked={adv.layering.useSmartPyramiding}
                onChange={(v) => patchAdv('layering', { useSmartPyramiding: v })}
                tone="profit"
              />

              {adv.layering.useSmartPyramiding && (
                <Field label="Max Total Pyramid Positions" hint="Maximum total open positions allowed across all free-risk layers">
                  <NumberInput
                    value={adv.layering.maxOpenPositions}
                    onChange={(v) => patchAdv('layering', { maxOpenPositions: v })}
                    step={1}
                    min={3}
                    max={25}
                    suffix="positions"
                  />
                </Field>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-zinc-200">Layer Step Distance Configuration</h4>
                  <p className="text-xs text-zinc-500">Minimum spacing required between consecutive positions</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Min Step Points" hint="Absolute floor distance between orders">
                  <NumberInput
                    value={adv.layering.minStepPoints}
                    onChange={(v) => patchAdv('layering', { minStepPoints: v })}
                    step={10}
                    min={20}
                    max={1000}
                    suffix="pts"
                  />
                </Field>

                <div className="space-y-3">
                  <ToggleRow
                    id="dynamic-atr-step"
                    title="Dynamic ATR Step"
                    description="Expands step distance automatically during volatile market phases"
                    checked={adv.layering.useDynamicAtrStep}
                    onChange={(v) => patchAdv('layering', { useDynamicAtrStep: v })}
                    tone="profit"
                  />

                  {adv.layering.useDynamicAtrStep && (
                    <Field label="ATR Step Multiplier" hint="Step distance = Max(Min Step, ATR * Mult)">
                      <NumberInput
                        value={adv.layering.atrStepMult}
                        onChange={(v) => patchAdv('layering', { atrStepMult: v })}
                        step={0.1}
                        min={0.1}
                        max={3.0}
                        suffix="x ATR"
                      />
                    </Field>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* Tab 3: Basket TP, Break-Even & Trailing                             */}
        {/* =================================================================== */}
        {activeTab === 'basket' && (
          <div className="space-y-6">
            {/* Collective Basket Target */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="size-5 text-emerald-400" />
                  <div>
                    <h3 className="text-sm font-bold text-emerald-300">
                      Collective Basket Profit Liquidator ($ Target)
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Instantly closes ALL active layers as a group once their net floating profit reaches target
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
                <ToggleRow
                  id="basket-close-toggle"
                  title="Enable Collective Basket Close"
                  description="High-frequency millisecond check on floating basket P&L"
                  checked={adv.basket.useBasketClose}
                  onChange={(v) => patchAdv('basket', { useBasketClose: v })}
                  tone="profit"
                />

                <Field label="Basket Target Profit ($ USD)" hint="Target floating USD to liquidate entire basket">
                  <NumberInput
                    value={adv.basket.basketTargetUsd}
                    onChange={(v) => patchAdv('basket', { basketTargetUsd: v })}
                    step={0.25}
                    min={0.25}
                    max={500}
                    suffix="$ USD"
                  />
                </Field>
              </div>
            </div>

            {/* Individual Position Targets */}
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Single Position Rules (Per Layer)
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Single TP ($ USD)" hint="Close individual position if profit hits $ (0 = off)">
                  <NumberInput
                    value={adv.basket.singleTpUsd}
                    onChange={(v) => patchAdv('basket', { singleTpUsd: v })}
                    step={0.25}
                    min={0}
                    max={100}
                    suffix="$ USD"
                  />
                </Field>

                <Field label="Single TP Points" hint="Hard take profit in points (0 = off)">
                  <NumberInput
                    value={adv.basket.singleTpPoints}
                    onChange={(v) => patchAdv('basket', { singleTpPoints: v })}
                    step={10}
                    min={0}
                    max={5000}
                    suffix="pts"
                  />
                </Field>

                <Field label="Single SL Points" hint="Hard stop loss in points (0 = off)">
                  <NumberInput
                    value={adv.basket.singleSlPoints}
                    onChange={(v) => patchAdv('basket', { singleSlPoints: v })}
                    step={10}
                    min={0}
                    max={5000}
                    suffix="pts"
                  />
                </Field>
              </div>
            </div>

            {/* Instant Smart Break-Even Engine */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-4">
              <ToggleRow
                id="instant-be-toggle"
                title="⚡ Instant Smart Break-Even Engine (Risk-Free Lock)"
                description="Auto-calibrates to live spread + commissions, instantly moving SL into profit (+15-30 pts) once green"
                checked={adv.basket.useInstantSmartBE}
                onChange={(v) => patchAdv('basket', { useInstantSmartBE: v })}
                tone="profit"
              />

              {adv.basket.useInstantSmartBE && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
                  <Field label="Instant BE Trigger (Points)" hint="0 = Auto 1.5x Live Spread">
                    <NumberInput
                      value={adv.basket.instantBeTriggerPoints}
                      onChange={(v) => patchAdv('basket', { instantBeTriggerPoints: v })}
                      step={10}
                      min={0}
                      max={1000}
                      suffix="pts"
                    />
                  </Field>
                  <Field label="Profit Lock Offset (Points)" hint="Points beyond entry to cover fees">
                    <NumberInput
                      value={adv.basket.instantBeLockPoints}
                      onChange={(v) => patchAdv('basket', { instantBeLockPoints: v })}
                      step={5}
                      min={5}
                      max={200}
                      suffix="pts"
                    />
                  </Field>
                  <Field label="Min Floating Profit ($ USD)" hint="Trigger BE if dollar target hit">
                    <NumberInput
                      value={adv.basket.instantBeMinUsd}
                      onChange={(v) => patchAdv('basket', { instantBeMinUsd: v })}
                      step={0.1}
                      min={0.1}
                      max={50}
                      suffix="$ USD"
                    />
                  </Field>
                </div>
              )}
            </div>

            {/* Standard Break-Even & Trailing */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
                <ToggleRow
                  id="auto-be-toggle"
                  title="Standard Auto Break-Even"
                  description="Moves SL to entry + lock points when price reaches configured point milestone"
                  checked={adv.basket.useAutoBreakEven}
                  onChange={(v) => patchAdv('basket', { useAutoBreakEven: v })}
                  tone="profit"
                />

                {adv.basket.useAutoBreakEven && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Field label="Trigger Points" hint="Distance to trigger BE">
                      <NumberInput
                        value={adv.basket.beTriggerPoints}
                        onChange={(v) => patchAdv('basket', { beTriggerPoints: v })}
                        step={10}
                        min={20}
                        max={1000}
                        suffix="pts"
                      />
                    </Field>
                    <Field label="Lock Profit Points" hint="Points beyond entry">
                      <NumberInput
                        value={adv.basket.beLockPoints}
                        onChange={(v) => patchAdv('basket', { beLockPoints: v })}
                        step={5}
                        min={0}
                        max={200}
                        suffix="pts"
                      />
                    </Field>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
                <ToggleRow
                  id="trailing-toggle"
                  title="Micro Trailing Stop"
                  description="Dynamically trails SL to protect accumulated floating profit"
                  checked={adv.basket.useTrailingStop}
                  onChange={(v) => patchAdv('basket', { useTrailingStop: v })}
                  tone="warn"
                />

                {adv.basket.useTrailingStop && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Field label="Start Distance" hint="Activation threshold">
                      <NumberInput
                        value={adv.basket.trailStartPoints}
                        onChange={(v) => patchAdv('basket', { trailStartPoints: v })}
                        step={10}
                        min={20}
                        max={2000}
                        suffix="pts"
                      />
                    </Field>
                    <Field label="Step Distance" hint="Trail advance increment">
                      <NumberInput
                        value={adv.basket.trailStepPoints}
                        onChange={(v) => patchAdv('basket', { trailStepPoints: v })}
                        step={5}
                        min={5}
                        max={500}
                        suffix="pts"
                      />
                    </Field>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* Tab 4: Risk Guard & Trading Sessions                                */}
        {/* =================================================================== */}
        {activeTab === 'risk' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Max Allowed Spread" hint="Prevents order execution when broker spread is abnormally wide">
                <NumberInput
                  value={adv.risk.maxSpreadPoints}
                  onChange={(v) => patchAdv('risk', { maxSpreadPoints: v })}
                  step={1}
                  min={10}
                  max={200}
                  suffix="pts"
                />
              </Field>

              <Field label="Daily Max Loss Circuit Breaker ($)" hint="Halt EA immediately if today's closed loss exceeds this">
                <NumberInput
                  value={adv.risk.dailyMaxLossUsd}
                  onChange={(v) => patchAdv('risk', { dailyMaxLossUsd: v })}
                  step={5}
                  min={10}
                  max={10000}
                  suffix="$ USD"
                />
              </Field>

              <Field label="Daily Take Profit Target ($)" hint="Lock profits & halt EA once daily profit target is reached">
                <NumberInput
                  value={adv.risk.dailyTargetProfitUsd}
                  onChange={(v) => patchAdv('risk', { dailyTargetProfitUsd: v })}
                  step={10}
                  min={10}
                  max={50000}
                  suffix="$ USD"
                />
              </Field>
            </div>

            {/* Trading Sessions Filter */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-cyan-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Active Market Trading Sessions
                  </span>
                </div>
                <span className="text-[11px] text-zinc-500">Based on GMT Broker Server Clock</span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-200">Asian Session</span>
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">00:00 - 08:00 GMT</span>
                  </div>
                  <ToggleRow
                    id="session-asian"
                    title="Allow Trading"
                    checked={adv.risk.tradeAsianSession}
                    onChange={(v) => patchAdv('risk', { tradeAsianSession: v })}
                    tone="profit"
                  />
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-200">London Session</span>
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">08:00 - 16:00 GMT</span>
                  </div>
                  <ToggleRow
                    id="session-london"
                    title="Allow Trading"
                    checked={adv.risk.tradeLondonSession}
                    onChange={(v) => patchAdv('risk', { tradeLondonSession: v })}
                    tone="profit"
                  />
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-200">New York Session</span>
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">13:00 - 22:00 GMT</span>
                  </div>
                  <ToggleRow
                    id="session-ny"
                    title="Allow Trading"
                    checked={adv.risk.tradeNySession}
                    onChange={(v) => patchAdv('risk', { tradeNySession: v })}
                    tone="profit"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* Tab 5: Download Native .mq5 EA & Presets Guide                      */}
        {/* =================================================================== */}
        {activeTab === 'download' && (
          <div className="space-y-6">
            {/* Download Hero Banner */}
            <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/40 via-zinc-900/60 to-zinc-950 p-6 shadow-2xl">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                      Native MetaTrader 5 Source Code
                    </span>
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-zinc-100">
                    TMS_Quantum_EA.mq5 (Ready to Compile)
                  </h3>
                  <p className="max-w-xl text-xs text-zinc-400 leading-relaxed">
                    Pure, standard MQL5 Expert Advisor with On-Chart HUD, dynamic basket liquidator,
                    and built-in cloud config sync listener for HFM MetaTrader 5.
                  </p>
                </div>

                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <a
                    href="/TMS_Quantum_EA.mq5"
                    download="TMS_Quantum_EA.mq5"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:brightness-110 active:scale-95"
                  >
                    <HardDriveDownload className="size-4" />
                    Download .mq5 EA
                  </a>
                </div>
              </div>
            </div>

            {/* Quick 4-step Installation Walkthrough */}
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                How to Install & Run in MetaTrader 5
              </h4>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold text-cyan-400">
                    1
                  </div>
                  <h5 className="text-xs font-semibold text-zinc-200">Copy to MT5 Folder</h5>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    In MT5, click <b>File &rarr; Open Data Folder</b>, navigate to <code>MQL5/Experts/</code>, and paste <code>TMS_Quantum_EA.mq5</code>.
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold text-cyan-400">
                    2
                  </div>
                  <h5 className="text-xs font-semibold text-zinc-200">Compile in MetaEditor</h5>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    Press <b>F4</b> in MT5 to open MetaEditor. Open <code>TMS_Quantum_EA.mq5</code> and press <b>F7 (Compile)</b>. Zero errors!
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold text-cyan-400">
                    3
                  </div>
                  <h5 className="text-xs font-semibold text-zinc-200">Attach to Chart</h5>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    From the MT5 Navigator panel, drag <b>TMS_Quantum_EA</b> onto your <b>XAUUSD (M15 or M5)</b> chart.
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold text-cyan-400">
                    4
                  </div>
                  <h5 className="text-xs font-semibold text-zinc-200">Enable Algo Trading</h5>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    Click <b>Algo Trading</b> button on MT5 toolbar. The On-Chart HUD will activate and synchronize settings!
                  </p>
                </div>
              </div>
            </div>

            {/* Dedicated BTCUSD Backtest Pro Guide */}
            <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/20 via-zinc-900/50 to-zinc-950 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="size-5 text-amber-400" />
                <h4 className="text-sm font-bold text-amber-300">
                  🎯 MT5 Strategy Tester Guide for BTCUSD (High Accuracy Backtesting)
                </h4>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                ทำไม <b>BTCUSD</b> ถึงเหมาะที่สุดสำหรับการ Backtest ใน MT5? เพราะตลาดคริปโตเปิดเทรด <b>24/7/365 ตลอดทั้งสัปดาห์ไม่มีวันหยุดเสาร์-อาทิตย์</b> ทำให้ได้ชุดข้อมูลแท่งเทียนต่อเนื่องสมบูรณ์แบบโดยไม่มี Gap ราคาข้ามสัปดาห์!
              </p>

              <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
                <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-3">
                  <div className="text-[10px] uppercase font-bold text-amber-400">1. Symbol & Timeframe</div>
                  <div className="mt-1 text-xs font-semibold text-zinc-200">BTCUSD @ M15</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">หรือ H1 สำหรับเทรนด์ยาว / M5 สำหรับสเกลป์เร็ว</div>
                </div>

                <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-3">
                  <div className="text-[10px] uppercase font-bold text-amber-400">2. Modeling Quality</div>
                  <div className="mt-1 text-xs font-semibold text-zinc-200">Every tick based on real ticks</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">หรือ 1 minute OHLC เพื่อความเร็วสูงสุด</div>
                </div>

                <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-3">
                  <div className="text-[10px] uppercase font-bold text-amber-400">3. Auto Point Scaling</div>
                  <div className="mt-1 text-xs font-semibold text-emerald-400">InpAutoAssetScaling = true</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">EA ปรับสเกลระยะจุด (Points) ตามราคาบิตคอยน์อัตโนมัติ</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer / Global Save Bar */}
      <div className="flex flex-col gap-3 border-t border-zinc-800/80 bg-zinc-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="flex size-2 rounded-full bg-emerald-400" />
          <span>Real-time Cloud Sync Ready (Writes directly to MT5 Common Files & Supabase)</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChange({ advancedParams: DEFAULT_ADVANCED_PARAMS })}
            className="rounded-lg border border-zinc-800 px-3 py-2 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            Reset Defaults
          </button>

          <button
            type="button"
            onClick={handleSaveClick}
            disabled={isSavingLocal || isSyncing}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            {isSavingLocal || isSyncing ? (
              <RefreshCw className="size-4 animate-spin text-white" />
            ) : (
              <CheckCircle2 className="size-4 text-white" />
            )}
            <span>Save & Sync to MT5 EA</span>
          </button>
        </div>
      </div>
    </Card>
  );
}
