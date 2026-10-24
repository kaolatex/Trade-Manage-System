'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  Account,
  AccountId,
  BotConfig,
  BotMode,
  BridgeStatus,
  CloseReason,
  ExecutionType,
  JournalEntry,
  LogEntry,
  LogLevel,
  PortfolioViewMode,
  Position,
  Side,
  SymbolCode,
  Toast,
} from '@/lib/types';
import { INITIAL_PRICES, SYMBOLS, SYMBOL_LIST, calcPnl, computeJournalStats, fmtPrice, roundTo } from '@/lib/market';
import { DEFAULT_CONFIG, createAccounts } from '@/lib/mock-data';
import {
  SESSIONS,
  SESSION_MAP,
  activeSessions,
  botAccountId,
  calcLot,
  generateAutoLog,
  pick,
  STRATEGIES,
} from '@/lib/engine';
import { fmtMoney, round2 } from '@/lib/utils';
import {
  fetchSupabaseCloudData,
  isSupabaseConfigured,
  supabase,
  updateCloudJournalNote,
} from '@/lib/supabase';

/* ================================================================== */
/* Multi-Account Aggregator                                           */
/* ================================================================== */

export function buildAllAccountsOverview(accounts: Record<AccountId, Account>): Account {
  const nonAll = Object.values(accounts).filter((a) => a && a.id !== 'all');
  if (nonAll.length === 0) {
    return {
      id: 'all',
      name: 'All Accounts Overview',
      kind: 'live',
      login: 'ALL',
      server: 'HFM Multi-Broker',
      leverage: 500,
      balance: 0,
      dailyStartBalance: 0,
      dailyLossPct: 0,
      positions: [],
      journal: [],
      equityHistory: [],
      equityHistoryManual: [],
      equityHistoryBot: [],
      stats: { winRate: 0, profitFactor: 0, avgRR: 0, maxDrawdown: 0, totalTrades: 0 },
      sessions: [
        { key: 'asian', pnl: 0, winRate: 0, trades: 0 },
        { key: 'london', pnl: 0, winRate: 0, trades: 0 },
        { key: 'newYork', pnl: 0, winRate: 0, trades: 0 },
      ],
    };
  }

  const balance = round2(nonAll.reduce((sum, a) => sum + (a.balance || 0), 0));
  const dailyStartBalance = round2(nonAll.reduce((sum, a) => sum + (a.dailyStartBalance || 0), 0));
  const dailyLossPct =
    dailyStartBalance > 0
      ? round2(Math.max(0, ((dailyStartBalance - balance) / dailyStartBalance) * 100))
      : 0;

  const positions = nonAll.flatMap((a) => a.positions || []);
  const journal = nonAll
    .flatMap((a) => a.journal || [])
    .sort((a, b) => b.closeTime - a.closeTime);

  const primaryHistory = nonAll[0]?.equityHistory || [];
  const equityHistory = primaryHistory.map((pt, idx) => {
    let combined = 0;
    for (const a of nonAll) {
      combined += a.equityHistory?.[idx]?.equity || a.balance;
    }
    return {
      date: pt.date,
      equity: round2(combined),
    };
  });

  const computed = computeJournalStats(journal);

  return {
    id: 'all',
    name: 'All Accounts Overview',
    kind: 'live',
    login: 'ALL',
    server: 'HFM Multi-Broker',
    leverage: 500,
    balance,
    dailyStartBalance,
    dailyLossPct,
    positions,
    journal,
    equityHistory,
    equityHistoryManual: equityHistory.map((pt) => ({ ...pt, equity: round2(pt.equity * 0.45) })),
    equityHistoryBot: equityHistory.map((pt) => ({ ...pt, equity: round2(pt.equity * 0.55) })),
    stats: computed.stats,
    sessions: computed.sessions,
  };
}

/* ================================================================== */
/* State                                                               */
/* ================================================================== */

export interface TradingState {
  prices: Record<SymbolCode, number>;
  prevPrices: Record<SymbolCode, number>;
  spread: number;
  latency: number;
  accounts: Record<AccountId, Account>;
  selectedAccountId: AccountId;
  portfolioViewMode: PortfolioViewMode;
  botRunning: boolean;
  botStartedAt: number | null;
  botMode: BotMode;
  config: BotConfig;
  logs: LogEntry[];
  seq: number;
  bridgeStatus: BridgeStatus;
  isSyncing: boolean;
}

const MAX_LOGS = 300;
const TICK_MS = 1500;
const AUTO_LOG_MS = 3800;

type Action =
  | { type: 'TICK'; noise: Record<SymbolCode, number>; spread: number; latency: number; now: number }
  | { type: 'LOG'; level: LogLevel; message: string; now: number }
  | { type: 'CLEAR_LOGS'; now: number }
  | { type: 'SELECT_ACCOUNT'; id: AccountId }
  | { type: 'SET_VIEW_MODE'; mode: PortfolioViewMode }
  | { type: 'CLOSE_POSITION'; accountId: AccountId; ticket: number; now: number }
  | { type: 'BREAK_EVEN'; accountId: AccountId; ticket: number; now: number }
  | { type: 'UPDATE_NOTE'; accountId: AccountId; id: string; note: string }
  | { type: 'PATCH_JOURNAL'; accountId: AccountId; id: string; patch: Partial<JournalEntry> }
  | { type: 'OPEN_POSITION'; accountId: AccountId; position: Position }
  | { type: 'SET_RUNNING'; running: boolean; now: number }
  | { type: 'SET_MODE'; mode: BotMode; now: number }
  | { type: 'SAVE_CONFIG'; config: BotConfig; now: number }
  | { type: 'PANIC'; now: number }
  | { type: 'HYDRATE_ACCOUNTS'; accounts: Record<AccountId, Account>; selectedId?: AccountId }
  | { type: 'SET_BRIDGE_STATUS'; bridge: BridgeStatus }
  | { type: 'SET_SYNCING'; syncing: boolean };

