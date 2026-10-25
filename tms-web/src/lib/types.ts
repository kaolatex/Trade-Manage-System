export type SymbolCode = 'XAUUSD' | 'BTCUSD' | '#BTCUSD' | 'EURUSD' | 'GBPUSD';
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

export type StrategyMode = 'MODE_AGGRESSIVE_SCALPER' | 'MODE_ADAPTIVE_QUANT';

export interface AdvancedStrategyParams {
  strategyMode: StrategyMode;
  timeframe: Timeframe;
  magicNumber: number;
  orderComment: string;
  // Scalper & Multi-EMA Ribbon
  useMultiEmaRibbon: boolean;
  ema9Fast: number;
  ema21Pullback: number;
  ema50Medium: number;
  ema200Macro: number;
  minEmaSlope: number;
  emaTrendPeriod: number;
  bbPeriod: number;
  bbDeviation: number;
  stochRsiK: number;
  stochRsiOversold: number;
  stochRsiOverbought: number;
  minRejectionWickPct: number;
  newsSpikeFilterAtr: number;
  // 3,000-Bar Quant
  use3000BarQuantFilter: boolean;
  lookbackBars: number;
  patternLength: number;
  forwardHorizonBars: number;
  minWinProbabilityPct: number;
  zScoreThreshold: number;
  dynamicAtrSlMult: number;
  dynamicAtrTpMult: number;
}

export interface AdvancedLayeringParams {
  lotMode: 'fixed' | 'risk';
  baseLot: number;
  riskPercent: number;
  maxLayers: number;
  useSmartPyramiding: boolean;
  maxOpenPositions: number;
  lotMultiplier: number;
  minStepPoints: number;
  useDynamicAtrStep: boolean;
  atrStepMult: number;
  layerCooldownSec: number;
}

export interface AdvancedBasketParams {
  singleTpUsd: number;
  singleTpPoints: number;
  singleSlPoints: number;
  useBasketClose: boolean;
  basketTargetUsd: number;
  useAutoBreakEven: boolean;
  beTriggerPoints: number;
  beLockPoints: number;
  useInstantSmartBE: boolean;
  instantBeTriggerPoints: number;
  instantBeLockPoints: number;
  instantBeMinUsd: number;
  useTrailingStop: boolean;
  trailStartPoints: number;
  trailStepPoints: number;
}

export interface AdvancedRiskParams {
  maxSpreadPoints: number;
  dailyMaxLossUsd: number;
  dailyTargetProfitUsd: number;
  tradeAsianSession: boolean;
  tradeLondonSession: boolean;
  tradeNySession: boolean;
}

export interface AdvancedEaParams {
  strategy: AdvancedStrategyParams;
  layering: AdvancedLayeringParams;
  basket: AdvancedBasketParams;
  risk: AdvancedRiskParams;
}

export const DEFAULT_ADVANCED_PARAMS: AdvancedEaParams = {
  strategy: {
    strategyMode: 'MODE_AGGRESSIVE_SCALPER',
    timeframe: 'M15',
    magicNumber: 888999,
    orderComment: 'TMS-Quantum-EA',
    useMultiEmaRibbon: true,
    ema9Fast: 9,
    ema21Pullback: 21,
    ema50Medium: 50,
    ema200Macro: 200,
    minEmaSlope: 5.0,
    emaTrendPeriod: 50,
    bbPeriod: 20,
    bbDeviation: 1.8,
    stochRsiK: 14,
    stochRsiOversold: 22.0,
    stochRsiOverbought: 78.0,
    minRejectionWickPct: 20.0,
    newsSpikeFilterAtr: 2.8,
    use3000BarQuantFilter: true,
    lookbackBars: 3000,
    patternLength: 5,
    forwardHorizonBars: 10,
    minWinProbabilityPct: 55.0,
    zScoreThreshold: 1.5,
    dynamicAtrSlMult: 1.5,
    dynamicAtrTpMult: 2.5,
  },
  layering: {
    lotMode: 'fixed',
    baseLot: 0.01,
    riskPercent: 1.0,
    maxLayers: 5,
    useSmartPyramiding: true,
    maxOpenPositions: 10,
    lotMultiplier: 1.0,
    minStepPoints: 80,
    useDynamicAtrStep: true,
    atrStepMult: 0.7,
    layerCooldownSec: 15,
  },
  basket: {
    singleTpUsd: 1.0,
    singleTpPoints: 150,
    singleSlPoints: 400,
    useBasketClose: true,
    basketTargetUsd: 1.5,
    useAutoBreakEven: true,
    beTriggerPoints: 120,
    beLockPoints: 20,
    useInstantSmartBE: true,
    instantBeTriggerPoints: 80,
    instantBeLockPoints: 20,
    instantBeMinUsd: 0.30,
    useTrailingStop: true,
    trailStartPoints: 150,
    trailStepPoints: 30,
  },
  risk: {
    maxSpreadPoints: 35,
    dailyMaxLossUsd: 50.0,
    dailyTargetProfitUsd: 100.0,
    tradeAsianSession: true,
    tradeLondonSession: true,
    tradeNySession: true,
  },
};

export interface BotConfig {
  symbol: SymbolCode;
  timeframe: Timeframe;
  strategyMode: StrategyMode;
  magicNumber: number;
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
  advancedParams: AdvancedEaParams;
}

export const DEFAULT_CONFIG: BotConfig = {
  symbol: 'XAUUSD',
  timeframe: 'M15',
  strategyMode: 'MODE_AGGRESSIVE_SCALPER',
  magicNumber: 888999,
  sessions: { asian: true, london: true, newYork: true },
  slPoints: 400,
  tpPoints: 150,
  autoBE: true,
  trailingStop: true,
  trailingPoints: 150,
  lotMode: 'fixed',
  riskPercent: 1.0,
  fixedLot: 0.01,
  dailyLossLimit: 50.0,
  maxConcurrent: 5,
  maxSpread: 35,
  advancedParams: DEFAULT_ADVANCED_PARAMS,
};

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
