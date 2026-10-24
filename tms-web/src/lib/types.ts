export type SymbolCode = 'XAUUSD' | 'EURUSD' | 'GBPUSD';
export type Side = 'BUY' | 'SELL';
export type TradeSource = 'bot' | 'manual';
export type ExecutionType = 'MANUAL' | 'BOT';
export type PortfolioViewMode = 'manual' | 'bot' | 'combined';

export type AccountId = string;
export type BridgeMode = 'local_mt5' | 'cloud_supabase';

export interface BridgeStatus {
  connected: boolean;
  mode: BridgeMode;
  latency: number;
  lastSync: string | null;
  accountsCount: number;
}

export type BotMode = 'demo' | 'live';
export type Timeframe = 'M1' | 'M5' | 'M15' | 'H1';
export type SessionKey = 'asian' | 'london' | 'newYork';
export type CloseReason = 'TP' | 'SL' | 'BE' | 'TRAIL' | 'MANUAL' | 'PANIC';
export type LotMode = 'risk' | 'fixed';
export type Tone = 'profit' | 'loss' | 'warn' | 'info';
export type LogLevel =
  | 'system'
  | 'market'
  | 'scanner'
  | 'signal'
  | 'exec'
  | 'risk'
  | 'warn'
  | 'error'
  | 'config';

export const MANUAL_SETUP_TAGS = [
  'HTF Order Block',
  'Liquidity Sweep',
  'FVG Tap',
  'CHOCH Confirmation',
  'Break & Retest',
  'Supply / Demand Flip',
] as const;

export const MANUAL_EMOTION_TAGS = [
  'Focused 🎯',
  'Followed Plan ✅',
  'FOMO ⚠️',
  'Hesitant ⏳',
  'Revenge ❌',
] as const;

export interface Position {
  ticket: number;
  symbol: SymbolCode;
  type: Side;
  lot: number;
  entry: number;
  sl: number;
  tp: number;
  openTime: number;
  source: TradeSource;
  execution_type: ExecutionType;
  magicNumber: number; // 0 for MANUAL, e.g. 123456 for BOT
  strategy: string;
  beApplied?: boolean;
  timeframe?: Timeframe;
  slippageSpreadPts?: number;
  botTriggerLogic?: string;
  setupTag?: string;
  emotionTag?: string;
}

export interface JournalEntry {
  id: string;
  ticket: number;
  openTime: number;
  closeTime: number;
  symbol: SymbolCode;
  type: Side;
  lot: number;
  entry: number;
  exit: number;
  pnl: number;
  source: TradeSource;
  execution_type: ExecutionType;
  magicNumber: number; // 0 for MANUAL, e.g. 123456 for BOT
  strategy: string;
  closeReason?: CloseReason;

  // Manual discretionary trade fields
  setupTag?: string;
  emotionTag?: string;
  rrAchieved?: number; // e.g. 2.5 (+2.5R) or -1.0 (-1.0R)
  personalNote?: string;

  // Bot automated execution fields
  timeframe?: Timeframe;
  slippageSpreadPts?: number;
  botTriggerLogic?: string;
  auditNote?: string;

  // General note fallback
  note: string;
}

export interface EquityPoint {
  date: number;
  equity: number;
}

export interface SessionStat {
  key: SessionKey;
  pnl: number;
  winRate: number;
  trades: number;
}

export interface AccountStats {
  winRate: number;
  profitFactor: number;
  avgRR: number;
  maxDrawdown: number;
  totalTrades: number;
}

export interface Account {
  id: AccountId;
  name: string;
  kind: BotMode;
  login: string;
  server: string;
  leverage: number;
  balance: number;
  dailyStartBalance: number;
  /** Realized loss today as % of the day's starting balance (feeds the circuit breaker). */
  dailyLossPct: number;
  positions: Position[];
  journal: JournalEntry[];
  equityHistory: EquityPoint[];
  equityHistoryManual?: EquityPoint[];
  equityHistoryBot?: EquityPoint[];
  stats: AccountStats;
  sessions: SessionStat[];
}

export interface BotConfig {
  symbol: SymbolCode;
  timeframe: Timeframe;
  sessions: Record<SessionKey, boolean>;
  slPoints: number;
  tpPoints: number;
  autoBE: boolean;
  trailingStop: boolean;
  trailingPoints: number;
  lotMode: LotMode;
  riskPercent: number;
  fixedLot: number;
  dailyLossLimit: number;
  maxConcurrent: number;
  maxSpread: number;
}

export interface LogEntry {
  id: number;
  ts: number;
  level: LogLevel;
  message: string;
}

export interface Toast {
  id: string;
  tone: Tone;
  title: string;
  description?: string;
}
