'use client';

import { useState, useEffect } from 'react';
import { useTrading } from '@/context/trading-context';
import { useLanguage } from '@/context/language-context';
import { EnvironmentBanner } from '@/components/bot/environment-banner';
import { DeepParameterStudio } from '@/components/bot/deep-parameter-studio';
import { LiveTerminal } from '@/components/bot/live-terminal';
import { RecentBotExecutions } from '@/components/bot/recent-bot-executions';
import { SectionLabel } from '@/components/ui/card';
import { Cpu, Terminal, History, SlidersHorizontal } from 'lucide-react';
import { BotConfig } from '@/lib/types';

export default function BotSystemPage() {
  const { state, saveConfig } = useTrading();
  const { t } = useLanguage();
  const [localConfig, setLocalConfig] = useState<BotConfig>(state.config);

  // Keep local form in sync when cloud/bridge hydrates config
  useEffect(() => {
    if (state.config) {
      setLocalConfig(state.config);
    }
  }, [state.config]);

  const handleConfigPatch = (patch: Partial<BotConfig>) => {
    setLocalConfig((prev) => ({ ...prev, ...patch }));
  };

  const handleSave = async () => {
    await saveConfig(localConfig);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">
            {t.botPage.title}
          </h1>
          <p className="text-xs text-zinc-400">
            {t.botPage.subtitle} — Hybrid Native MQL5 EA + Cloud Deep Config System
          </p>
        </div>
      </div>

      {/* 1. Master Control & Environment Banner */}
      <section className="space-y-2.5">
        <SectionLabel
          title={t.botPage.masterControlSection}
          icon={<Cpu />}
          hint={t.botPage.masterControlHint}
        />
        <EnvironmentBanner />
      </section>

      {/* 2. Pro EA Deep Parameter Studio (Native MQL5 & Cloud Config 5-Tab System) */}
      <section className="space-y-2.5">
        <SectionLabel
          title="EA Deep Customization Studio"
          icon={<SlidersHorizontal className="text-cyan-400" />}
          hint="Deep parameter tuning for Aggressive Scalper, Adaptive Quant, Basket TP, and MT5 .mq5 EA exporter"
        />
        <DeepParameterStudio
          config={localConfig}
          onChange={handleConfigPatch}
          onSave={handleSave}
          isSyncing={state.isSyncing}
        />
      </section>

      {/* 3. Real-time Bot Terminal (Live Console Logs) */}
      <section className="space-y-2.5">
        <SectionLabel
          title={t.botPage.terminalSection}
          icon={<Terminal />}
          hint={t.botPage.terminalHint}
        />
        <LiveTerminal />
      </section>

      {/* 4. Recent Bot-Only Executions (Hard separation, purely bot orders) */}
      <section className="space-y-2.5">
        <SectionLabel
          title={t.recentBotExecutions.title}
          icon={<History className="text-violet-400" />}
          hint={t.recentBotExecutions.subtitle}
        />
        <RecentBotExecutions />
      </section>
    </div>
  );
}
