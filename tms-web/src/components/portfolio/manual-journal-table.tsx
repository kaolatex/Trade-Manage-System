'use client';

import { useState } from 'react';
import { useTrading } from '@/context/trading-context';
import { useLanguage } from '@/context/language-context';
import { Card, CardHeader } from '@/components/ui/card';
import { SideBadge } from '@/components/ui/badge';
import { UserCheck, Edit3, Check, X, BookmarkCheck, HeartHandshake } from 'lucide-react';
import { fmtDate, fmtHM, fmtMoney } from '@/lib/utils';
import { fmtPrice } from '@/lib/market';
import { MANUAL_SETUP_TAGS, MANUAL_EMOTION_TAGS, JournalEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

export function ManualJournalTable({ standalone = true }: { standalone?: boolean }) {
  const { state, patchJournal } = useTrading();
  const { t } = useLanguage();
  const currentAccount = state.accounts[state.selectedAccountId] || state.accounts.all;
  const journal = currentAccount?.journal || [];

  const manualTrades = journal.filter(
    (j) => j.execution_type === 'MANUAL',
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState<string>('');
  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  const handleStartEdit = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setEditNote(entry.personalNote || entry.note || '');
  };

  const handleSaveNote = (id: string) => {
    patchJournal(state.selectedAccountId, id, {
      personalNote: editNote.trim(),
      note: editNote.trim(),
    });
    setEditingId(null);
    setJustSavedId(id);
    setTimeout(() => setJustSavedId(null), 2500);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditNote('');
  };

  const handleSetupChange = (id: string, setupTag: string) => {
    patchJournal(state.selectedAccountId, id, { setupTag });
  };

  const handleEmotionChange = (id: string, emotionTag: string) => {
    patchJournal(state.selectedAccountId, id, { emotionTag });
  };

  const content = (
    <>
      {manualTrades.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <UserCheck className="size-8 text-zinc-600 mb-2" />
          <p className="text-sm font-medium text-zinc-400">{t.manualJournal.empty}</p>
          <p className="mt-1 text-xs text-zinc-600">
            {t.viewSwitcher.manualDesc}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800/80 bg-cyan-950/20 text-[10px] uppercase tracking-wider text-cyan-400/80">
              <tr>
                <th className="px-4 py-3 font-semibold">{t.manualJournal.colDateTime}</th>
                <th className="px-3 py-3 font-semibold">{t.manualJournal.colSymbol}</th>
                <th className="px-3 py-3 font-semibold">{t.manualJournal.colType}</th>
                <th className="px-3 py-3 font-semibold">{t.manualJournal.colLot}</th>
                <th className="px-3 py-3 font-semibold">{t.manualJournal.colEntryExit}</th>
                <th className="px-3 py-3 font-semibold">{t.manualJournal.colRR}</th>
                <th className="px-3 py-3 font-semibold">{t.manualJournal.colNetPnl}</th>
                <th className="px-3 py-3 font-semibold min-w-[150px]">{t.manualJournal.colSetup}</th>
                <th className="px-3 py-3 font-semibold min-w-[140px]">{t.manualJournal.colEmotion}</th>
                <th className="px-4 py-3 font-semibold min-w-[220px]">{t.manualJournal.colReview}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {manualTrades.map((entry) => {
                const isProfit = entry.pnl >= 0;
                const isEditing = editingId === entry.id;
                const isJustSaved = justSavedId === entry.id;
                const rr = entry.rrAchieved ?? (isProfit ? 2.5 : -1.0);

                return (
                  <tr
                    key={entry.id}
                    className="transition-colors hover:bg-zinc-850/40"
                  >
                    {/* 1. Date & Time */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-medium text-zinc-300">
                        {fmtDate(entry.closeTime)}
                      </div>
                      <div className="num text-[10px] text-zinc-500">
                        {fmtHM(entry.closeTime)}
                      </div>
                    </td>

                    {/* 2. Symbol */}
                    <td className="px-3 py-3.5 font-semibold text-zinc-200">
                      {entry.symbol}
                    </td>

                    {/* 3. Type */}
                    <td className="px-3 py-3.5">
                      <SideBadge side={entry.type} />
                    </td>

                    {/* 4. Lot */}
                    <td className="num px-3 py-3.5 font-medium text-zinc-300">
                      {entry.lot.toFixed(2)}
                    </td>

                    {/* 5. Entry -> Exit */}
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

                    {/* 6. R:R Achieved */}
                    <td className="num px-3 py-3.5 font-bold">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md px-1.5 py-0.5 text-xs',
                          rr >= 0
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
                        )}
                      >
                        {rr >= 0 ? `+${rr.toFixed(1)}R` : `${rr.toFixed(1)}R`}
                      </span>
                    </td>

                    {/* 7. Net P&L */}
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

                    {/* 8. My Setup Checklist (Dropdown) */}
                    <td className="px-3 py-3.5">
                      <div className="relative">
                        <select
                          value={entry.setupTag || ''}
                          onChange={(e) => handleSetupChange(entry.id, e.target.value)}
                          className="w-full cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900/90 px-2 py-1 text-[11px] font-medium text-cyan-300 outline-none transition-colors hover:border-cyan-500/40 focus:border-cyan-500"
                        >
                          <option value="" disabled>
                            {t.manualJournal.selectSetupPrompt}
                          </option>
                          {MANUAL_SETUP_TAGS.map((tag) => (
                            <option key={tag} value={tag} className="bg-zinc-900 text-zinc-200">
                              {tag}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>

                    {/* 9. Emotion / Discipline State (Dropdown) */}
                    <td className="px-3 py-3.5">
                      <div className="relative">
                        <select
                          value={entry.emotionTag || ''}
                          onChange={(e) => handleEmotionChange(entry.id, e.target.value)}
                          className={cn(
                            'w-full cursor-pointer rounded-lg border px-2 py-1 text-[11px] font-medium outline-none transition-colors',
                            entry.emotionTag?.includes('FOMO') || entry.emotionTag?.includes('Revenge')
                              ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                              : 'border-zinc-800 bg-zinc-900/90 text-emerald-300 hover:border-emerald-500/40 focus:border-emerald-500',
                          )}
                        >
                          <option value="" disabled>
                            {t.manualJournal.selectEmotionPrompt}
                          </option>
                          {MANUAL_EMOTION_TAGS.map((tag) => (
                            <option key={tag} value={tag} className="bg-zinc-900 text-zinc-200">
                              {tag}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>

                    {/* 10. Personal Review Note (Editable) */}
                    <td className="px-4 py-3.5">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveNote(entry.id);
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            placeholder={t.manualJournal.notePlaceholder}
                            autoFocus
                            className="w-full rounded-md border border-cyan-500/50 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-100 outline-none focus:border-cyan-400"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveNote(entry.id)}
                            title={t.manualJournal.saveTooltip}
                            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30"
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
                              entry.personalNote || entry.note
                                ? 'text-zinc-300'
                                : 'italic text-zinc-600',
                            )}
                          >
                            {entry.personalNote || entry.note || t.manualJournal.addNotePrompt}
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
    <Card className="p-0 border-cyan-500/20">
      <CardHeader
        title={t.manualJournal.title}
        subtitle={`${manualTrades.length} ${t.manualJournal.subtitle}`}
        icon={<UserCheck className="text-cyan-400" />}
        action={
          <span className="num rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
            🖐️ {manualTrades.length} {t.common.trades}
          </span>
        }
      />
      {content}
    </Card>
  );
}