/* ---------- mutable helpers operating on a shallow-cloned draft ---------- */

function addLog(s: TradingState, level: LogLevel, message: string, ts: number) {
  s.seq += 1;
  const next = s.logs.length >= MAX_LOGS ? s.logs.slice(-(MAX_LOGS - 1)) : s.logs.slice();
  next.push({ id: s.seq, ts, level, message });
  s.logs = next;
}

function patchPosition(s: TradingState, accId: AccountId, ticket: number, patch: Partial<Position>) {
  let targetId = accId;
  if (targetId === 'all') {
    const found = (Object.keys(s.accounts) as AccountId[]).find(
      (k) => k !== 'all' && s.accounts[k]?.positions?.some((p) => p.ticket === ticket),
    );
    if (found) targetId = found;
  }
  const acc = s.accounts[targetId];
  if (!acc) return;
  s.accounts = {
    ...s.accounts,
    [targetId]: {
      ...acc,
      positions: acc.positions.map((p) => (p.ticket === ticket ? { ...p, ...patch } : p)),
    },
  };
  s.accounts.all = buildAllAccountsOverview(s.accounts);
}

function closeInternal(
  s: TradingState,
  accId: AccountId,
  ticket: number,
  price: number,
  reason: CloseReason,
  now: number,
) {
  let targetId = accId;
  if (targetId === 'all') {
    const found = (Object.keys(s.accounts) as AccountId[]).find(
      (k) => k !== 'all' && s.accounts[k]?.positions?.some((p) => p.ticket === ticket),
    );
    if (found) targetId = found;
  }
  const acc = s.accounts[targetId];
  if (!acc) return;
  const pos = acc.positions.find((p) => p.ticket === ticket);
  if (!pos) return;

  const pnl = round2(calcPnl(pos, price));
  const lossPct = acc.dailyStartBalance > 0 && pnl < 0 ? (-pnl / acc.dailyStartBalance) * 100 : 0;

  s.accounts = {
    ...s.accounts,
    [targetId]: {
      ...acc,
      balance: round2(acc.balance + pnl),
      dailyLossPct: acc.dailyLossPct + lossPct,
      positions: acc.positions.filter((p) => p.ticket !== ticket),
      journal: [
        {
          id: `J-${ticket}`,
          ticket,
          openTime: pos.openTime,
          closeTime: now,
          symbol: pos.symbol,
          type: pos.type,
          lot: pos.lot,
          entry: pos.entry,
          exit: price,
          pnl,
          source: pos.source,
          execution_type: pos.execution_type,
          magicNumber: pos.magicNumber,
          strategy: pos.strategy,
          timeframe: pos.timeframe,
          slippageSpreadPts: pos.slippageSpreadPts,
          botTriggerLogic: pos.botTriggerLogic,
          setupTag: pos.setupTag,
          emotionTag: pos.emotionTag,
          rrAchieved:
            pos.sl > 0
              ? round2(
                  (Math.abs(price - pos.entry) / Math.abs(pos.entry - pos.sl)) *
                    (pnl >= 0 ? 1 : -1),
                )
              : pnl >= 0
                ? 2.0
                : -1.0,
          personalNote: '',
          auditNote: '',
          note: '',
          closeReason: reason,
        },
        ...acc.journal,
      ],
    },
  };

  s.accounts.all = buildAllAccountsOverview(s.accounts);

  addLog(
    s,
    pnl >= 0 ? 'exec' : 'warn',
    `Position #${ticket} ${pos.type} ${pos.lot.toFixed(2)} ${pos.symbol} closed @ ${fmtPrice(price, pos.symbol)} [${reason}] → P&L ${fmtMoney(pnl, { sign: true })}`,
    now,
  );

  // Circuit breaker — daily loss limit
  const updated = s.accounts[accId];
  if (
    accId === botAccountId(s.botMode) &&
    s.botRunning &&
    updated.dailyLossPct >= s.config.dailyLossLimit
  ) {
    s.botRunning = false;
    s.botStartedAt = null;
    addLog(
      s,
      'error',
      `⛔ CIRCUIT BREAKER TRIPPED — daily drawdown ${updated.dailyLossPct.toFixed(2)}% ≥ limit ${s.config.dailyLossLimit.toFixed(2)}%. Engine halted.`,
      now,
    );
  }
}

