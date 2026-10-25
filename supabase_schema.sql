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

-- ==============================================================================
-- Supabase Realtime Replication: Enable live updates across all connected devices
-- ==============================================================================
DO $$
BEGIN
    -- Check if tables are already in publication before adding to avoid duplicate errors
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
END $$;
