'use client';

import { useState } from 'react';
import { useTrading } from '@/context/trading-context';
import { useLanguage } from '@/context/language-context';
import { EnvironmentBanner } from '@/components/bot/environment-banner';
import { StrategyConfig } from '@/components/bot/strategy-config';
import { RiskGuard } from '@/components/bot/risk-guard';
import { LiveTerminal } from '@/components/bot/live-terminal';
import { RecentBotExecutions } from '@/components/bot/recent-bot-executions';
import { SectionLabel } from '@/components/ui/card';
import { Cpu, Terminal, History } from 'lucide-react';
import { BotConfig } from '@/lib/types';

export default function BotSystemPage() {
  const { state, saveConfig } = useTrading();
  const { t } = useLanguage();
  const [localConfig, setLocalConfig] = useState<BotConfig>(state.config);

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
            {t.botPage.subtitle}
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

      {/* 2 & 3. Strategy Configuration & Risk Guard (2 columns on large screens) */}
      <section className="space-y-2.5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Strategy & Execution Form */}
          <StrategyConfig
            config={localConfig}
            onChange={handleConfigPatch}
          />

          {/* Risk & Money Management Guard */}
          <RiskGuard
            config={localConfig}
            onChange={handleConfigPatch}
            onSave={handleSave}
          />
        </div>
      </section>

      {/* 4. Real-time Bot Terminal (Live Console Logs) */}
      <section className="space-y-2.5">
        <SectionLabel
          title={t.botPage.terminalSection}
          icon={<Terminal />}
          hint={t.botPage.terminalHint}
        />
        <LiveTerminal />
      </section>

      {/* 5. Recent Bot-Only Executions (Hard separation, purely bot orders) */}
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
