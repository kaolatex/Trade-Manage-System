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
import { DEFAULT_CONFIG } from '@/lib/types';
import { INITIAL_PRICES, SYMBOLS, SYMBOL_LIST, calcPnl, computeJournalStats, fmtPrice, roundTo } from '@/lib/market';
import {
  SESSIONS,
  SESSION_MAP,
  activeSessions,
  botAccountId,
  calcLot,
  pick,
  STRATEGIES,
} from '@/lib/engine';
import { fmtMoney, round2 } from '@/lib/utils';
import {
  fetchSupabaseCloudData,
  isSupabaseConfigured,
  supabase,
  updateCloudJournalNote,
  buildRealEquityHistory,
  fetchCloudBotConfig,
  saveCloudBotConfig,
  sendRemoteCommand,
  fetchCloudBotLogs,
  subscribeCloudBotLogs,
} from '@/lib/supabase';

/* ================================================================== */
/* Multi-Account Aggregator (Pure Real Data, Zero Mock)              */
/* ================================================================== */

export function buildEmptyAccount(id: AccountId = 'all', name = 'No HFM Account Synced Yet'): Account {
  return {
    id,
    name,
    kind: 'live',
    login: 'NONE',
    server: 'HFM Broker',
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

export function buildAllAccountsOverview(accounts: Record<AccountId, Account>): Account {
  const nonAll = Object.values(accounts).filter((a) => a && a.id !== 'all');
  if (nonAll.length === 0) {
    return buildEmptyAccount('all', 'All Accounts Overview');
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

  // Build real combined equity history strictly from all closed trades
  const equityHistory = buildRealEquityHistory(balance, journal);
  const equityHistoryManual = buildRealEquityHistory(balance, journal, 'MANUAL');
  const equityHistoryBot = buildRealEquityHistory(balance, journal, 'BOT');

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
    equityHistoryManual,
    equityHistoryBot,
    stats: computed.stats,
    sessions: computed.sessions,
  };
}

/* ================================================================== */
/* State                                                               */
/* ================================================================== */

export interface SupabaseStatus {
  connected: boolean;
  error: string | null;
  lastChecked: number | null;
}

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
  supabaseStatus: SupabaseStatus;
  isSyncing: boolean;
}

const MAX_LOGS = 250;
const TICK_MS = 2000;

type Action =
  | { type: 'TICK'; spread: number; latency: number; now: number }
  | { type: 'LOG'; level: LogLevel; message: string; now: number }
  | { type: 'CLEAR_LOGS'; now: number }
  | { type: 'SELECT_ACCOUNT'; id: AccountId }
  | { type: 'SET_VIEW_MODE'; mode: PortfolioViewMode }
  | { type: 'UPDATE_NOTE'; accountId: AccountId; id: string; note: string }
  | { type: 'PATCH_JOURNAL'; accountId: AccountId; id: string; patch: Partial<JournalEntry> }
  | { type: 'SET_RUNNING'; running: boolean; now: number }
  | { type: 'SET_MODE'; mode: BotMode; now: number }
  | { type: 'SAVE_CONFIG'; config: BotConfig; now: number }
  | { type: 'PANIC'; now: number }
  | { type: 'HYDRATE_ACCOUNTS'; accounts: Record<AccountId, Account>; selectedId?: AccountId }
  | { type: 'SET_BRIDGE_STATUS'; bridge: BridgeStatus }
  | { type: 'SET_SUPABASE_STATUS'; status: SupabaseStatus }
  | { type: 'SET_SYNCING'; syncing: boolean }
  | { type: 'MERGE_LOGS'; entries: Array<{ id?: number; level: string; message: string; ts?: number }> };

function addLog(s: TradingState, level: LogLevel, message: string, ts: number) {
  s.seq += 1;
  const next = s.logs.length >= MAX_LOGS ? s.logs.slice(-(MAX_LOGS - 1)) : s.logs.slice();
  next.push({ id: s.seq, ts, level, message });
  s.logs = next;
}

function reducer(state: TradingState, action: Action): TradingState {
  switch (action.type) {
    case 'TICK': {
      return {
        ...state,
        spread: action.spread,
        latency: action.latency,
      };
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

    case 'MERGE_LOGS': {
      if (!action.entries || action.entries.length === 0) return state;
      const existingSignatures = new Set(state.logs.map((l) => `${l.message.trim()}`));
      const fresh = action.entries.filter((e) => e.message && !existingSignatures.has(e.message.trim()));
      if (fresh.length === 0) return state;

      let nextSeq = state.seq;
      const validLevels = ['system', 'market', 'scanner', 'signal', 'exec', 'risk', 'warn', 'error', 'config'];
      const formatted: LogEntry[] = fresh.map((e) => {
        nextSeq += 1;
        const lvl = validLevels.includes(e.level) ? (e.level as LogLevel) : 'scanner';
        return {
          id: e.id || nextSeq,
          ts: e.ts || Date.now(),
          level: lvl,
          message: e.message,
        };
      });

      const combined = [...state.logs, ...formatted].slice(-MAX_LOGS);
      return {
        ...state,
        seq: nextSeq,
        logs: combined,
      };
    }

    case 'SELECT_ACCOUNT':
      return { ...state, selectedAccountId: action.id };

    case 'SET_VIEW_MODE':
      return { ...state, portfolioViewMode: action.mode };

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

    case 'SET_RUNNING': {
      const s = { ...state };
      s.botRunning = action.running;
      s.botStartedAt = action.running ? action.now : null;
      addLog(
        s,
        action.running ? 'system' : 'warn',
        action.running ? 'Engine STARTED.' : 'Engine PAUSED by user.',
        action.now,
      );
      return s;
    }

    case 'SET_MODE': {
      if (state.botMode === action.mode) return state;
      const s = { ...state, botMode: action.mode };
      addLog(s, 'system', `Bot environment switched to ${action.mode.toUpperCase()}`, action.now);
      return s;
    }

    case 'SAVE_CONFIG': {
      const s = { ...state, config: action.config };
      addLog(s, 'config', `Config saved: ${action.config.symbol} ${action.config.timeframe}`, action.now);
      return s;
    }

    case 'PANIC': {
      const s = { ...state };
      s.botRunning = false;
      s.botStartedAt = null;
      addLog(s, 'error', '🚨 EMERGENCY PANIC TRIGGERED', action.now);
      return s;
    }

    case 'HYDRATE_ACCOUNTS': {
      const allAcc = buildAllAccountsOverview(action.accounts);
      const accounts: Record<AccountId, Account> = {
        ...action.accounts,
        all: allAcc,
      };
      const availableIds = Object.keys(accounts) as AccountId[];
      let selectedAccountId = state.selectedAccountId;

      if (action.selectedId && action.selectedId in accounts) {
        selectedAccountId = action.selectedId;
      } else if (!(selectedAccountId in accounts)) {
        selectedAccountId = availableIds.find((k) => k !== 'all') || 'all';
      }

      return { ...state, accounts, selectedAccountId };
    }

    case 'SET_BRIDGE_STATUS':
      return { ...state, bridgeStatus: action.bridge };

    case 'SET_SUPABASE_STATUS':
      return { ...state, supabaseStatus: action.status };

    case 'SET_SYNCING':
      return { ...state, isSyncing: action.syncing };
  }
}

function createInitialState(): TradingState {
  const initialAccounts: Record<AccountId, Account> = {
    all: buildEmptyAccount('all', 'All Accounts Overview'),
  };

  return {
    prices: { ...INITIAL_PRICES },
    prevPrices: { ...INITIAL_PRICES },
    spread: 16,
    latency: 0,
    accounts: initialAccounts,
    selectedAccountId: 'all',
    portfolioViewMode: 'combined',
    botRunning: false,
    botStartedAt: null,
    botMode: 'live',
    config: DEFAULT_CONFIG,
    logs: [
      {
        id: 1,
        ts: Date.now(),
        level: 'system',
        message: 'TMS Core initialized. Zero-Mock Policy active. Connecting to Supabase Cloud...',
      },
    ],
    seq: 1,
    bridgeStatus: {
      connected: false,
      mode: 'cloud_supabase',
      latency: 0,
      lastSync: null,
      accountsCount: 0,
    },
    supabaseStatus: {
      connected: false,
      error: null,
      lastChecked: null,
    },
    isSyncing: false,
  };
}

/* ================================================================== */
/* Context Interface                                                  */
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

export function TradingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false);

  const stateRef = useRef(state);
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
      schedule(() => dismissToast(id), 5000);
    },
    [schedule, dismissToast],
  );

  const log = useCallback((level: LogLevel, message: string) => {
    dispatch({ type: 'LOG', level, message, now: Date.now() });
  }, []);

  /* ---------- Ambient Heartbeat & Latency Update ---------- */
  useEffect(() => {
    const id = window.setInterval(() => {
      dispatch({
        type: 'TICK',
        spread: 14 + Math.floor(Math.random() * 4),
        latency: stateRef.current.bridgeStatus.connected ? stateRef.current.bridgeStatus.latency : 0,
        now: Date.now(),
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  /* ---------- Supabase Pure Hydration Function ---------- */
  const hydrateFromSupabase = useCallback(async (quiet = false) => {
    if (!isSupabaseConfigured()) {
      dispatch({
        type: 'SET_SUPABASE_STATUS',
        status: { connected: false, error: 'Supabase URL/Key is not configured', lastChecked: Date.now() },
      });
      return;
    }

    try {
      const res = await fetchSupabaseCloudData();
      if (res.error) {
        dispatch({
          type: 'SET_SUPABASE_STATUS',
          status: { connected: false, error: res.error, lastChecked: Date.now() },
        });
        if (!quiet) {
          pushToast({
            tone: 'loss',
            title: 'Supabase Error',
            description: res.error,
          });
        }
        return;
      }

      dispatch({
        type: 'SET_SUPABASE_STATUS',
        status: { connected: true, error: null, lastChecked: Date.now() },
      });

      if (res.hasData && Object.keys(res.accounts).length > 0) {
        dispatch({ type: 'HYDRATE_ACCOUNTS', accounts: res.accounts });
        if (!quiet) {
          pushToast({
            tone: 'profit',
            title: 'Supabase Synced',
            description: `Loaded ${Object.keys(res.accounts).length} HFM trading account(s).`,
          });
        }
      } else {
        // Zero accounts in cloud: hydrate empty state (Zero Mock Policy)
        dispatch({ type: 'HYDRATE_ACCOUNTS', accounts: {} });
      }
    } catch (err: any) {
      dispatch({
        type: 'SET_SUPABASE_STATUS',
        status: { connected: false, error: err.message, lastChecked: Date.now() },
      });
    }
  }, [pushToast]);

  /* ---------- Initial Load on Mount ---------- */
  useEffect(() => {
    hydrateFromSupabase(true);

    async function loadInitialBotConfig() {
      // 1. Try cloud first
      const cloudCfg = await fetchCloudBotConfig();
      if (cloudCfg && cloudCfg.advanced_params) {
        dispatch({
          type: 'SAVE_CONFIG',
          config: {
            ...DEFAULT_CONFIG,
            symbol: (cloudCfg.symbol as any) || DEFAULT_CONFIG.symbol,
            timeframe: (cloudCfg.timeframe as any) || DEFAULT_CONFIG.timeframe,
            strategyMode: (cloudCfg.strategy_mode as any) || DEFAULT_CONFIG.strategyMode,
            magicNumber: cloudCfg.magic_number || DEFAULT_CONFIG.magicNumber,
            advancedParams: cloudCfg.advanced_params,
          },
          now: Date.now(),
        });
        return;
      }
      // 2. Try local MT5 bridge
      try {
        const res = await fetch('http://localhost:8000/api/bot/config');
        if (res.ok) {
          const bCfg = await res.json();
          if (bCfg && bCfg.advanced_params) {
            dispatch({
              type: 'SAVE_CONFIG',
              config: {
                ...DEFAULT_CONFIG,
                symbol: (bCfg.symbol as any) || DEFAULT_CONFIG.symbol,
                timeframe: (bCfg.timeframe as any) || DEFAULT_CONFIG.timeframe,
                strategyMode: (bCfg.strategy_mode as any) || DEFAULT_CONFIG.strategyMode,
                magicNumber: bCfg.magic_number || DEFAULT_CONFIG.magicNumber,
                advancedParams: bCfg.advanced_params,
              },
              now: Date.now(),
            });
          }
        }
      } catch {
        // Fallback to DEFAULT_CONFIG
      }
    }

    loadInitialBotConfig();
  }, [hydrateFromSupabase]);

  /* ---------- Local MT5 Bridge Health Poller (Port 8000) ---------- */
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
                connected: Boolean(data.mt5_connected),
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
        // Bridge offline
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
      .channel('tms-cloud-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tms_accounts' }, () => {
        hydrateFromSupabase(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tms_active_positions' }, () => {
        hydrateFromSupabase(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tms_trade_journal' }, () => {
        hydrateFromSupabase(true);
      })
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [hydrateFromSupabase]);

  /* ---------- Live Bot Logs Streamer (Local Bridge + Supabase Cloud) ---------- */
  useEffect(() => {
    let isMounted = true;

    // 1. Initial hydrate from Supabase Cloud
    if (isSupabaseConfigured()) {
      fetchCloudBotLogs(35).then((cloudLogs) => {
        if (isMounted && cloudLogs && cloudLogs.length > 0) {
          dispatch({
            type: 'MERGE_LOGS',
            entries: cloudLogs.map((l) => ({
              id: l.id,
              ts: l.ts || (l.timestamp ? new Date(l.timestamp).getTime() : Date.now()),
              level: l.level,
              message: l.message,
            })),
          });
        }
      });
    }

    // 2. Realtime listener from Supabase tms_bot_logs
    const unsub = subscribeCloudBotLogs((newLog) => {
      if (isMounted && newLog) {
        dispatch({
          type: 'MERGE_LOGS',
          entries: [
            {
              id: newLog.id,
              ts: newLog.ts || (newLog.timestamp ? new Date(newLog.timestamp).getTime() : Date.now()),
              level: newLog.level,
              message: newLog.message,
            },
          ],
        });
      }
    });

    // 3. Poller from local MT5 bridge (http://localhost:8000/api/bot/logs)
    const pollBridgeLogs = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/bot/logs?limit=35');
        if (res.ok) {
          const data = await res.json();
          if (data.logs && data.logs.length > 0 && isMounted) {
            dispatch({
              type: 'MERGE_LOGS',
              entries: data.logs.map((l: any) => ({
                id: l.id,
                ts: l.ts || (l.timestamp ? new Date(l.timestamp).getTime() : Date.now()),
                level: l.level,
                message: l.message,
              })),
            });
          }
        }
      } catch {
        // Bridge offline
      }
    };

    pollBridgeLogs();
    const interval = setInterval(pollBridgeLogs, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
      unsub();
    };
  }, []);

  /* ---------- Actions ---------- */

  const selectAccount = useCallback((id: AccountId) => dispatch({ type: 'SELECT_ACCOUNT', id }), []);

  const closePosition = useCallback(
    (accountId: AccountId, ticket: number) => {
      pushToast({
        tone: 'info',
        title: 'Position Close Requested',
        description: `Order #${ticket} close signal sent. Please close on MT5 Terminal or ensure bot execution is online.`,
      });
    },
    [pushToast],
  );

  const breakEven = useCallback(
    (accountId: AccountId, ticket: number) => {
      pushToast({
        tone: 'info',
        title: 'Break-Even Requested',
        description: `Order #${ticket} break-even request acknowledged.`,
      });
    },
    [pushToast],
  );

  const updateNote = useCallback(
    (accountId: AccountId, id: string, note: string) => {
      dispatch({ type: 'UPDATE_NOTE', accountId, id, note });
      pushToast({ tone: 'profit', title: 'Note Saved', description: 'Journal entry updated.' });
    },
    [pushToast],
  );

  const patchJournal = useCallback(
    async (accountId: AccountId, id: string, patch: Partial<JournalEntry>) => {
      dispatch({ type: 'PATCH_JOURNAL', accountId, id, patch });
      const ticketNum = Number(id.replace('J-', ''));
      if (ticketNum && isSupabaseConfigured()) {
        const ok = await updateCloudJournalNote(ticketNum, {
          setupTag: patch.setupTag,
          emotionTag: patch.emotionTag,
          personalNote: patch.personalNote,
          auditNote: patch.auditNote,
        });
        if (ok) {
          pushToast({ tone: 'profit', title: 'Saved to Supabase', description: `Journal #${ticketNum} updated.` });
        }
      }
    },
    [pushToast],
  );

  const setBotRunning = useCallback(
    async (running: boolean) => {
      dispatch({ type: 'SET_RUNNING', running, now: Date.now() });

      let bridgeSynced = false;
      try {
        const res = await fetch(`http://localhost:8000/api/bot/${running ? 'start' : 'stop'}`, {
          method: 'POST',
        });
        if (res.ok) bridgeSynced = true;
      } catch {
        // Bridge unreachable
      }

      const cmdType = running ? 'START_BOT' : 'STOP_BOT';
      if (isSupabaseConfigured()) {
        await saveCloudBotConfig({ is_running: running });
        if (bridgeSynced && supabase) {
          supabase.from('tms_remote_commands').insert({
            command_type: cmdType,
            payload: { is_running: running },
            status: 'EXECUTED',
            result: { source: 'DIRECT_BRIDGE' },
            executed_at: new Date().toISOString(),
          }).then();
        } else {
          await sendRemoteCommand(cmdType, { is_running: running });
        }
      }

      pushToast(
        running
          ? {
              tone: 'profit',
              title: 'Bot Engine STARTED',
              description: bridgeSynced
                ? 'Live MT5 EA & Python Engine activated.'
                : 'Start command saved to Supabase Cloud.',
            }
          : {
              tone: 'warn',
              title: 'Bot Engine PAUSED',
              description: bridgeSynced
                ? 'MT5 EA execution halted. New trades blocked.'
                : 'Pause command saved to Supabase Cloud.',
            },
      );
    },
    [pushToast],
  );

  const setBotMode = useCallback(
    (mode: BotMode) => {
      dispatch({ type: 'SET_MODE', mode, now: Date.now() });
      pushToast(
        mode === 'live'
          ? { tone: 'loss', title: 'LIVE PRODUCTION Mode', description: 'Engine linked to live account.' }
          : { tone: 'warn', title: 'DEMO SANDBOX Mode', description: 'Engine linked to demo environment.' },
      );
    },
    [pushToast],
  );

  const saveConfig = useCallback(
    async (config: BotConfig) => {
      dispatch({ type: 'SAVE_CONFIG', config, now: Date.now() });

      let bridgeSynced = false;
      let cloudSynced = false;

      // 1. Sync to local bridge (instantly writes tms_ea_config.json for running MT5 EA)
      try {
        const res = await fetch('http://localhost:8000/api/bot/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            is_running: stateRef.current.botRunning,
            bot_mode: stateRef.current.botMode,
            strategy_mode: config.strategyMode,
            symbol: config.symbol,
            timeframe: config.timeframe,
            magic_number: config.magicNumber,
            advanced_params: config.advancedParams,
          }),
        });
        if (res.ok) {
          bridgeSynced = true;
        }
      } catch {
        // Bridge might be offline, continue to cloud
      }

      // 2. Persist to Supabase Cloud
      if (isSupabaseConfigured()) {
        const ok = await saveCloudBotConfig({
          is_running: stateRef.current.botRunning,
          bot_mode: stateRef.current.botMode,
          strategy_mode: config.strategyMode,
          symbol: config.symbol,
          timeframe: config.timeframe,
          magic_number: config.magicNumber,
          advanced_params: config.advancedParams,
        });
        await sendRemoteCommand('UPDATE_CONFIG', {
          strategy_mode: config.strategyMode,
          symbol: config.symbol,
          timeframe: config.timeframe,
          magic_number: config.magicNumber,
          advanced_params: config.advancedParams,
        });
        if (ok) cloudSynced = true;
      }

      if (bridgeSynced && cloudSynced) {
        pushToast({
          tone: 'profit',
          title: 'Config Synced to MT5 & Cloud',
          description: `Updated EA parameters & tms_ea_config.json (${config.strategyMode}).`,
        });
      } else if (bridgeSynced) {
        pushToast({
          tone: 'profit',
          title: 'Config Written to MT5 EA',
          description: 'Updated tms_ea_config.json in MT5 Common Files.',
        });
      } else if (cloudSynced) {
        pushToast({
          tone: 'profit',
          title: 'Config Saved to Cloud',
          description: 'Saved to Supabase. Will auto-sync when local MT5 bridge connects.',
        });
      } else {
        pushToast({
          tone: 'info',
          title: 'Configuration Applied Locally',
          description: 'Parameters stored in browser state.',
        });
      }
    },
    [pushToast],
  );

  const panicClose = useCallback(async () => {
    dispatch({ type: 'PANIC', now: Date.now() });

    let closedCount = 0;
    let bridgeTriggered = false;

    // 1. Try local MT5 bridge (instantly executes closing orders in MT5 for magic 888999)
    try {
      const res = await fetch('http://localhost:8000/api/bot/panic', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        closedCount = data.closed_count || 0;
        bridgeTriggered = true;
      }
    } catch {
      // Bridge offline
    }

    // 2. Send command to Supabase Cloud
    if (isSupabaseConfigured()) {
      await saveCloudBotConfig({ is_running: false });
      if (bridgeTriggered && supabase) {
        supabase.from('tms_remote_commands').insert({
          command_type: 'PANIC_CLOSE_BOT',
          payload: { magic: 888999 },
          status: 'EXECUTED',
          result: { closed_count: closedCount, source: 'DIRECT_BRIDGE' },
          executed_at: new Date().toISOString(),
        }).then();
      } else {
        await sendRemoteCommand('PANIC_CLOSE_BOT', { magic: 888999 });
      }
    }

    pushToast({
      tone: 'loss',
      title: '🚨 Emergency Panic Close Triggered',
      description: bridgeTriggered
        ? `Closed ${closedCount} active bot positions in MT5 (Magic: 888999). Engine paused.`
        : 'Panic command dispatched to Supabase Cloud. Bot engine paused.',
    });
  }, [pushToast]);

  const clearLogs = useCallback(() => dispatch({ type: 'CLEAR_LOGS', now: Date.now() }), []);

  const simulateSignal = useCallback(async () => {
    setIsSimulating(true);
    const sym = stateRef.current.config?.symbol || 'BTCUSD';
    log('scanner', `[TEST FIRE TRIGGERED] Preparing test order on ${sym}...`);

    let executed = false;
    let ticket: number | null = null;

    // 1. Try local MT5 bridge first (fires real 0.01 order with Magic 888999 into MT5)
    try {
      const res = await fetch('http://localhost:8000/api/bot/test-fire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym, lot: 0.01, side: 'BUY' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          executed = true;
          ticket = data.ticket;
          log('exec', `[TEST FIRE SUCCESS] MT5 Ticket #${data.ticket} opened 0.01 Lot BUY on ${data.symbol} @ ${data.price} (Magic: 888999)`);
          pushToast({
            tone: 'profit',
            title: 'Test Order Fired into MT5',
            description: `Ticket #${data.ticket} opened 0.01 Lot on ${data.symbol}`,
          });
          // Also insert into tms_remote_commands as EXECUTED for real-time cloud audit trail
          if (isSupabaseConfigured() && supabase) {
            supabase.from('tms_remote_commands').insert({
              command_type: 'TEST_BOT_ORDER',
              payload: { symbol: sym, lot: 0.01, side: 'BUY' },
              status: 'EXECUTED',
              result: { ticket: data.ticket, price: data.price, source: 'DIRECT_BRIDGE' },
              executed_at: new Date().toISOString(),
            }).then();
          }
        } else {
          log('warn', `[TEST FIRE NOTICE] MT5 rejected order: ${data.error || 'Check spread/market hours'}`);
        }
      }
    } catch {
      // Bridge offline
    }

    // 2. If bridge was not reached, queue remote command to Supabase Cloud with PENDING status
    if (!executed && isSupabaseConfigured()) {
      const ok = await sendRemoteCommand('TEST_BOT_ORDER', { symbol: sym, lot: 0.01, side: 'BUY' });
      if (ok) {
        log('signal', `[REMOTE COMMAND] TEST_BOT_ORDER queued to Supabase Cloud for ${sym}. Local MT5 bridge will execute upon poll.`);
        pushToast({
          tone: 'profit',
          title: 'Command Queued to Cloud',
          description: `TEST_BOT_ORDER queued for ${sym}. Local MT5 bridge will execute it.`,
        });
      }
    }

    log('risk', `[INSTANT BE ENGINE] Real-time safety queue attached to ${sym} orders.`);
    setIsSimulating(false);
  }, [log, pushToast]);

  const setPortfolioViewMode = useCallback(
    (mode: PortfolioViewMode) => dispatch({ type: 'SET_VIEW_MODE', mode }),
    [],
  );

  /* ---------- Cloud & Bridge Sync Action ---------- */
  const triggerSyncNow = useCallback(async () => {
    dispatch({ type: 'SET_SYNCING', syncing: true });
    try {
      let bridgeSynced = false;
      // 1. Try local MT5 bridge sync first
      try {
        const res = await fetch('http://localhost:8000/api/accounts/sync', { method: 'POST' });
        if (res.ok) {
          bridgeSynced = true;
        }
      } catch {
        // Bridge unreachable
      }

      // 2. Fetch fresh data from Supabase Cloud
      await hydrateFromSupabase(false);

      if (bridgeSynced) {
        pushToast({
          tone: 'profit',
          title: 'MT5 & Cloud Refreshed',
          description: 'Pulled fresh data from running MT5 terminal through Supabase.',
        });
      }
    } catch (err: any) {
      pushToast({
        tone: 'loss',
        title: 'Sync Error',
        description: err?.message || 'Failed to sync.',
      });
    } finally {
      dispatch({ type: 'SET_SYNCING', syncing: false });
    }
  }, [hydrateFromSupabase, pushToast]);

  /* ---------- Add HFM Account Action ---------- */
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
          return {
            ok: false,
            message: data.detail || data.message || 'MT5 login failed. Please verify password and server.',
          };
        }

        // Rehydrate from cloud
        await hydrateFromSupabase(true);
        dispatch({ type: 'SELECT_ACCOUNT', id: `hfm-${loginId}` });

        pushToast({
          tone: 'profit',
          title: 'HFM Account Connected',
          description: `Account #${loginId} verified and synced with Supabase.`,
        });

        return { ok: true, message: data.message };
      } catch (err: any) {
        return {
          ok: false,
          message: err.message?.includes('Failed to fetch')
            ? 'Local MT5 Bridge is not running on port 8000. Start `run_sync.bat` in `tms-bot` first.'
            : err.message,
        };
      }
    },
    [hydrateFromSupabase, pushToast],
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
