'use client';

import { useTrading } from '@/context/trading-context';
import { useLanguage } from '@/context/language-context';
import { Card, CardHeader } from '@/components/ui/card';
import { BotLedgerTable } from '@/components/portfolio/bot-ledger-table';
import { Bot, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function RecentBotExecutions() {
  const { state } = useTrading();
  const { t } = useLanguage();
  const currentAccount = state.accounts[state.selectedAccountId];
  const botTrades = currentAccount.journal.filter((j) => j.execution_type === 'BOT');

  return (
    <Card className="p-0 border-violet-500/20">
      <CardHeader
        title={t.recentBotExecutions.title}
        subtitle={t.recentBotExecutions.subtitle}
        icon={<Bot className="text-violet-400" />}
        action={
          <div className="flex items-center gap-2">
            <span className="num rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-300">
              🤖 {botTrades.length} {t.common.trades}
            </span>
            <Link
              href="/"
              className="hidden items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 sm:flex"
            >
              <span>{t.recentBotExecutions.viewAllLedger}</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>
        }
      />
      <BotLedgerTable standalone={false} limit={6} />
    </Card>
  );
}
