'use client';

import { useState } from 'react';
import { useTrading } from '@/context/trading-context';
import { useLanguage } from '@/context/language-context';
import { ManualJournalTable } from './manual-journal-table';
import { BotLedgerTable } from './bot-ledger-table';
import { Card, CardHeader } from '@/components/ui/card';
import { BookOpen, UserCheck, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TradingJournal() {
  const { state } = useTrading();
  const { t } = useLanguage();
  const [combinedSubTab, setCombinedSubTab] = useState<'manual' | 'bot'>('manual');
  const viewMode = state.portfolioViewMode;

  const currentAccount = state.accounts[state.selectedAccountId];
  const manualCount = currentAccount.journal.filter((j) => j.execution_type === 'MANUAL').length;
  const botCount = currentAccount.journal.filter((j) => j.execution_type === 'BOT').length;

  if (viewMode === 'manual') {
    return <ManualJournalTable standalone={true} />;
  }

  if (viewMode === 'bot') {
    return <BotLedgerTable standalone={true} />;
  }

  // Combined Mode: Unified Card with Dedicated Sub-Tabs for the 2 distinct tables
  return (
    <Card className="p-0">
      <CardHeader
        title={t.journal.title}
        subtitle={t.journal.subtitle}
        icon={<BookOpen />}
        action={
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-1">
            <button
              type="button"
              onClick={() => setCombinedSubTab('manual')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all',
                combinedSubTab === 'manual'
                  ? 'bg-cyan-500/20 text-cyan-300 shadow-sm border border-cyan-500/30'
                  : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              <UserCheck className="size-3 text-cyan-400" />
              <span>{t.manualJournal.title.split('(')[0].trim()} ({manualCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setCombinedSubTab('bot')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all',
                combinedSubTab === 'bot'
                  ? 'bg-violet-500/20 text-violet-300 shadow-sm border border-violet-500/30'
                  : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              <Bot className="size-3 text-violet-400" />
              <span>{t.botLedger.title.split('(')[0].trim()} ({botCount})</span>
            </button>
          </div>
        }
      />

      <div className="p-0">
        {combinedSubTab === 'manual' ? (
          <ManualJournalTable standalone={false} />
        ) : (
          <BotLedgerTable standalone={false} />
        )}
      </div>
    </Card>
  );
}
