'use client';

import { useState } from 'react';
import { useTrading } from '@/context/trading-context';
import { useLanguage } from '@/context/language-context';
import { Card, CardHeader } from '@/components/ui/card';
import { SideBadge } from '@/components/ui/badge';
import { Bot, Edit3, Check, X, Cpu, Activity } from 'lucide-react';
import { fmtDate, fmtHM, fmtMoney } from '@/lib/utils';
import { fmtPrice } from '@/lib/market';
import { JournalEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

export function BotLedgerTable({
  standalone = true,
  limit,
}: {
  standalone?: boolean;
  limit?: number;
}) {
  const { state, patchJournal } = useTrading();
  const { t } = useLanguage();
  const currentAccount = state.accounts[state.selectedAccountId] || state.accounts.all;
  const journal = currentAccount?.journal || [];

  let botTrades = journal.filter(
    (j) => j.execution_type === 'BOT',
  );

  if (limit && limit > 0) {
    botTrades = botTrades.slice(0, limit);
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAudit, setEditAudit] = useState<string>('');
  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  const handleStartEdit = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setEditAudit(entry.auditNote || entry.note || '');
  };

  const handleSaveAudit = (id: string) => {
    patchJournal(state.selectedAccountId, id, {
      auditNote: editAudit.trim(),
      note: editAudit.trim(),
    });
    setEditingId(null);
    setJustSavedId(id);
    setTimeout(() => setJustSavedId(null), 2500);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditAudit('');
  };

  const content = (
    <>
      {botTrades.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <Bot className="size-8 text-zinc-600 mb-2" />
          <p className="text-sm font-medium text-zinc-400">{t.botLedger.empty}</p>
          <p className="mt-1 text-xs text-zinc-600">
            {t.viewSwitcher.botDesc}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800/80 bg-violet-950/20 text-[10px] uppercase tracking-wider text-violet-400/80">
              <tr>
                <th className="px-4 py-3 font-semibold">{t.botLedger.colTimestamp}</th>
                <th className="px-3 py-3 font-semibold">{t.botLedger.colTicketMagic}</th>
                <th className="px-3 py-3 font-semibold">{t.botLedger.colSymbolTF}</th>
                <th className="px-3 py-3 font-semibold">{t.botLedger.colType}</th>
                <th className="px-3 py-3 font-semibold">{t.botLedger.colLot}</th>
                <th className="px-3 py-3 font-semibold">{t.botLedger.colEntryExit}</th>
                <th className="px-3 py-3 font-semibold">{t.botLedger.colSlippageSpread}</th>
                <th className="px-3 py-3 font-semibold">{t.botLedger.colNetPnl}</th>
                <th className="px-3 py-3 font-semibold min-w-[200px]">{t.botLedger.colTriggerLogic}</th>
                <th className="px-4 py-3 font-semibold min-w-[220px]">{t.botLedger.colAuditNote}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {botTrades.map((entry) => {
                const isProfit = entry.pnl >= 0;
                const isEditing = editingId === entry.id;
                const isJustSaved = justSavedId === entry.id;
                const tf = entry.timeframe || 'M15';
                const slip = entry.slippageSpreadPts ?? 14;
                const magic = entry.magicNumber || 123456;

                return (
                  <tr
                    key={entry.id}
                    className="transition-colors hover:bg-zinc-850/40"
                  >
                    {/* 1. Timestamp */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-medium text-zinc-300">
                        {fmtDate(entry.closeTime)}
                      </div>
                      <div className="num text-[10px] text-zinc-500">
                        {fmtHM(entry.closeTime)}
                      </div>
                    </td>

                    {/* 2. Ticket & Magic ID */}
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <div className="font-semibold text-zinc-200">
                        #{entry.ticket}
                      </div>
                      <div className="num text-[10px] text-violet-400">
                        MID: {magic}
                      </div>
                    </td>

                    {/* 3. Symbol & TF */}
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-zinc-200">{entry.symbol}</span>
                        <span className="num rounded bg-violet-500/10 px-1 py-0.2 text-[9px] font-bold text-violet-300 border border-violet-500/20">
                          {tf}
                        </span>
                      </div>
                    </td>

                    {/* 4. Type */}
                    <td className="px-3 py-3.5">
                      <SideBadge side={entry.type} />
                    </td>

                    {/* 5. Lot */}
                    <td className="num px-3 py-3.5 font-medium text-zinc-300">
                      {entry.lot.toFixed(2)}
                    </td>

                    {/* 6. Entry -> Exit */}
                    <td className="num px-3 py-3.5 text-zinc-300 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{fmtPrice(entry.entry, entry.symbol)}</span>
                        <span className="text-zinc-600">&rarr;</span>
                        <span>{fmtPrice(entry.exit, entry.symbol)}</span>
                      </div>
                      {entry.closeReason && (
                        <span className="text-[10px] text-zinc-500">
                          [{entry.closeReason}]
                        </span>
                      )}
                    </td>

                    {/* 7. Slippage / Spread */}
                    <td className="num px-3 py-3.5 text-zinc-400 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 rounded bg-zinc-900/80 px-1.5 py-0.5 text-[11px] text-zinc-400 border border-zinc-800">
                        <Activity className="size-2.5 text-zinc-500" />
                        {slip} pts
                      </span>
                    </td>

                    {/* 8. Net P&L */}
                    <td className="num px-3 py-3.5 font-bold whitespace-nowrap">
                      <span
                        className={cn(
                          'text-xs',
                          isProfit ? 'text-profit' : 'text-loss',
                        )}
                      >
                        {fmtMoney(entry.pnl, { sign: true })}
                      </span>
                    </td>

                    {/* 9. Bot Trigger Logic */}
                    <td className="px-3 py-3.5">
                      <div className="inline-flex items-center gap-1 rounded-md border border-violet-500/25 bg-violet-950/30 px-2 py-0.5 text-[11px] font-mono text-violet-300">
                        <Cpu className="size-2.5 text-violet-400 shrink-0" />
                        <span className="truncate max-w-[220px]" title={entry.botTriggerLogic || entry.strategy}>
                          {entry.botTriggerLogic || `Auto: ${entry.strategy}`}
                        </span>
                      </div>
                    </td>

                    {/* 10. Audit Note (Editable) */}
                    <td className="px-4 py-3.5">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editAudit}
                            onChange={(e) => setEditAudit(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveAudit(entry.id);
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            placeholder={t.botLedger.auditPlaceholder}
                            autoFocus
                            className="w-full rounded-md border border-violet-500/50 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-100 outline-none focus:border-violet-400"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveAudit(entry.id)}
                            title="Save audit note"
                            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-violet-500/20 text-violet-300 hover:bg-violet-500/30"
                          >
                            <Check className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            title="Cancel"
                            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => handleStartEdit(entry)}
                          className="group flex cursor-pointer items-center justify-between gap-2 rounded-md border border-transparent px-2 py-1 transition-colors hover:border-zinc-800 hover:bg-zinc-900/60"
                        >
                          <span
                            className={cn(
                              'text-xs line-clamp-1',
                              entry.auditNote || entry.note
                                ? 'text-zinc-300'
                                : 'italic text-zinc-600',
                            )}
                          >
                            {entry.auditNote || entry.note || t.botLedger.addAuditPrompt}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {isJustSaved && (
                              <span className="text-[10px] font-semibold text-emerald-400">
                                {t.manualJournal.savedBadge}
                              </span>
                            )}
                            <Edit3 className="size-3 text-zinc-600 opacity-0 group-hover:opacity-100" />
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  if (!standalone) return content;

  return (
    <Card className="p-0 border-violet-500/20">
      <CardHeader
        title={t.botLedger.title}
        subtitle={`${botTrades.length} ${t.botLedger.subtitle}`}
        icon={<Bot className="text-violet-400" />}
        action={
          <span className="num rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-300">
            🤖 {botTrades.length} {t.common.trades}
          </span>
        }
      />
      {content}
    </Card>
  );
}