function manageBotPosition(s: TradingState, accId: AccountId, pos: Position, price: number, now: number) {
  const cfg = s.config;
  const spec = SYMBOLS[pos.symbol];
  const dir = pos.type === 'BUY' ? 1 : -1;
  const profit = (price - pos.entry) * dir;
  let sl = pos.sl;

  if (cfg.autoBE && !pos.beApplied && sl > 0) {
    const risk = (pos.entry - sl) * dir;
    if (risk > 0 && profit >= risk) {
      sl = pos.entry;
      patchPosition(s, accId, pos.ticket, { sl, beApplied: true });
      addLog(
        s,
        'risk',
        `Auto Break-Even → #${pos.ticket} reached 1R (+${fmtPrice(profit, pos.symbol)}). SL moved to entry ${fmtPrice(pos.entry, pos.symbol)}`,
        now,
      );
    }
  }

  if (cfg.trailingStop) {
    const trail = cfg.trailingPoints * spec.point;
    if (trail > 0 && profit >= trail) {
      const candidate = roundTo(price - dir * trail, spec.digits);
      const improves = sl === 0 || (candidate - sl) * dir >= spec.point * 50;
      if (improves) {
        patchPosition(s, accId, pos.ticket, { sl: candidate, beApplied: true });
        addLog(
          s,
          'risk',
          `Trailing Stop → #${pos.ticket} SL ${fmtPrice(sl, pos.symbol)} → ${fmtPrice(candidate, pos.symbol)}`,
          now,
        );
      }
    }
  }
}

/* ================================================================== */
/* Reducer                                                             */
/* ================================================================== */

