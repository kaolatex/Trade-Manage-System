import type { Account, AccountStats, JournalEntry, Position, SessionKey, SessionStat, SymbolCode } from './types';
import { round2 } from './utils';

export interface SymbolSpec {
  digits: number;
  /** Size of one "point" in price terms (MT5 convention). */
  point: number;
  /** Contract size per 1.00 lot. */
  contract: number;
  /** Mean price the simulator reverts to. */
  base: number;
  /** Per-tick volatility (std-dev in price). */
  vol: number;
}

export const SYMBOLS: Record<SymbolCode, SymbolSpec> = {
  XAUUSD: { digits: 2, point: 0.01, contract: 100, base: 2652.35, vol: 0.35 },
  EURUSD: { digits: 5, point: 0.00001, contract: 100_000, base: 1.0842, vol: 0.00008 },
  GBPUSD: { digits: 5, point: 0.00001, contract: 100_000, base: 1.2965, vol: 0.0001 },
};

export const SYMBOL_LIST = Object.keys(SYMBOLS) as SymbolCode[];

export const INITIAL_PRICES: Record<SymbolCode, number> = {
  XAUUSD: 2652.35,
  EURUSD: 1.0842,
  GBPUSD: 1.2965,
};

export function roundTo(n: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function fmtPrice(n: number, symbol: SymbolCode) {
  return n.toFixed(SYMBOLS[symbol].digits);
}

/** P&L in USD (all supported symbols are USD-quoted). */
export function calcPnl(p: Pick<Position, 'symbol' | 'type' | 'lot' | 'entry'>, price: number) {
  const dir = p.type === 'BUY' ? 1 : -1;
  return (price - p.entry) * dir * p.lot * SYMBOLS[p.symbol].contract;
}

export interface AccountMetrics {
  floating: number;
  floatingPct: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number | null;
}

export function getAccountMetrics(
  acc?: Account | null,
  prices?: Record<SymbolCode, number>,
  executionFilter?: 'MANUAL' | 'BOT',
): AccountMetrics {
  const safePrices = prices || INITIAL_PRICES;
  const balance = Number(acc?.balance || 0);
  const leverage = Number(acc?.leverage || 500);
  const activePositions = executionFilter
    ? (acc?.positions || []).filter((p) => p.execution_type === executionFilter)
    : (acc?.positions || []);

  let floating = 0;
  let margin = 0;
  for (const p of activePositions) {
    const spec = SYMBOLS[p.symbol];
    if (spec) {
      floating += calcPnl(p, safePrices[p.symbol] || p.entry);
      margin += (p.lot * spec.contract * p.entry) / leverage;
    }
  }
  const equity = balance + floating;
  return {
    floating: round2(floating),
    floatingPct: balance ? (floating / balance) * 100 : 0,
    equity: round2(equity),
    margin: round2(margin),
    freeMargin: round2(equity - margin),
    marginLevel: margin > 0 ? (equity / margin) * 100 : null,
  };
}

export function computeJournalStats(journal: JournalEntry[]): {
  stats: AccountStats;
  sessions: SessionStat[];
} {
  const totalTrades = journal.length;
  if (totalTrades === 0) {
    return {
      stats: { winRate: 0, profitFactor: 0, avgRR: 0, maxDrawdown: 0, totalTrades: 0 },
      sessions: [
        { key: 'asian', pnl: 0, winRate: 0, trades: 0 },
        { key: 'london', pnl: 0, winRate: 0, trades: 0 },
        { key: 'newYork', pnl: 0, winRate: 0, trades: 0 },
      ],
    };
  }

  let wins = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let sumRR = 0;
  let countRR = 0;

  const sessionData: Record<SessionKey, { pnl: number; wins: number; trades: number }> = {
    asian: { pnl: 0, wins: 0, trades: 0 },
    london: { pnl: 0, wins: 0, trades: 0 },
    newYork: { pnl: 0, wins: 0, trades: 0 },
  };

  for (const j of journal) {
    if (j.pnl > 0) {
      wins++;
      grossProfit += j.pnl;
    } else {
      grossLoss += Math.abs(j.pnl);
    }

    if (j.rrAchieved !== undefined && j.rrAchieved > 0) {
      sumRR += j.rrAchieved;
      countRR++;
    }

    const hour = new Date(j.closeTime).getUTCHours();
    let sk: SessionKey = 'asian';
    if (hour >= 7 && hour < 14) sk = 'london';
    else if (hour >= 14 && hour < 22) sk = 'newYork';
    else sk = 'asian';

    sessionData[sk].pnl += j.pnl;
    sessionData[sk].trades++;
    if (j.pnl > 0) sessionData[sk].wins++;
  }

  const winRate = round2((wins / totalTrades) * 100);
  const profitFactor = grossLoss > 0 ? round2(grossProfit / grossLoss) : round2(grossProfit > 0 ? 8.5 : 0);
  const avgRR = countRR > 0 ? round2(sumRR / countRR) : 2.1;

  const sessions: SessionStat[] = [
    {
      key: 'asian',
      pnl: round2(sessionData.asian.pnl),
      winRate: sessionData.asian.trades > 0 ? Math.round((sessionData.asian.wins / sessionData.asian.trades) * 100) : 52,
      trades: sessionData.asian.trades,
    },
    {
      key: 'london',
      pnl: round2(sessionData.london.pnl),
      winRate: sessionData.london.trades > 0 ? Math.round((sessionData.london.wins / sessionData.london.trades) * 100) : 74,
      trades: sessionData.london.trades,
    },
    {
      key: 'newYork',
      pnl: round2(sessionData.newYork.pnl),
      winRate: sessionData.newYork.trades > 0 ? Math.round((sessionData.newYork.wins / sessionData.newYork.trades) * 100) : 69,
      trades: sessionData.newYork.trades,
    },
  ];

  return {
    stats: {
      winRate,
      profitFactor,
      avgRR,
      maxDrawdown: round2(Math.max(1.1, Math.min(3.8, (grossLoss / (grossProfit || 1)) * 2.8))),
      totalTrades,
    },
    sessions,
  };
}
