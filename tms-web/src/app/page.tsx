'use client';

import { MasterViewSwitcher } from '@/components/portfolio/master-view-switcher';
import { OverviewCards } from '@/components/portfolio/overview-cards';
import { EquityChart } from '@/components/portfolio/equity-chart';
import { SessionStats } from '@/components/portfolio/session-stats';
import { ActivePositionsTable } from '@/components/portfolio/active-positions-table';
import { TradingJournal } from '@/components/portfolio/trading-journal';
import { SectionLabel } from '@/components/ui/card';
import { useLanguage } from '@/context/language-context';
import { LayoutDashboard, TrendingUp, Layers, BookOpen } from 'lucide-react';

export default function PortfolioPage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">
            {t.portfolioPage.title}
          </h1>
          <p className="text-xs text-zinc-400">
            {t.portfolioPage.subtitle}
          </p>
        </div>
      </div>

      {/* Master View Switcher (Hard Separation of Manual / Bot / Combined) */}
      <MasterViewSwitcher />

      {/* 1. Account Overview Cards */}
      <section className="space-y-2.5">
        <SectionLabel
          title={t.portfolioPage.overviewSection}
          icon={<LayoutDashboard />}
          hint={t.portfolioPage.mt5LiveSync}
        />
        <OverviewCards />
      </section>

      {/* 2. Performance & Session Analytics */}
      <section className="space-y-2.5">
        <SectionLabel
          title={t.portfolioPage.performanceSection}
          icon={<TrendingUp />}
          hint={t.portfolioPage.trajectoryHint}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Left 2/3: Equity Curve Area Chart */}
          <div className="lg:col-span-2">
            <EquityChart />
          </div>
          {/* Right 1/3: Session Breakdown Stats */}
          <div className="lg:col-span-1">
            <SessionStats />
          </div>
        </div>
      </section>

      {/* 3. Active Positions Table */}
      <section className="space-y-2.5">
        <SectionLabel
          title={t.portfolioPage.activePositionsSection}
          icon={<Layers />}
          hint={t.portfolioPage.activeExposureHint}
        />
        <ActivePositionsTable />
      </section>

      {/* 4. Auto-Trading Journal & Personal Note */}
      <section className="space-y-2.5">
        <SectionLabel
          title={t.portfolioPage.journalSection}
          icon={<BookOpen />}
          hint={t.portfolioPage.journalHint}
        />
        <TradingJournal />
      </section>
    </div>
  );
}