function reducer(state: TradingState, action: Action): TradingState {
  switch (action.type) {
    case 'TICK': {
      const s: TradingState = {
        ...state,
        prevPrices: state.prices,
        spread: action.spread,
        latency: action.latency,
      };
      const prices = { ...state.prices };
      for (const sym of SYMBOL_LIST) {
        const spec = SYMBOLS[sym];
        const p = state.prices[sym];
        prices[sym] = roundTo(p + (spec.base - p) * 0.01 + action.noise[sym] * spec.vol, spec.digits);
      }
      s.prices = prices;

      for (const accId of Object.keys(state.accounts) as AccountId[]) {
        if (accId === 'all') continue;
        const currentAcc = s.accounts[accId];
        if (!currentAcc) continue;
        for (const original of state.accounts[accId]?.positions || []) {
          const pos = currentAcc.positions.find((p) => p.ticket === original.ticket);
          if (!pos) continue;
          const price = prices[pos.symbol];
          const dir = pos.type === 'BUY' ? 1 : -1;
          const hitSL = pos.sl > 0 && (dir === 1 ? price <= pos.sl : price >= pos.sl);
          const hitTP = pos.tp > 0 && (dir === 1 ? price >= pos.tp : price <= pos.tp);
          if (hitSL || hitTP) {
            const locked = (pos.sl - pos.entry) * dir;
            const reason: CloseReason = hitTP
              ? 'TP'
              : Math.abs(locked) < 1e-9
                ? 'BE'
                : locked > 0
                  ? 'TRAIL'
                  : 'SL';
            closeInternal(s, accId, pos.ticket, hitTP ? pos.tp : pos.sl, reason, action.now);
            continue;
          }
          if (pos.source === 'bot') manageBotPosition(s, accId, pos, price, action.now);
        }
      }
      s.accounts.all = buildAllAccountsOverview(s.accounts);
      return s;
    }

    case 'LOG': {
      const s = { ...state };
      addLog(s, action.level, action.message, action.now);
      return s;
    }

    case 'CLEAR_LOGS': {
      const s = { ...state, logs: [] };
      addLog(s, 'system', 'Console cleared.', action.now);
      return s;
    }

    case 'SELECT_ACCOUNT':
      return { ...state, selectedAccountId: action.id };

    case 'SET_VIEW_MODE':
      return { ...state, portfolioViewMode: action.mode };

    case 'CLOSE_POSITION': {
      let targetId = action.accountId;
      if (targetId === 'all') {
        const found = (Object.keys(state.accounts) as AccountId[]).find(
          (k) => k !== 'all' && state.accounts[k]?.positions?.some((p) => p.ticket === action.ticket),
        );
        if (found) targetId = found;
      }
      const pos = state.accounts[targetId]?.positions.find((p) => p.ticket === action.ticket);
      if (!pos) return state;
      const s = { ...state };
      closeInternal(s, targetId, action.ticket, state.prices[pos.symbol], 'MANUAL', action.now);
      return s;
    }

    case 'BREAK_EVEN': {
      let targetId = action.accountId;
      if (targetId === 'all') {
        const found = (Object.keys(state.accounts) as AccountId[]).find(
          (k) => k !== 'all' && state.accounts[k]?.positions?.some((p) => p.ticket === action.ticket),
        );
        if (found) targetId = found;
      }
      const pos = state.accounts[targetId]?.positions.find((p) => p.ticket === action.ticket);
      if (!pos) return state;
      const s = { ...state };
      patchPosition(s, targetId, action.ticket, { sl: pos.entry, beApplied: true });
      addLog(
        s,
        'exec',
        `Manual Break-Even → #${pos.ticket} SL moved to entry ${fmtPrice(pos.entry, pos.symbol)}`,
        action.now,
      );
      return s;
    }

    case 'UPDATE_NOTE': {
      let targetId = action.accountId;
      if (targetId === 'all') {
        const found = (Object.keys(state.accounts) as AccountId[]).find(
          (k) => k !== 'all' && state.accounts[k]?.journal?.some((j) => j.id === action.id),
        );
        if (found) targetId = found;
      }
      const acc = state.accounts[targetId];
      if (!acc) return state;
      const nextAccounts = {
        ...state.accounts,
        [targetId]: {
          ...acc,
          journal: acc.journal.map((j) => (j.id === action.id ? { ...j, note: action.note } : j)),
        },
      };
      nextAccounts.all = buildAllAccountsOverview(nextAccounts);
      return { ...state, accounts: nextAccounts };
    }

    case 'PATCH_JOURNAL': {
      let targetId = action.accountId;
      if (targetId === 'all') {
        const found = (Object.keys(state.accounts) as AccountId[]).find(
          (k) => k !== 'all' && state.accounts[k]?.journal?.some((j) => j.id === action.id),
        );
        if (found) targetId = found;
      }
      const acc = state.accounts[targetId];
      if (!acc) return state;
      const nextAccounts = {
        ...state.accounts,
        [targetId]: {
          ...acc,
          journal: acc.journal.map((j) =>
            j.id === action.id ? { ...j, ...action.patch } : j,
          ),
        },
      };
      nextAccounts.all = buildAllAccountsOverview(nextAccounts);
      return { ...state, accounts: nextAccounts };
    }

    case 'OPEN_POSITION': {
      let targetId = action.accountId;
      if (targetId === 'all') {
        const first = (Object.keys(state.accounts) as AccountId[]).find((k) => k !== 'all');
        if (first) targetId = first;
      }
      const acc = state.accounts[targetId];
      if (!acc) return state;
      const nextAccounts = {
        ...state.accounts,
        [targetId]: { ...acc, positions: [...acc.positions, action.position] },
      };
      nextAccounts.all = buildAllAccountsOverview(nextAccounts);
      return { ...state, accounts: nextAccounts };
    }

    case 'SET_RUNNING': {
      const s = { ...state };
      const cfg = s.config;
      const targetAccId = botAccountId(s.botMode, s.accounts);
      const acc = s.accounts[targetAccId] || Object.values(s.accounts).find((a) => a.id !== 'all');
      if (!acc) return state;
      if (action.running) {
        if (state.botRunning) return state;
        if (acc.dailyLossPct >= cfg.dailyLossLimit) {
          addLog(
            s,
            'error',
            `Start rejected — circuit breaker active (daily DD ${acc.dailyLossPct.toFixed(2)}% ≥ ${cfg.dailyLossLimit.toFixed(2)}%).`,
            action.now,
          );
          return s;
        }
        s.botRunning = true;
        s.botStartedAt = action.now;
        addLog(
          s,
          'system',
          `▶ Engine STARTED on ${cfg.symbol} (${cfg.timeframe}) · ${s.botMode === 'demo' ? 'DEMO SANDBOX' : 'LIVE PRODUCTION'} → ${acc.name}`,
          action.now,
        );
        addLog(s, 'scanner', 'Scanning Market Structure & Order Blocks...', action.now);
      } else {
        if (!state.botRunning) return state;
        s.botRunning = false;
        s.botStartedAt = null;
        addLog(
          s,
          'warn',
          '⏸ Engine PAUSED by user — no new entries. Open positions remain managed (SL/TP, BE).',
          action.now,
        );
      }
      return s;
    }

    case 'SET_MODE': {
      if (state.botMode === action.mode) return state;
      const s = { ...state, botMode: action.mode };
      if (state.botRunning) {
        s.botRunning = false;
        s.botStartedAt = null;
        addLog(s, 'warn', 'Engine paused for environment switch.', action.now);
      }
      const targetAccId = botAccountId(action.mode, s.accounts);
      const acc = s.accounts[targetAccId] || Object.values(s.accounts).find((a) => a.id !== 'all');
      if (acc) {
        addLog(
          s,
          action.mode === 'live' ? 'error' : 'system',
          action.mode === 'live'
            ? `🔥 Environment → LIVE PRODUCTION · attached to ${acc.name} (#${acc.login}). Real capital at risk.`
            : `🧪 Environment → DEMO SANDBOX · attached to ${acc.name} (#${acc.login}).`,
          action.now,
        );
      }
      return s;
    }

    case 'SAVE_CONFIG': {
      const c = action.config;
      const prev = state.config;
      const s = { ...state, config: c };
      addLog(
        s,
        'config',
        `Configuration synced → ${c.symbol} ${c.timeframe} · SL ${c.slPoints} / TP ${c.tpPoints} pts · ${c.lotMode === 'risk' ? `Risk ${c.riskPercent}%` : `Fixed ${c.fixedLot.toFixed(2)} lot`} · DLL ${c.dailyLossLimit}% · Max ${c.maxConcurrent} trades · Spread < ${c.maxSpread} pts`,
        action.now,
      );
      const sessions = SESSIONS.filter((x) => c.sessions[x.key]).map((x) => x.short).join(' + ') || 'NONE';
      addLog(
        s,
        'config',
        `Session filter: ${sessions} · Auto-BE ${c.autoBE ? 'ON' : 'OFF'} · Trailing ${c.trailingStop ? `ON (${c.trailingPoints} pts)` : 'OFF'}`,
        action.now,
      );
      if (prev.symbol !== c.symbol || prev.timeframe !== c.timeframe) {
        addLog(s, 'system', `Engine re-attached to ${c.symbol} (${c.timeframe})`, action.now);
      }
      return s;
    }

    case 'PANIC': {
      const s = { ...state };
      const accId = botAccountId(s.botMode, s.accounts);
      const acc = s.accounts[accId] || Object.values(s.accounts).find((a) => a.id !== 'all');
      if (!acc) return state;
      const positions = acc.positions;
      const before = acc.balance;
      s.botRunning = false;
      s.botStartedAt = null;
      addLog(s, 'error', '🚨 EMERGENCY PANIC CLOSE triggered by user', action.now);
      for (const p of positions) {
        closeInternal(s, accId, p.ticket, s.prices[p.symbol], 'PANIC', action.now);
      }
      const net = round2((s.accounts[accId]?.balance || before) - before);
      addLog(
        s,
        'error',
        `Engine HALTED — ${positions.length} position(s) flattened on ${acc.name}. Net realized ${fmtMoney(net, { sign: true })}`,
        action.now,
      );
      return s;
    }

    case 'HYDRATE_ACCOUNTS': {
      const allAcc = buildAllAccountsOverview(action.accounts);
      const accounts: Record<AccountId, Account> = {
        ...action.accounts,
        all: allAcc,
      };
      const selectedAccountId = action.selectedId
        ? action.selectedId
        : state.selectedAccountId in accounts
          ? state.selectedAccountId
          : 'all';
      return { ...state, accounts, selectedAccountId };
    }

    case 'SET_BRIDGE_STATUS':
      return { ...state, bridgeStatus: action.bridge };

    case 'SET_SYNCING':
      return { ...state, isSyncing: action.syncing };
  }
}

