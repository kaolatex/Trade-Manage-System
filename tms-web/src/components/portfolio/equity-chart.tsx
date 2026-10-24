'use client';

import { useMemo } from 'react';
import { useTrading } from '@/context/trading-context';
import { useLanguage } from '@/context/language-context';
import { Card, CardHeader } from '@/components/ui/card';
import { TrendingUp, UserCheck, Bot, Globe } from 'lucide-react';
import { fmtDate, fmtMoney } from '@/lib/utils';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { date: number; equity: number } }>;
  accentColor?: string;
}

function CustomTooltip({ active, payload, accentColor = '#10b981' }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;

  return (
    <div className="rounded-xl border border-zinc-700/80 bg-surface/95 p-2.5 shadow-xl backdrop-blur-md">
      <div className="text-[10px] text-zinc-400">{fmtDate(data.date)}</div>
      <div className="num mt-0.5 text-sm font-bold" style={{ color: accentColor }}>
        {fmtMoney(data.equity)}
      </div>
    </div>
  );
}

export function EquityChart() {
  const { state } = useTrading();
  const { t } = useLanguage();
  const viewMode = state.portfolioViewMode;
  const currentAccount = state.accounts[state.selectedAccountId];

  const chartTheme = useMemo(() => {
    if (viewMode === 'manual') {
      return {
        color: '#06b6d4',
        gradientId: 'manualGradient',
        tag: '🖐️ MANUAL EQUITY',
        tagClass: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
        icon: UserCheck,
      };
    }
    if (viewMode === 'bot') {
      return {
        color: '#8b5cf6',
        gradientId: 'botGradient',
        tag: '🤖 BOT SYSTEM EQUITY',
        tagClass: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
        icon: Bot,
      };
    }
    return {
      color: '#10b981',
      gradientId: 'combinedGradient',
      tag: '🌐 COMBINED TOTAL',
      tagClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      icon: Globe,
    };
  }, [viewMode]);

  const rawHistory = useMemo(() => {
    if (viewMode === 'manual' && currentAccount.equityHistoryManual) {
      return currentAccount.equityHistoryManual;
    }
    if (viewMode === 'bot' && currentAccount.equityHistoryBot) {
      return currentAccount.equityHistoryBot;
    }
    return currentAccount.equityHistory;
  }, [viewMode, currentAccount]);

  const chartData = useMemo(() => {
    const list = [...rawHistory];
    const latest = list[list.length - 1]?.equity || currentAccount.balance;
    return [
      ...list,
      {
        date: Date.now(),
        equity: latest,
      },
    ];
  }, [rawHistory, currentAccount.balance]);

  const minEquity = useMemo(() => {
    const min = Math.min(...chartData.map((d) => d.equity));
    return Math.floor(min * 0.985);
  }, [chartData]);

  const maxEquity = useMemo(() => {
    const max = Math.max(...chartData.map((d) => d.equity));
    return Math.ceil(max * 1.015);
  }, [chartData]);

  const initialVal = chartData[0]?.equity || 10000;
  const currentVal = chartData[chartData.length - 1]?.equity || 10000;
  const growth = ((currentVal - initialVal) / initialVal) * 100;
  const netGain = currentVal - initialVal;

  return (
    <Card className="flex flex-col p-0">
      <CardHeader
        title={
          viewMode === 'manual'
            ? 'Manual Trading Equity Trajectory'
            : viewMode === 'bot'
              ? 'Bot Algorithmic Performance Trajectory'
              : t.equityChart.title
        }
        subtitle={
          viewMode === 'manual'
            ? 'เส้นทางกำไรสุทธิเฉพาะออเดอร์ที่กดมือเอง (Discretionary Edge)'
            : viewMode === 'bot'
              ? 'เส้นทางกำไรสุทธิเฉพาะออเดอร์ที่บอทส่งคำสั่งอัตโนมัติ (Systematic Edge)'
              : t.equityChart.subtitle
        }
        icon={<TrendingUp style={{ color: chartTheme.color }} />}
        action={
          <div className="flex items-center gap-2">
            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${chartTheme.tagClass}`}>
              {chartTheme.tag}
            </span>
            <span
              className="num rounded-md px-2 py-0.5 text-xs font-semibold"
              style={{
                backgroundColor: `${chartTheme.color}20`,
                color: chartTheme.color,
              }}
            >
              {growth >= 0 ? `+${growth.toFixed(2)}%` : `${growth.toFixed(2)}%`} ({fmtMoney(netGain, { sign: true })})
            </span>
          </div>
        }
      />

      <div className="h-72 w-full px-2 pb-4 pt-4 sm:h-80 sm:px-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={chartTheme.gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartTheme.color} stopOpacity={0.35} />
                <stop offset="90%" stopColor={chartTheme.color} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#27272a"
              vertical={false}
              opacity={0.6}
            />
            <XAxis
              dataKey="date"
              tickFormatter={(ts) => fmtDate(ts)}
              stroke="#52525b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dy={8}
            />
            <YAxis
              domain={[minEquity, maxEquity]}
              tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
              stroke="#52525b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dx={-4}
            />
            <Tooltip content={<CustomTooltip accentColor={chartTheme.color} />} />
            <Area
              type="monotone"
              dataKey="equity"
              stroke={chartTheme.color}
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#${chartTheme.gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
