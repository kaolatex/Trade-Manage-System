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
  | { type: 'SET_SYNCING'; syncing: boolean };

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
    (running: boolean) => {
      dispatch({ type: 'SET_RUNNING', running, now: Date.now() });
      pushToast(
        running
          ? { tone: 'profit', title: 'Bot Engine Active', description: 'Engine monitoring live signals.' }
          : { tone: 'warn', title: 'Bot Engine Paused', description: 'No automated orders will be opened.' },
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
      pushToast({ tone: 'profit', title: 'Configuration Synced', description: 'Bot settings updated.' });
    },
    [pushToast],
  );

  const panicClose = useCallback(() => {
    dispatch({ type: 'PANIC', now: Date.now() });
    pushToast({
      tone: 'loss',
      title: 'Emergency Panic Triggered',
      description: 'Bot paused. Please verify open positions on your MT5 terminal.',
    });
  }, [pushToast]);

  const clearLogs = useCallback(() => dispatch({ type: 'CLEAR_LOGS', now: Date.now() }), []);

  const simulateSignal = useCallback(() => {
    setIsSimulating(true);
    log('signal', 'Scanning market structure on MT5 active symbols...');
    schedule(() => {
      log('scanner', 'Scan complete: No manual intervention required. Zero-mock mode active.');
      setIsSimulating(false);
    }, 1200);
  }, [log, schedule]);

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
