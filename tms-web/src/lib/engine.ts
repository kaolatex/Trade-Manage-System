import type {
  Account,
  AccountId,
  BotConfig,
  BotMode,
  LogLevel,
  SessionKey,
  Side,
  SymbolCode,
  Timeframe,
} from './types';
import { SYMBOLS, fmtPrice } from './market';
import { clamp, pad2, round2 } from './utils';

export const TIMEFRAMES: Timeframe[] = ['M1', 'M5', 'M15', 'H1'];

export const botAccountId = (mode: BotMode, accounts?: Record<AccountId, Account>): AccountId => {
  if (accounts) {
    if (mode === 'demo' && accounts['demo-1']) return 'demo-1';
    if (mode === 'live' && accounts['live-master']) return 'live-master';
    const found = (Object.keys(accounts) as AccountId[]).find(
      (id) => id !== 'all' && accounts[id]?.kind === mode,
    );
    if (found) return found;
    const firstNonAll = (Object.keys(accounts) as AccountId[]).find((id) => id !== 'all');
    if (firstNonAll) return firstNonAll;
  }
  return mode === 'demo' ? 'demo-1' : 'live-master';
};

/* ------------------------------------------------------------------ */
/* Market sessions (UTC hours)                                         */
/* ------------------------------------------------------------------ */

export interface SessionDef {
  key: SessionKey;
  name: string;
  short: string;
  start: number;
  end: number;
  dot: string;
}

export const SESSIONS: SessionDef[] = [
  { key: 'asian', name: 'Asian Session', short: 'Asian', start: 23, end: 8, dot: 'bg-sky-400' },
  { key: 'london', name: 'London Session', short: 'London', start: 7, end: 16, dot: 'bg-violet-400' },
  { key: 'newYork', name: 'New York Session', short: 'New York', start: 12, end: 21, dot: 'bg-amber-400' },
];

export const SESSION_MAP = Object.fromEntries(SESSIONS.map((s) => [s.key, s])) as Record<
  SessionKey,
  SessionDef
>;

export function activeSessions(date = new Date()): SessionKey[] {
  const h = date.getUTCHours() + date.getUTCMinutes() / 60;
  return SESSIONS.filter((s) =>
    s.start < s.end ? h >= s.start && h < s.end : h >= s.start || h < s.end,
  ).map((s) => s.key);
}

export function localHourLabel(utcHour: number) {
  const d = new Date();
  d.setUTCHours(utcHour, 0, 0, 0);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export const utcHourLabel = (h: number) => `${pad2(h)}:00`;

/* ------------------------------------------------------------------ */
/* Strategy / sizing                                                   */
/* ------------------------------------------------------------------ */

export const STRATEGIES: { name: string; side?: Side }[] = [
  { name: 'M15 Liquidity Sweep' },
  { name: 'Bullish OB + FVG', side: 'BUY' },
  { name: 'Bearish OB Rejection', side: 'SELL' },
  { name: 'London Breakout Retest' },
  { name: 'NY Session Reversal' },
  { name: 'HTF Demand Zone', side: 'BUY' },
];

export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function calcLot(cfg: BotConfig, balance: number) {
  if (cfg.lotMode === 'fixed') return Math.max(0.01, round2(cfg.fixedLot));
  const spec = SYMBOLS[cfg.symbol];
  const riskUsd = (balance * cfg.riskPercent) / 100;
  const perLot = cfg.slPoints * spec.point * spec.contract;
  if (perLot <= 0) return 0.01;
  return Math.max(0.01, Math.floor((riskUsd / perLot) * 100) / 100);
}

export function sanitizeConfig(c: BotConfig): BotConfig {
  return {
    ...c,
    slPoints: Math.round(clamp(c.slPoints, 10, 100_000)),
    tpPoints: Math.round(clamp(c.tpPoints, 10, 100_000)),
    trailingPoints: Math.round(clamp(c.trailingPoints, 10, 100_000)),
    riskPercent: round2(clamp(c.riskPercent, 0.05, 10)),
    fixedLot: round2(clamp(c.fixedLot, 0.01, 100)),
    dailyLossLimit: round2(clamp(c.dailyLossLimit, 0.5, 50)),
    maxConcurrent: Math.round(clamp(c.maxConcurrent, 1, 10)),
    maxSpread: Math.round(clamp(c.maxSpread, 1, 500)),
  };
}

/* ------------------------------------------------------------------ */
/* Ambient engine chatter for the terminal                             */
/* ------------------------------------------------------------------ */

interface EngineSnapshot {
  config: BotConfig;
  prices: Record<SymbolCode, number>;
  spread: number;
  latency: number;
  botMode: BotMode;
  accounts: Record<AccountId, Account>;
}

export function generateAutoLog(s: EngineSnapshot): { level: LogLevel; message: string } {
  const cfg = s.config;
  const spec = SYMBOLS[cfg.symbol];
  const price = s.prices[cfg.symbol];
  const acc = s.accounts[botAccountId(s.botMode)];
  const r = Math.random();

  if (r < 0.24) {
    return s.spread <= cfg.maxSpread
      ? { level: 'market', message: `Current Spread: ${s.spread} pts (Allowed < ${cfg.maxSpread} pts)` }
      : { level: 'warn', message: `Spread spike: ${s.spread} pts > ${cfg.maxSpread} pts — new entries blocked` };
  }
  if (r < 0.52) {
    const bias = Math.random() > 0.4 ? 'Bullish' : 'Bearish';
    return {
      level: 'scanner',
      message: pick([
        'Scanning Market Structure & Order Blocks... No valid setup.',
        `Scanning ${cfg.timeframe} FVGs on ${cfg.symbol}... 0 unmitigated gaps in range.`,
        `H1 bias: ${bias} · ${cfg.timeframe} structure intact · waiting for pullback into OB`,
        'Order Block found but displacement too weak — skipped.',
        `Checking ${cfg.timeframe} candle close for CHoCH confirmation...`,
      ]),
    };
  }
  if (r < 0.66) {
    const offset = (Math.random() * 600 + 150) * spec.point * (Math.random() > 0.5 ? 1 : -1);
    const kind = offset > 0 ? 'equal highs / buy-side' : 'equal lows / sell-side';
    return {
      level: 'scanner',
      message: `Liquidity pool mapped @ ${fmtPrice(price + offset, cfg.symbol)} (${kind})`,
    };
  }
  if (r < 0.8) {
    const open = acc.positions.filter((p) => p.source === 'bot').length;
    return {
      level: 'risk',
      message: `Exposure check: ${open}/${cfg.maxConcurrent} bot positions · Daily DD ${acc.dailyLossPct.toFixed(2)}% / ${cfg.dailyLossLimit.toFixed(2)}%`,
    };
  }
  if (r < 0.9) {
    const active = activeSessions();
    const allowed = active.some((k) => cfg.sessions[k]);
    const names = active.length ? active.map((k) => SESSION_MAP[k].short).join(' + ') : 'Off-hours';
    return {
      level: allowed ? 'system' : 'warn',
      message: `Session filter: ${names} → ${allowed ? 'trading allowed' : 'trading blocked'}`,
    };
  }
  return {
    level: 'system',
    message: `Heartbeat OK · MT5 latency ${s.latency}ms · ${cfg.symbol} ${fmtPrice(price, cfg.symbol)}`,
  };
}
