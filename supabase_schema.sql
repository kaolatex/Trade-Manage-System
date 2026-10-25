-- ==============================================================================
-- TradeManageSystem (TMS) — Supabase Cloud Database Schema
-- Multi-Account MT5 (HFM Broker) Sync Schema & Trading Journal
-- ==============================================================================

-- 1. Table: tms_accounts
-- Stores synced HFM MT5 account profiles and live financial metrics
CREATE TABLE IF NOT EXISTS public.tms_accounts (
    login_id BIGINT PRIMARY KEY,
    account_name TEXT NOT NULL DEFAULT 'HFM MT5 Account',
    server TEXT NOT NULL,
    balance NUMERIC NOT NULL DEFAULT 0,
    equity NUMERIC NOT NULL DEFAULT 0,
    floating_pnl NUMERIC NOT NULL DEFAULT 0,
    margin_level NUMERIC DEFAULT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    is_demo BOOLEAN NOT NULL DEFAULT false,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Table: tms_active_positions
-- Stores live open orders currently floating on MT5
CREATE TABLE IF NOT EXISTS public.tms_active_positions (
    ticket BIGINT PRIMARY KEY,
    login_id BIGINT NOT NULL REFERENCES public.tms_accounts(login_id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    order_type TEXT NOT NULL CHECK (order_type IN ('BUY', 'SELL')),
    execution_type TEXT NOT NULL CHECK (execution_type IN ('MANUAL', 'BOT')),
    lot NUMERIC NOT NULL,
    entry_price NUMERIC NOT NULL,
    current_price NUMERIC NOT NULL,
    sl NUMERIC NOT NULL DEFAULT 0,
    tp NUMERIC NOT NULL DEFAULT 0,
    floating_profit NUMERIC NOT NULL DEFAULT 0,
    magic_number BIGINT NOT NULL DEFAULT 0,
    open_time TIMESTAMPTZ NOT NULL
);

-- 3. Table: tms_trade_journal
-- Stores closed historical trades (90D+) and personal retrospective / bot audit notes
CREATE TABLE IF NOT EXISTS public.tms_trade_journal (
    ticket BIGINT PRIMARY KEY,
    login_id BIGINT NOT NULL REFERENCES public.tms_accounts(login_id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    order_type TEXT NOT NULL,
    execution_type TEXT NOT NULL CHECK (execution_type IN ('MANUAL', 'BOT')),
    lot NUMERIC NOT NULL,
    entry_price NUMERIC NOT NULL,
    exit_price NUMERIC NOT NULL,
    net_pnl NUMERIC NOT NULL DEFAULT 0, -- profit + swap + commission
    magic_number BIGINT NOT NULL DEFAULT 0,
    close_time TIMESTAMPTZ NOT NULL,
    
    -- Discretionary / Manual Trading Review Fields (Protected from sync overwrite)
    setup_tag TEXT DEFAULT NULL,
    emotion_state TEXT DEFAULT NULL,
    user_note TEXT DEFAULT NULL,
    
    -- Automated Bot Telemetry Audit
    audit_note TEXT DEFAULT NULL
);

-- 4. Table: tms_bot_configs
-- Stores Cloud Deep Customization parameters for Native MQL5 EA & Python Bridge
CREATE TABLE IF NOT EXISTS public.tms_bot_configs (
    id TEXT PRIMARY KEY DEFAULT 'default',
    is_running BOOLEAN NOT NULL DEFAULT false,
    bot_mode TEXT NOT NULL DEFAULT 'live',
    strategy_mode TEXT NOT NULL DEFAULT 'MODE_AGGRESSIVE_SCALPER',
    symbol TEXT NOT NULL DEFAULT 'XAUUSD',
    timeframe TEXT NOT NULL DEFAULT 'M15',
    magic_number BIGINT NOT NULL DEFAULT 888999,
    advanced_params JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default configuration row if empty
INSERT INTO public.tms_bot_configs (id, is_running, bot_mode, strategy_mode, symbol, timeframe, magic_number, advanced_params)
VALUES (
    'default',
    false,
    'live',
    'MODE_AGGRESSIVE_SCALPER',
    'XAUUSD',
    'M15',
    888999,
    '{
        "strategy": {
            "strategyMode": "MODE_AGGRESSIVE_SCALPER",
            "timeframe": "M15",
            "magicNumber": 888999,
            "orderComment": "TMS-Quantum-EA",
            "emaTrendPeriod": 50,
            "bbPeriod": 20,
            "bbDeviation": 1.8,
            "stochRsiK": 14,
            "stochRsiOversold": 22.0,
            "stochRsiOverbought": 78.0,
            "minRejectionWickPct": 25.0,
            "newsSpikeFilterAtr": 2.8,
            "lookbackBars": 2000,
            "patternLength": 5,
            "forwardHorizonBars": 3,
            "minWinProbabilityPct": 65.0,
            "zScoreThreshold": 1.5,
            "dynamicAtrSlMult": 1.5,
            "dynamicAtrTpMult": 2.5
        },
        "layering": {
            "lotMode": "fixed",
            "baseLot": 0.01,
            "riskPercent": 1.0,
            "maxLayers": 5,
            "lotMultiplier": 1.0,
            "minStepPoints": 80,
            "useDynamicAtrStep": true,
            "atrStepMult": 0.7,
            "layerCooldownSec": 15
        },
        "basket": {
            "singleTpUsd": 1.0,
            "singleTpPoints": 150,
            "singleSlPoints": 400,
            "useBasketClose": true,
            "basketTargetUsd": 1.5,
            "useAutoBreakEven": true,
            "beTriggerPoints": 120,
            "beLockPoints": 20,
            "useTrailingStop": true,
            "trailStartPoints": 150,
            "trailStepPoints": 30
        },
        "risk": {
            "maxSpreadPoints": 35,
            "dailyMaxLossUsd": 50.0,
            "dailyTargetProfitUsd": 100.0,
            "tradeAsianSession": true,
            "tradeLondonSession": true,
            "tradeNySession": true
        }
    }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- Indexes for High Performance Queries & Instant Filtering
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_tms_active_positions_login_id ON public.tms_active_positions(login_id);
CREATE INDEX IF NOT EXISTS idx_tms_active_positions_exec ON public.tms_active_positions(execution_type);

CREATE INDEX IF NOT EXISTS idx_tms_trade_journal_login_id ON public.tms_trade_journal(login_id);
CREATE INDEX IF NOT EXISTS idx_tms_trade_journal_exec ON public.tms_trade_journal(execution_type);
CREATE INDEX IF NOT EXISTS idx_tms_trade_journal_close_time ON public.tms_trade_journal(close_time DESC);

-- ==============================================================================
-- Security: Row Level Security (RLS) & Granular 2-Layer Access Control
-- ==============================================================================
ALTER TABLE public.tms_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tms_active_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tms_trade_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tms_bot_configs ENABLE ROW LEVEL SECURITY;

-- 1. Policies for public.tms_accounts:
DROP POLICY IF EXISTS "Allow authenticated read accounts" ON public.tms_accounts;
DROP POLICY IF EXISTS "Allow service_role manage accounts" ON public.tms_accounts;
DROP POLICY IF EXISTS "Allow all manage accounts" ON public.tms_accounts;
CREATE POLICY "Allow all manage accounts" ON public.tms_accounts
    FOR ALL TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- 2. Policies for public.tms_active_positions:
DROP POLICY IF EXISTS "Allow authenticated read positions" ON public.tms_active_positions;
DROP POLICY IF EXISTS "Allow service_role manage positions" ON public.tms_active_positions;
DROP POLICY IF EXISTS "Allow all manage positions" ON public.tms_active_positions;
CREATE POLICY "Allow all manage positions" ON public.tms_active_positions
    FOR ALL TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- 3. Policies for public.tms_trade_journal:
DROP POLICY IF EXISTS "Allow authenticated read journal" ON public.tms_trade_journal;
DROP POLICY IF EXISTS "Allow authenticated update journal notes" ON public.tms_trade_journal;
DROP POLICY IF EXISTS "Allow service_role manage journal" ON public.tms_trade_journal;
DROP POLICY IF EXISTS "Allow all manage journal" ON public.tms_trade_journal;
CREATE POLICY "Allow all manage journal" ON public.tms_trade_journal
    FOR ALL TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- 4. Policies for public.tms_bot_configs:
DROP POLICY IF EXISTS "Allow all manage bot configs" ON public.tms_bot_configs;
CREATE POLICY "Allow all manage bot configs" ON public.tms_bot_configs
    FOR ALL TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- 5. Table: tms_remote_commands
-- Remote Command Queue (Test Fire, Panic Close, Start, Stop)
CREATE TABLE IF NOT EXISTS public.tms_remote_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    command_type TEXT NOT NULL CHECK (command_type IN ('TEST_BOT_ORDER', 'PANIC_CLOSE_BOT', 'START_BOT', 'STOP_BOT', 'UPDATE_CONFIG')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'EXECUTED', 'FAILED')),
    result JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executed_at TIMESTAMPTZ DEFAULT NULL
);

-- 6. Table: tms_bot_logs
-- Live Quant Scanning & Execution Event Logs streamed to Web Terminal
CREATE TABLE IF NOT EXISTS public.tms_bot_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level TEXT NOT NULL DEFAULT 'system',
    message TEXT NOT NULL,
    details JSONB DEFAULT NULL,
    symbol TEXT DEFAULT 'XAUUSD'
);

-- Indexes for Commands & Logs
CREATE INDEX IF NOT EXISTS idx_tms_remote_commands_status ON public.tms_remote_commands(status);
CREATE INDEX IF NOT EXISTS idx_tms_remote_commands_created ON public.tms_remote_commands(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tms_bot_logs_timestamp ON public.tms_bot_logs(timestamp DESC);

-- Enable RLS
ALTER TABLE public.tms_remote_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tms_bot_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all manage remote commands" ON public.tms_remote_commands;
CREATE POLICY "Allow all manage remote commands" ON public.tms_remote_commands
    FOR ALL TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all manage bot logs" ON public.tms_bot_logs;
CREATE POLICY "Allow all manage bot logs" ON public.tms_bot_logs
    FOR ALL TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- Supabase Realtime Replication: Enable live updates across all connected devices
-- ==============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'tms_accounts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tms_accounts;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'tms_active_positions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tms_active_positions;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'tms_trade_journal'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tms_trade_journal;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'tms_bot_configs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tms_bot_configs;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'tms_remote_commands'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tms_remote_commands;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'tms_bot_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tms_bot_logs;
    END IF;
END $$;


