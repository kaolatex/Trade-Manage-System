'use client';

import { useTrading } from '@/context/trading-context';
import { useLanguage } from '@/context/language-context';
import { Card, CardHeader } from '@/components/ui/card';
import { SideBadge } from '@/components/ui/badge';
import { Layers, ShieldCheck, XCircle, ArrowUpRight, ArrowDownRight, UserCheck, Bot } from 'lucide-react';
import { calcPnl, fmtPrice } from '@/lib/market';
import { fmtMoney, fmtTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function ActivePositionsTable() {
  const { state, closePosition, breakEven } = useTrading();
  const { t } = useLanguage();
  const currentAccount = state.accounts[state.selectedAccountId] || state.accounts.all;
  const viewMode = state.portfolioViewMode;
  const positions = currentAccount?.positions || [];

  const filteredPositions = positions.filter((p) => {
    if (viewMode === 'manual') return p.execution_type === 'MANUAL';
    if (viewMode === 'bot') return p.execution_type === 'BOT';
    return true;
  });

  const modeBadge =
    viewMode === 'manual' ? (
      <span className="flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
        <UserCheck className="size-2.5" />
        <span>MANUAL ONLY</span>
      </span>
    ) : viewMode === 'bot' ? (
      <span className="flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-300">
        <Bot className="size-2.5" />
        <span>BOT ONLY</span>
      </span>
    ) : null;

  return (
    <Card className="p-0">
      <CardHeader
        title={t.activePositions.title}
        subtitle={`${filteredPositions.length} ${t.activePositions.subtitle}`}
        icon={<Layers />}
        action={
          <div className="flex items-center gap-2">
            {modeBadge}
            <span className="num rounded-full border border-zinc-800 bg-zinc-900/60 px-2.5 py-0.5 text-xs text-zinc-400">
              {filteredPositions.length} {t.activePositions.activeCount}
            </span>
          </div>
        }
      />

      {filteredPositions.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <Layers className="size-8 text-zinc-600 mb-2" />
          <p className="text-sm font-medium text-zinc-400">{t.activePositions.noPositions}</p>
          <p className="mt-1 text-xs text-zinc-600">
            {viewMode === 'manual'
              ? 'ยังไม่มีคำสั่งที่กดมือเองในขณะนี้'
              : viewMode === 'bot'
                ? 'ระบบบอทกำลังสแกนหาจังหวะที่ได้เปรียบตามกลยุทธ์'
                : t.activePositions.waitingMessage}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800/80 bg-zinc-900/30 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-semibold">{t.activePositions.colTicketSymbol}</th>
                <th className="px-3 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">{t.activePositions.colType}</th>
                <th className="px-4 py-3 font-semibold">{t.activePositions.colLot}</th>
                <th className="px-4 py-3 font-semibold">{t.activePositions.colEntry}</th>
                <th className="px-4 py-3 font-semibold">{t.activePositions.colCurrent}</th>
                <th className="px-4 py-3 font-semibold">{t.activePositions.colSlTp}</th>
                <th className="px-4 py-3 font-semibold text-right">{t.activePositions.colPnl}</th>
                <th className="px-5 py-3 font-semibold text-right">{t.activePositions.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredPositions.map((pos) => {
                const currentPrice = state.prices[pos.symbol];
                const pnl = calcPnl(pos, currentPrice);
                const isProfit = pnl >= 0;
                const isManual = pos.execution_type === 'MANUAL';

                return (
                  <tr
                    key={pos.ticket}
                    className="transition-colors hover:bg-zinc-850/40"
                  >
                    {/* Ticket & Symbol */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-200">
                          {pos.symbol}
                        </span>
                        <span className="num rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-400">
                          #{pos.ticket}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-500">
                        <span className="truncate max-w-[150px]">
                          {isManual ? pos.setupTag || pos.strategy : pos.botTriggerLogic || pos.strategy}
                        </span>
                        <span>&bull;</span>
                        <span className="num">{fmtTime(pos.openTime)}</span>
                      </div>
                    </td>

                    {/* Source Badge (Hard Separation Indicator) */}
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      {isManual ? (
                        <span className="inline-flex items-center gap-1 rounded border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                          <UserCheck className="size-2.5" />
                          <span>MANUAL</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                          <Bot className="size-2.5" />
                          <span>BOT #{pos.magicNumber || 123456}</span>
                        </span>
                      )}
                    </td>

                    {/* Type Badge */}
                    <td className="px-4 py-3.5">
                      <SideBadge side={pos.type} />
                    </td>

                    {/* Lot */}
                    <td className="num px-4 py-3.5 font-medium text-zinc-300">
                      {pos.lot.toFixed(2)}
                    </td>

                    {/* Entry Price */}
                    <td className="num px-4 py-3.5 text-zinc-300">
                      {fmtPrice(pos.entry, pos.symbol)}
                    </td>

                    {/* Current Price */}
                    <td className="num px-4 py-3.5 font-medium text-zinc-100">
                      {fmtPrice(currentPrice, pos.symbol)}
                    </td>

                    {/* SL / TP */}
                    <td className="num px-4 py-3.5 text-[11px] text-zinc-400 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-loss">
                          {pos.sl > 0 ? fmtPrice(pos.sl, pos.symbol) : '-'}
                        </span>
                        <span className="text-zinc-600">/</span>
                        <span className="text-profit">
                          {pos.tp > 0 ? fmtPrice(pos.tp, pos.symbol) : '-'}
                        </span>
                      </div>
                      {pos.beApplied && (
                        <span className="text-[9px] font-semibold text-emerald-400">
                          {t.activePositions.beLocked}
                        </span>
                      )}
                    </td>

                    {/* Floating P&L */}
                    <td className="num px-4 py-3.5 text-right font-bold whitespace-nowrap">
                      <span
                        className={cn(
                          'inline-flex items-center gap-0.5 text-sm',
                          isProfit ? 'text-profit' : 'text-loss',
                        )}
                      >
                        {isProfit ? (
                          <ArrowUpRight className="size-3.5" />
                        ) : (
                          <ArrowDownRight className="size-3.5" />
                        )}
                        {fmtMoney(pnl, { sign: true })}
                      </span>
                    </td>

                    {/* Action Buttons */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Break Even Button */}
                        <button
                          type="button"
                          onClick={() => breakEven(state.selectedAccountId, pos.ticket)}
                          title={t.activePositions.beTooltip}
                          disabled={pos.beApplied}
                          className="flex items-center gap-1 rounded-md border border-zinc-700/80 bg-zinc-800/80 px-2 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-40"
                        >
                          <ShieldCheck className="size-3 text-emerald-400" />
                          <span>{t.activePositions.btnBE}</span>
                        </button>

                        {/* Close Order Button */}
                        <button
                          type="button"
                          onClick={() => closePosition(state.selectedAccountId, pos.ticket)}
                          title={t.activePositions.closeTooltip}
                          className="flex items-center gap-1 rounded-md border border-rose-900/50 bg-rose-950/40 px-2 py-1 text-[11px] font-medium text-rose-300 transition-colors hover:border-rose-700 hover:bg-rose-900/60 hover:text-white"
                        >
                          <XCircle className="size-3" />
                          <span>{t.activePositions.btnClose}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
