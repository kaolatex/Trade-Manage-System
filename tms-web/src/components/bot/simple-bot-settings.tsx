'use client';

import { useState } from 'react';
import { BotConfig, AdvancedEaParams, DEFAULT_ADVANCED_PARAMS } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { NumberInput, ToggleRow } from '@/components/ui/form';
import { useTrading } from '@/context/trading-context';
import { cn } from '@/lib/utils';
import {
  Zap,
  Flame,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CircleDollarSign,
} from 'lucide-react';
import { DeepParameterStudio } from './deep-parameter-studio';

interface SimpleBotSettingsProps {
  config: BotConfig;
  onChange: (patch: Partial<BotConfig>) => void;
  onSave: () => Promise<void>;
  isSyncing?: boolean;
}

export function SimpleBotSettings({
  config,
  onChange,
  onSave,
  isSyncing = false,
}: SimpleBotSettingsProps) {
  const { simulateSignal, isSimulating } = useTrading();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<'fast' | 'balanced' | 'safe'>('fast');
  const [isSavingLocal, setIsSavingLocal] = useState(false);

  const adv: AdvancedEaParams = config.advancedParams || DEFAULT_ADVANCED_PARAMS;

  // Shortcut helpers for the 4 core settings
  const currentLot = adv.layering.baseLot ?? 0.01;
  const currentMaxLayers = adv.layering.maxLayers ?? 5;
  const currentBasketTp = adv.basket.basketTargetUsd ?? 10.0;
  const currentInstantBE = adv.basket.useInstantSmartBE ?? true;
  const currentQuantFilter = adv.strategy.use3000BarQuantFilter ?? false;

  // 1-Click Preset Applier
  const applyPreset = (preset: 'fast' | 'balanced' | 'safe') => {
    setSelectedPreset(preset);

    if (preset === 'fast') {
      // Fast Scalper: High frequency, low barriers, fast profit locks
      const updatedAdv: AdvancedEaParams = {
        ...adv,
        strategy: {
          ...adv.strategy,
          strategyMode: 'MODE_AGGRESSIVE_SCALPER',
          useMultiEmaRibbon: false, // Relaxed EMA 9/21 momentum for immediate action
          use3000BarQuantFilter: false, // No empirical barrier blocking entries
        },
        layering: {
          ...adv.layering,
          lotMode: 'fixed',
          baseLot: 0.01,
          maxLayers: 5,
          lotMultiplier: 1.0,
          minStepPoints: 80,
          layerCooldownSec: 15,
        },
        basket: {
          ...adv.basket,
          useBasketClose: true,
          basketTargetUsd: 5.0, // Quick $5 liquidator
          useInstantSmartBE: true,
          instantBeMinUsd: 0.30,
        },
      };
      onChange({
        strategyMode: 'MODE_AGGRESSIVE_SCALPER',
        fixedLot: 0.01,
        maxConcurrent: 5,
        advancedParams: updatedAdv,
      });
    } else if (preset === 'balanced') {
      // Balanced Quant: EMA Ribbon trend filter + moderate 3,000-bar quant validation
      const updatedAdv: AdvancedEaParams = {
        ...adv,
        strategy: {
          ...adv.strategy,
          strategyMode: 'MODE_AGGRESSIVE_SCALPER',
          useMultiEmaRibbon: true,
          use3000BarQuantFilter: true,
          minWinProbabilityPct: 55.0,
          forwardHorizonBars: 10,
        },
        layering: {
          ...adv.layering,
          lotMode: 'fixed',
          baseLot: 0.01,
          maxLayers: 3,
          lotMultiplier: 1.0,
          minStepPoints: 120,
          layerCooldownSec: 30,
        },
        basket: {
          ...adv.basket,
          useBasketClose: true,
          basketTargetUsd: 15.0,
          useInstantSmartBE: true,
          instantBeMinUsd: 0.50,
        },
      };
      onChange({
        strategyMode: 'MODE_AGGRESSIVE_SCALPER',
        fixedLot: 0.01,
        maxConcurrent: 3,
        advancedParams: updatedAdv,
      });
    } else if (preset === 'safe') {
      // Conservative Safe: Moderate win rate statistical threshold (60%+) & capital safety
      const updatedAdv: AdvancedEaParams = {
        ...adv,
        strategy: {
          ...adv.strategy,
          strategyMode: 'MODE_ADAPTIVE_QUANT',
          useMultiEmaRibbon: true,
          use3000BarQuantFilter: true,
          minWinProbabilityPct: 60.0,
          forwardHorizonBars: 10,
          lookbackBars: 3000,
        },
        layering: {
          ...adv.layering,
          lotMode: 'fixed',
          baseLot: 0.01,
          maxLayers: 2,
          lotMultiplier: 1.0,
          minStepPoints: 200,
          layerCooldownSec: 60,
        },
        basket: {
          ...adv.basket,
          useBasketClose: true,
          basketTargetUsd: 25.0,
          useInstantSmartBE: true,
          instantBeMinUsd: 1.0,
        },
      };
      onChange({
        strategyMode: 'MODE_ADAPTIVE_QUANT',
        fixedLot: 0.01,
        maxConcurrent: 2,
        advancedParams: updatedAdv,
      });
    }
  };

  const patchSimpleField = (field: 'lot' | 'layers' | 'basketTp' | 'be' | 'quant', value: any) => {
    const updatedAdv = { ...adv };

    if (field === 'lot') {
      updatedAdv.layering = { ...updatedAdv.layering, baseLot: Number(value) };
      onChange({ fixedLot: Number(value), advancedParams: updatedAdv });
    } else if (field === 'layers') {
      updatedAdv.layering = { ...updatedAdv.layering, maxLayers: Number(value) };
      onChange({ maxConcurrent: Number(value), advancedParams: updatedAdv });
    } else if (field === 'basketTp') {
      updatedAdv.basket = { ...updatedAdv.basket, basketTargetUsd: Number(value), useBasketClose: true };
      onChange({ advancedParams: updatedAdv });
    } else if (field === 'be') {
      updatedAdv.basket = {
        ...updatedAdv.basket,
        useInstantSmartBE: Boolean(value),
        useAutoBreakEven: Boolean(value),
      };
      onChange({ autoBE: Boolean(value), advancedParams: updatedAdv });
    } else if (field === 'quant') {
      updatedAdv.strategy = {
        ...updatedAdv.strategy,
        use3000BarQuantFilter: Boolean(value),
      };
      onChange({ advancedParams: updatedAdv });
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

  return (
    <div className="space-y-4">
      {/* 1. Quick Master Deck */}
      <Card className="border-zinc-800/90 bg-gradient-to-b from-zinc-950 via-zinc-900/60 to-zinc-950 p-5 shadow-2xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-profit/10 border border-profit/20 text-profit">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                ตั้งค่าบอทแบบง่าย (Quick Smart Controls)
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                  Easy Mode
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                เลือกสไตล์การเทรด 1-Click หรือปรับแต่งเฉพาะ 4 ตัวเลขหลัก บอทจะซิงค์เข้า MT5 ทันที
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Test Fire 0.01 Lot Button */}
            <button
              type="button"
              onClick={simulateSignal}
              disabled={isSimulating}
              className={cn(
                'flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-300 transition-all hover:bg-amber-500/20 active:scale-95 disabled:opacity-50',
                isSimulating && 'animate-pulse',
              )}
              title="ยิงคำสั่ง 0.01 Lot ทดสอบเข้า MT5 ทันที"
            >
              <Zap className="size-3.5 text-amber-400" />
              <span>{isSimulating ? 'กำลังยิงเข้า MT5...' : '🧪 Test Fire 0.01 Lot'}</span>
            </button>

            {/* Save & Apply Button */}
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={isSavingLocal || isSyncing}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              {isSavingLocal || isSyncing ? (
                <RefreshCw className="size-3.5 animate-spin text-white" />
              ) : (
                <CheckCircle2 className="size-3.5 text-white" />
              )}
              <span>บันทึกเข้า MT5</span>
            </button>
          </div>
        </div>

        {/* Preset Selector Cards */}
        <div className="mt-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-2.5">
            <Flame className="size-3.5 text-amber-400" />
            1. เลือกสไตล์การเทรด (1-Click Strategy Presets):
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Preset 1: Fast Scalper */}
            <div
              onClick={() => applyPreset('fast')}
              className={cn(
                'group relative cursor-pointer rounded-xl border p-3.5 transition-all duration-200 select-none',
                selectedPreset === 'fast'
                  ? 'border-profit bg-profit/10 ring-1 ring-profit/50 shadow-lg shadow-profit/10'
                  : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-800/40',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-profit">
                  <Zap className="size-4" />
                  ⚡ Fast Scalper (แนะนำ)
                </span>
                {selectedPreset === 'fast' && (
                  <span className="size-2 rounded-full bg-profit animate-pulse" />
                )}
              </div>
              <p className="mt-1 text-[11px] text-zinc-300 font-medium leading-snug">
                ยิงไว สเกลป์สั้น ล็อกกำไรเร็ว
              </p>
              <p className="mt-1 text-[10px] text-zinc-500 leading-tight">
                ลดเงื่อนไขตึงเกินไป เข้าเมื่อมีโมเมนตัม ปิดรวบกำไรสั้น $5
              </p>
            </div>

            {/* Preset 2: Balanced Quant */}
            <div
              onClick={() => applyPreset('balanced')}
              className={cn(
                'group relative cursor-pointer rounded-xl border p-3.5 transition-all duration-200 select-none',
                selectedPreset === 'balanced'
                  ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/50 shadow-lg shadow-sky-500/10'
                  : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-800/40',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                  <SlidersHorizontal className="size-4" />
                  🎯 Balanced Quant
                </span>
                {selectedPreset === 'balanced' && (
                  <span className="size-2 rounded-full bg-sky-400 animate-pulse" />
                )}
              </div>
              <p className="mt-1 text-[11px] text-zinc-300 font-medium leading-snug">
                สมดุล แม่นยำ เทรนด์ชัด
              </p>
              <p className="mt-1 text-[10px] text-zinc-500 leading-tight">
                กรองเทรนด์ EMA Ribbon + สถิติ 3,000 แท่ง เป้ากำไร $15
              </p>
            </div>

            {/* Preset 3: Conservative Safe */}
            <div
              onClick={() => applyPreset('safe')}
              className={cn(
                'group relative cursor-pointer rounded-xl border p-3.5 transition-all duration-200 select-none',
                selectedPreset === 'safe'
                  ? 'border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/50 shadow-lg shadow-violet-500/10'
                  : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-800/40',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-violet-400">
                  <ShieldCheck className="size-4" />
                  🛡️ Conservative Safe
                </span>
                {selectedPreset === 'safe' && (
                  <span className="size-2 rounded-full bg-violet-400 animate-pulse" />
                )}
              </div>
              <p className="mt-1 text-[11px] text-zinc-300 font-medium leading-snug">
                ความปลอดภัยสูง คัดไม้เน้นๆ
              </p>
              <p className="mt-1 text-[10px] text-zinc-500 leading-tight">
                เข้าเฉพาะจังหวะสถิติชนะ 75%+ คุม Drawdown ต่ำสุด
              </p>
            </div>
          </div>
        </div>

        {/* 2. Simple Parameters (4 กล่องหลัก) */}
        <div className="mt-5 border-t border-zinc-800/80 pt-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-3">
            <CircleDollarSign className="size-3.5 text-emerald-400" />
            2. พารามิเตอร์หลัก (ปรับแต่งตามต้องการ):
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Box 1: Lot Size */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200">ขนาด Lot (Lot Size)</span>
                <span className="text-[10px] text-zinc-500">ไม้ที่ 1</span>
              </div>
              <NumberInput
                value={currentLot}
                onChange={(v) => patchSimpleField('lot', v)}
                step={0.01}
                min={0.01}
                max={5.0}
              />
              <div className="flex items-center gap-1 pt-1">
                {[0.01, 0.02, 0.05, 0.10].map((quickLot) => (
                  <button
                    key={quickLot}
                    type="button"
                    onClick={() => patchSimpleField('lot', quickLot)}
                    className={cn(
                      'flex-1 rounded-md py-1 text-[10px] font-semibold transition-colors',
                      currentLot === quickLot
                        ? 'bg-zinc-200 text-ink'
                        : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200',
                    )}
                  >
                    {quickLot}
                  </button>
                ))}
              </div>
            </div>

            {/* Box 2: Max Layers */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200">จำนวนไม้สูงสุด (Max Layers)</span>
                <span className="text-[10px] text-zinc-500">สะสมไม่เกิน</span>
              </div>
              <NumberInput
                value={currentMaxLayers}
                onChange={(v) => patchSimpleField('layers', v)}
                step={1}
                min={1}
                max={15}
                suffix="ไม้"
              />
              <div className="flex items-center gap-1 pt-1">
                {[1, 3, 5, 10].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => patchSimpleField('layers', l)}
                    className={cn(
                      'flex-1 rounded-md py-1 text-[10px] font-semibold transition-colors',
                      currentMaxLayers === l
                        ? 'bg-zinc-200 text-ink'
                        : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200',
                    )}
                  >
                    {l} ไม้
                  </button>
                ))}
              </div>
            </div>

            {/* Box 3: Basket TP Target ($ USD) */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200">เป้ารวบกำไรยกพอร์ต (Basket TP)</span>
                <span className="text-[10px] text-emerald-400 font-bold">Liquidator</span>
              </div>
              <NumberInput
                value={currentBasketTp}
                onChange={(v) => patchSimpleField('basketTp', v)}
                step={1}
                min={1}
                max={500}
                suffix="$ USD"
              />
              <div className="flex items-center gap-1 pt-1">
                {[5, 10, 15, 30].map((tp) => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => patchSimpleField('basketTp', tp)}
                    className={cn(
                      'flex-1 rounded-md py-1 text-[10px] font-semibold transition-colors',
                      currentBasketTp === tp
                        ? 'bg-profit text-ink font-bold'
                        : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200',
                    )}
                  >
                    ${tp}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Safety Switches */}
          <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <ToggleRow
                id="simple-be-toggle"
                title="🔒 ระบบกันทุนอัตโนมัติ (Instant Break-Even)"
                description="เลื่อน Stop Loss เข้าทุนทันทีเมื่อเริ่มมีกำไร เพื่อให้ไม้ที่เปิดอยู่ไร้ความเสี่ยง (0% Risk)"
                checked={currentInstantBE}
                onChange={(v) => patchSimpleField('be', v)}
                tone="profit"
              />
            </div>

            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
              <ToggleRow
                id="simple-quant-toggle"
                title="⚡ 3,000-Bar Historical Quant Filter"
                description="สแกนแท่งเทียน 3,000 แท่งย้อนหลังก่อนยิง (ปิดได้เพื่อให้บอทออกไม้ไวทันใจใน M1)"
                checked={currentQuantFilter}
                onChange={(v) => patchSimpleField('quant', v)}
                tone="warn"
              />
            </div>
          </div>
        </div>

        {/* Pro Accordion Expander */}
        <div className="mt-5 border-t border-zinc-800/80 pt-3">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex w-full items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/30 px-4 py-2.5 text-xs font-semibold text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-zinc-200"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-cyan-400" />
              <span>การตั้งค่าเชิงลึกสำหรับผู้ใช้ขั้นสูง (5-Tab Pro Parameter Studio)</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-zinc-500">
              <span>{showAdvanced ? 'ย่อหน้าจอ' : 'คลิกเพื่อดูการตั้งค่าทั้งหมด'}</span>
              {showAdvanced ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </div>
          </button>
        </div>
      </Card>

      {/* 2. Collapsible Pro Parameter Studio */}
      {showAdvanced && (
        <div className="animate-in fade-in-50 slide-in-from-top-2 duration-300">
          <DeepParameterStudio
            config={config}
            onChange={onChange}
            onSave={onSave}
            isSyncing={isSyncing}
          />
        </div>
      )}
    </div>
  );
}