function createInitialState(): TradingState {
  const now = Date.now();
  const rawAccounts = createAccounts(now);
  const allAccount = buildAllAccountsOverview(rawAccounts);
  const accounts: Record<AccountId, Account> = {
    ...rawAccounts,
    all: allAccount,
  };

  const s: TradingState = {
    prices: { ...INITIAL_PRICES },
    prevPrices: { ...INITIAL_PRICES },
    spread: 16,
    latency: 14,
    accounts,
    selectedAccountId: 'all',
    portfolioViewMode: 'combined',
    botRunning: true,
    botStartedAt: now - 42 * 60_000,
    botMode: 'demo',
    config: DEFAULT_CONFIG,
    logs: [],
    seq: 0,
    bridgeStatus: {
      connected: false,
      mode: 'cloud_supabase',
      latency: 0,
      lastSync: null,
      accountsCount: 0,
    },
    isSyncing: false,
  };
  const boot: [number, LogLevel, string][] = [
    [-26, 'system', 'TMS Engine v1.0 initialized on XAUUSD (M15)'],
    [-25, 'system', 'Connected to MT5 terminal · MetaQuotes-Demo · latency 14ms'],
    [-23, 'config', 'Loaded profile "Gold Scalper Pro" · Risk 1.0% · DLL 3.0% · Max 2 trades'],
    [-20, 'market', 'Current Spread: 16 pts (Allowed < 30 pts)'],
    [-17, 'scanner', 'Scanning Market Structure & Order Blocks... No valid setup.'],
    [-12, 'risk', 'Exposure check: 1/2 bot positions · Daily DD 0.80% / 3.00%'],
    [-6, 'scanner', 'H1 bias: Bullish · M15 structure intact · waiting for pullback into OB'],
  ];
  for (const [sec, level, msg] of boot) addLog(s, level, msg, now + sec * 1000);
  return s;
}

/* ================================================================== */
/* Context                                                             */
/* ================================================================== */

interface TradingContextValue {
  state: TradingState;
  toasts: Toast[];
  isSimulating: boolean;
  addAccountModalOpen: boolean;
  setAddAccountModalOpen: (open: boolean) => void;
  selectAccount: (id: AccountId) => void;
  setPortfolioViewMode: (mode: PortfolioViewMode) => void;
  closePosition: (accountId: AccountId, ticket: number) => void;
  breakEven: (accountId: AccountId, ticket: number) => void;
  updateNote: (accountId: AccountId, id: string, note: string) => void;
  patchJournal: (accountId: AccountId, id: string, patch: Partial<JournalEntry>) => Promise<void> | void;
  setBotRunning: (running: boolean) => void;
  setBotMode: (mode: BotMode) => void;
  saveConfig: (config: BotConfig) => Promise<void>;
  panicClose: () => void;
  simulateSignal: () => void;
  clearLogs: () => void;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  triggerSyncNow: () => Promise<void>;
  addHfmAccount: (data: {
    name?: string;
    account_name?: string;
    login?: number;
    login_id?: number;
    password: string;
    server: string;
  }) => Promise<{ ok: boolean; message?: string }>;
}

const TradingContext = createContext<TradingContextValue | null>(null);

export function useTrading() {
  const ctx = useContext(TradingContext);
  if (!ctx) throw new Error('useTrading must be used inside <TradingProvider>');
  return ctx;
}

function gaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function TradingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false);

  const stateRef = useRef(state);
  const ticketRef = useRef(50812400);
  const simulatingRef = useRef(false);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timeoutsRef.current.push(id);
  }, []);

  useEffect(() => {
    const ids = timeoutsRef.current;
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((ts) => [...ts.slice(-3), { ...t, id }]);
      schedule(() => dismissToast(id), 4500);
    },
    [schedule, dismissToast],
  );

  const log = useCallback((level: LogLevel, message: string) => {
    dispatch({ type: 'LOG', level, message, now: Date.now() });
  }, []);

  /* ---------- market feed ---------- */
  useEffect(() => {
    const id = window.setInterval(() => {
      const spike = Math.random() < 0.04;
      dispatch({
        type: 'TICK',
        noise: { XAUUSD: gaussian(), EURUSD: gaussian(), GBPUSD: gaussian() },
        spread: spike ? 31 + Math.floor(Math.random() * 8) : 12 + Math.floor(Math.random() * 10),
        latency: 11 + Math.floor(Math.random() * 8),
        now: Date.now(),
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  /* ---------- ambient engine logs ---------- */
  useEffect(() => {
    if (!state.botRunning) return;
    const id = window.setInterval(() => {
      const { level, message } = generateAutoLog(stateRef.current);
      dispatch({ type: 'LOG', level, message, now: Date.now() });
    }, AUTO_LOG_MS);
    return () => window.clearInterval(id);
  }, [state.botRunning]);

  /* ---------- Supabase Cloud Hydration ---------- */
  useEffect(() => {
    let isMounted = true;
    async function loadCloud() {
      if (!isSupabaseConfigured()) return;
      try {
        const res = await fetchSupabaseCloudData();
        if (isMounted && res.hasData && Object.keys(res.accounts).length > 0) {
          dispatch({ type: 'HYDRATE_ACCOUNTS', accounts: res.accounts, selectedId: 'all' });
          pushToast({
            tone: 'profit',
            title: 'Supabase Cloud Connected',
            description: `Loaded ${Object.keys(res.accounts).length} HFM trading accounts.`,
          });
        }
      } catch (err) {
        console.error('Error hydrating from Supabase cloud:', err);
      }
    }
    loadCloud();
    return () => {
      isMounted = false;
    };
  }, [pushToast]);

  /* ---------- Local MT5 Bridge Status Poller ---------- */
  useEffect(() => {
    let isMounted = true;
    async function pingBridge() {
      const start = performance.now();
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 2000);
        const res = await fetch('http://localhost:8000/api/status', { signal: ctrl.signal });
        clearTimeout(tid);
        if (res.ok) {
          const data = await res.json();
          const latency = Math.round(performance.now() - start);
          if (isMounted) {
            dispatch({
              type: 'SET_BRIDGE_STATUS',
              bridge: {
                connected: true,
                mode: 'local_mt5',
                latency,
                lastSync: data.last_sync_time || null,
                accountsCount: data.accounts_count || 0,
              },
            });
          }
          return;
        }
      } catch {
        // Bridge offline or device running remotely on mobile/cloud
      }
      if (isMounted) {
        dispatch({
          type: 'SET_BRIDGE_STATUS',
          bridge: {
            connected: false,
            mode: 'cloud_supabase',
            latency: 0,
            lastSync: null,
            accountsCount: 0,
          },
        });
      }
    }

    pingBridge();
    const interval = setInterval(pingBridge, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  /* ---------- Supabase Realtime Subscription ---------- */
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;
    const channel = supabase
      .channel('tms-realtime-sub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tms_accounts' }, async () => {
        const res = await fetchSupabaseCloudData();
        if (res.hasData) dispatch({ type: 'HYDRATE_ACCOUNTS', accounts: res.accounts });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tms_active_positions' }, async () => {
        const res = await fetchSupabaseCloudData();
        if (res.hasData) dispatch({ type: 'HYDRATE_ACCOUNTS', accounts: res.accounts });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tms_trade_journal' }, async () => {
        const res = await fetchSupabaseCloudData();
        if (res.hasData) dispatch({ type: 'HYDRATE_ACCOUNTS', accounts: res.accounts });
      })
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, []);

  /* ---------- actions ---------- */

  const selectAccount = useCallback((id: AccountId) => dispatch({ type: 'SELECT_ACCOUNT', id }), []);

  const closePosition = useCallback(
    (accountId: AccountId, ticket: number) => {
      const s = stateRef.current;
      const pos = s.accounts[accountId].positions.find((p) => p.ticket === ticket);
      if (!pos) return;
      const pnl = calcPnl(pos, s.prices[pos.symbol]);
      dispatch({ type: 'CLOSE_POSITION', accountId, ticket, now: Date.now() });
      pushToast({
        tone: pnl >= 0 ? 'profit' : 'loss',
        title: `Closed #${ticket}`,
        description: `${pos.type} ${pos.lot.toFixed(2)} ${pos.symbol} · ${fmtMoney(pnl, { sign: true })}`,
      });
    },
    [pushToast],
  );

  const breakEven = useCallback(
    (accountId: AccountId, ticket: number) => {
      const pos = stateRef.current.accounts[accountId].positions.find((p) => p.ticket === ticket);
      if (!pos) return;
      dispatch({ type: 'BREAK_EVEN', accountId, ticket, now: Date.now() });
      pushToast({
        tone: 'info',
        title: `Break-even set on #${ticket}`,
        description: `SL moved to entry ${fmtPrice(pos.entry, pos.symbol)} — risk-free trade.`,
      });
    },
    [pushToast],
  );

  const updateNote = useCallback(
    (accountId: AccountId, id: string, note: string) => {
      dispatch({ type: 'UPDATE_NOTE', accountId, id, note });
      pushToast({ tone: 'profit', title: 'Note saved', description: 'Journal entry updated.' });
    },
    [pushToast],
  );

  const setBotRunning = useCallback(
    (running: boolean) => {
      const s = stateRef.current;
      const acc = s.accounts[botAccountId(s.botMode)];
      if (running && acc.dailyLossPct >= s.config.dailyLossLimit) {
        pushToast({
          tone: 'loss',
          title: 'Circuit breaker active',
          description: 'Daily loss limit reached. Raise the limit or wait for the daily reset.',
        });
      } else {
        pushToast(
          running
            ? { tone: 'profit', title: 'Bot started', description: `Scanning ${s.config.symbol} ${s.config.timeframe}` }
            : { tone: 'warn', title: 'Bot paused', description: 'No new entries will be taken.' },
        );
      }
      dispatch({ type: 'SET_RUNNING', running, now: Date.now() });
    },
    [pushToast],
  );

  const setBotMode = useCallback(
    (mode: BotMode) => {
      dispatch({ type: 'SET_MODE', mode, now: Date.now() });
      pushToast(
        mode === 'live'
          ? { tone: 'loss', title: 'LIVE PRODUCTION mode', description: 'Bot paused. Review risk settings before starting.' }
          : { tone: 'warn', title: 'DEMO SANDBOX mode', description: 'Bot attached to Demo Sandbox #1.' },
      );
    },
    [pushToast],
  );

  const saveConfig = useCallback(
    (config: BotConfig) =>
      new Promise<void>((resolve) => {
        schedule(() => {
          dispatch({ type: 'SAVE_CONFIG', config, now: Date.now() });
          pushToast({ tone: 'profit', title: 'Configuration synced', description: 'Engine parameters updated.' });
          resolve();
        }, 750);
      }),
    [schedule, pushToast],
  );

  const panicClose = useCallback(() => {
    const s = stateRef.current;
    const n = s.accounts[botAccountId(s.botMode)].positions.length;
    dispatch({ type: 'PANIC', now: Date.now() });
    pushToast({
      tone: 'loss',
      title: 'Emergency close executed',
      description: `${n} position(s) closed · engine halted.`,
    });
  }, [pushToast]);

  const clearLogs = useCallback(() => dispatch({ type: 'CLEAR_LOGS', now: Date.now() }), []);

  const simulateSignal = useCallback(() => {
    if (simulatingRef.current) return;
    const s = stateRef.current;
    const cfg = s.config;
    const accId = botAccountId(s.botMode);
    const acc = s.accounts[accId];
    const spec = SYMBOLS[cfg.symbol];
    const strat = pick(STRATEGIES);
    const side: Side = strat.side ?? (Math.random() > 0.5 ? 'BUY' : 'SELL');
    const price = s.prices[cfg.symbol];

    log(
      'signal',
      `⚡ Setup detected: ${strat.name} on ${cfg.symbol} ${cfg.timeframe} → ${side} @ ${fmtPrice(price, cfg.symbol)}`,
    );

    const reject = (level: LogLevel, message: string, title: string) => {
      schedule(() => log(level, message), 350);
      pushToast({ tone: 'warn', title, description: message });
    };

    if (!s.botRunning) {
      return reject('warn', 'Signal ignored — engine is PAUSED. Press START BOT to accept signals.', 'Signal ignored');
    }
    if (acc.dailyLossPct >= cfg.dailyLossLimit) {
      return reject('error', 'Signal rejected — circuit breaker active (daily loss limit reached).', 'Circuit breaker active');
    }
    const active = activeSessions();
    if (!active.some((k) => cfg.sessions[k])) {
      const names = active.length ? active.map((k) => SESSION_MAP[k].short).join(' + ') : 'Off-hours';
      return reject(
        'warn',
        `Signal blocked by Session Filter — current: ${names}. Enable it in Strategy & Execution, then Save & Sync.`,
        'Blocked by session filter',
      );
    }
    const openBot = acc.positions.filter((p) => p.source === 'bot').length;
    if (openBot >= cfg.maxConcurrent) {
      return reject(
        'warn',
        `Signal rejected — Max Concurrent Trades reached (${openBot}/${cfg.maxConcurrent}).`,
        'Max concurrent trades reached',
      );
    }
    if (s.spread > cfg.maxSpread) {
      return reject(
        'warn',
        `Signal rejected — spread ${s.spread} pts exceeds filter (< ${cfg.maxSpread} pts).`,
        'Spread too wide',
      );
    }

    const lot = calcLot(cfg, acc.balance);
    const riskUsd = lot * cfg.slPoints * spec.point * spec.contract;
    simulatingRef.current = true;
    setIsSimulating(true);

    schedule(
      () =>
        log(
          'risk',
          `Risk check passed ✓ lot ${lot.toFixed(2)} · risk ${fmtMoney(riskUsd)} (${((riskUsd / acc.balance) * 100).toFixed(2)}%) · spread ${s.spread} pts · exposure ${openBot + 1}/${cfg.maxConcurrent}`,
        ),
      500,
    );
    schedule(
      () =>
        log(
          'exec',
          `Sending ${side} ${lot.toFixed(2)} ${cfg.symbol} @ MARKET · SL ${cfg.slPoints} / TP ${cfg.tpPoints} pts → ${acc.name}`,
        ),
      1050,
    );
    schedule(() => {
      const cur = stateRef.current;
      const dir = side === 'BUY' ? 1 : -1;
      const slip = Math.floor(Math.random() * 4);
      const entry = roundTo(cur.prices[cfg.symbol] + dir * slip * spec.point, spec.digits);
      const position: Position = {
        ticket: ++ticketRef.current,
        symbol: cfg.symbol,
        type: side,
        lot,
        entry,
        sl: roundTo(entry - dir * cfg.slPoints * spec.point, spec.digits),
        tp: roundTo(entry + dir * cfg.tpPoints * spec.point, spec.digits),
        openTime: Date.now(),
        source: 'bot',
        execution_type: 'BOT',
        magicNumber: 123456,
        timeframe: cfg.timeframe,
        slippageSpreadPts: s.spread,
        botTriggerLogic: `Auto: ${cfg.timeframe} ${strat.name} + Spread ${s.spread}pts`,
        strategy: strat.name,
      };
      dispatch({ type: 'OPEN_POSITION', accountId: accId, position });
      log(
        'exec',
        `✅ FILLED #${position.ticket} ${side} ${lot.toFixed(2)} ${cfg.symbol} @ ${fmtPrice(entry, cfg.symbol)} · slippage ${slip} pts · ${20 + Math.floor(Math.random() * 30)}ms`,
      );
      log(
        'risk',
        `Protective orders set · SL ${fmtPrice(position.sl, cfg.symbol)} · TP ${fmtPrice(position.tp, cfg.symbol)} · R:R 1 : ${(cfg.tpPoints / cfg.slPoints).toFixed(2)}`,
      );
      pushToast({
        tone: 'profit',
        title: `New ${side} #${position.ticket} opened (BOT #123456)`,
        description: `${lot.toFixed(2)} ${cfg.symbol} @ ${fmtPrice(entry, cfg.symbol)} · ${strat.name} → ${acc.name}`,
      });
      simulatingRef.current = false;
      setIsSimulating(false);
    }, 1700);
  }, [log, schedule, pushToast]);

  const setPortfolioViewMode = useCallback(
    (mode: PortfolioViewMode) => dispatch({ type: 'SET_VIEW_MODE', mode }),
    [],
  );

  const patchJournal = useCallback(
    async (accountId: AccountId, id: string, patch: Partial<JournalEntry>) => {
      dispatch({ type: 'PATCH_JOURNAL', accountId, id, patch });
      const ticketNum = Number(id.replace('J-', ''));
      if (ticketNum && isSupabaseConfigured()) {
        await updateCloudJournalNote(ticketNum, {
          setupTag: patch.setupTag,
          emotionTag: patch.emotionTag,
          personalNote: patch.personalNote,
          auditNote: patch.auditNote,
        });
      }
    },
    [],
  );

  const triggerSyncNow = useCallback(async () => {
    dispatch({ type: 'SET_SYNCING', syncing: true });
    try {
      let bridgeOk = false;
      try {
        const res = await fetch('http://localhost:8000/api/accounts/sync', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          bridgeOk = true;
          pushToast({
            tone: 'profit',
            title: 'MT5 Synced to Cloud',
            description: `Synced ${data.synced_count ?? 0} account(s) via Local MT5 Bridge.`,
          });
        }
      } catch {
        // bridge not reachable
      }

      if (isSupabaseConfigured()) {
        const cloud = await fetchSupabaseCloudData();
        if (cloud.hasData) {
          dispatch({ type: 'HYDRATE_ACCOUNTS', accounts: cloud.accounts });
          if (!bridgeOk) {
            pushToast({
              tone: 'info',
              title: 'Cloud Refreshed',
              description: 'Refreshed latest data directly from Supabase Cloud.',
            });
          }
        }
      } else if (!bridgeOk) {
        pushToast({
          tone: 'warn',
          title: 'Bridge Offline',
          description: 'Local MT5 Bridge is not running on port 8000 and Supabase is not configured yet.',
        });
      }
    } catch (err: any) {
      pushToast({
        tone: 'warn',
        title: 'Sync Error',
        description: err?.message || 'Failed to complete sync operation.',
      });
    } finally {
      dispatch({ type: 'SET_SYNCING', syncing: false });
    }
  }, [pushToast]);

  const addHfmAccount = useCallback(
    async (params: {
      name?: string;
      account_name?: string;
      login?: number;
      login_id?: number;
      password: string;
      server: string;
    }) => {
      const loginId = params.login_id ?? params.login ?? 0;
      const accountName = params.account_name ?? params.name ?? `HFM ${loginId}`;
      try {
        const res = await fetch('http://localhost:8000/api/accounts/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            login_id: loginId,
            password: params.password,
            server: params.server,
            account_name: accountName,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          return { ok: false, message: data.detail || data.message || 'Failed to connect account.' };
        }

        if (isSupabaseConfigured()) {
          const cloud = await fetchSupabaseCloudData();
          if (cloud.hasData) {
            dispatch({ type: 'HYDRATE_ACCOUNTS', accounts: cloud.accounts, selectedId: `hfm-${loginId}` });
          }
        }
        pushToast({
          tone: 'profit',
          title: 'HFM Account Connected',
          description: `Account #${loginId} verified and synced with Supabase.`,
        });
        return { ok: true };
      } catch (err: any) {
        return {
          ok: false,
          message: err.message?.includes('Failed to fetch')
            ? 'Local MT5 Bridge is not running on port 8000. Start `run_sync.bat` in `tms-bot` first.'
            : err.message,
        };
      }
    },
    [pushToast],
  );

  const value = useMemo<TradingContextValue>(
    () => ({
      state,
      toasts,
      isSimulating,
      addAccountModalOpen,
      setAddAccountModalOpen,
      selectAccount,
      setPortfolioViewMode,
      closePosition,
      breakEven,
      updateNote,
      patchJournal,
      setBotRunning,
      setBotMode,
      saveConfig,
      panicClose,
      simulateSignal,
      clearLogs,
      pushToast,
      dismissToast,
      triggerSyncNow,
      addHfmAccount,
    }),
    [
      state,
      toasts,
      isSimulating,
      addAccountModalOpen,
      setAddAccountModalOpen,
      selectAccount,
      setPortfolioViewMode,
      closePosition,
      breakEven,
      updateNote,
      patchJournal,
      setBotRunning,
      setBotMode,
      saveConfig,
      panicClose,
      simulateSignal,
      clearLogs,
      pushToast,
      dismissToast,
      triggerSyncNow,
      addHfmAccount,
    ],
  );

  return <TradingContext.Provider value={value}>{children}</TradingContext.Provider>;
}
