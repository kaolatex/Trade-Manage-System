import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  Account,
  AccountId,
  EquityPoint,
  ExecutionType,
  JournalEntry,
  Position,
  Side,
  SymbolCode,
} from './types';
import { round2 } from './utils';
import { computeJournalStats } from './market';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(SUPABASE_URL) &&
    Boolean(SUPABASE_ANON_KEY) &&
    !SUPABASE_URL.includes('your-project') &&
    !SUPABASE_ANON_KEY.includes('your-anon')
  );
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/* ============================================================================== */
/* Supabase Table Types (Matches supabase_schema.sql 100%)                       */
/* ============================================================================== */

export interface DbAccount {
  login_id: number;
  account_name: string;
  server: string;
  balance: number;
  equity: number;
  floating_pnl: number;
  margin_level: number | null;
  currency: string;
  is_demo: boolean;
  last_synced_at: string;
}

export interface DbPosition {
  ticket: number;
  login_id: number;
  symbol: string;
  order_type: 'BUY' | 'SELL';
  execution_type: 'MANUAL' | 'BOT';
  lot: number;
  entry_price: number;
  current_price: number;
  sl: number;
  tp: number;
  floating_profit: number;
  magic_number: number;
  open_time: string;
}

export interface DbJournalEntry {
  ticket: number;
  login_id: number;
  symbol: string;
  order_type: string;
  execution_type: 'MANUAL' | 'BOT';
  lot: number;
  entry_price: number;
  exit_price: number;
  net_pnl: number;
  magic_number: number;
  close_time: string;
  setup_tag: string | null;
  emotion_state: string | null;
  user_note: string | null;
  audit_note: string | null;
}

/* ============================================================================== */
/* Convert Database Rows to Application Domain Models                             */
/* ============================================================================== */

export function mapDbPositionToApp(p: DbPosition): Position {
  const sym = p.symbol as SymbolCode;
  return {
    ticket: Number(p.ticket),
    symbol: sym,
    type: p.order_type as Side,
    lot: Number(p.lot),
    entry: Number(p.entry_price),
    sl: Number(p.sl || 0),
    tp: Number(p.tp || 0),
    openTime: new Date(p.open_time).getTime(),
    source: p.execution_type === 'BOT' ? 'bot' : 'manual',
    execution_type: p.execution_type,
    magicNumber: Number(p.magic_number || 0),
    strategy: p.execution_type === 'BOT' ? `Bot #${p.magic_number}` : 'Manual Discretionary',
    beApplied: p.sl > 0 && Math.abs(p.sl - p.entry_price) < 0.1,
  };
}

export function mapDbJournalToApp(j: DbJournalEntry): JournalEntry {
  const sym = j.symbol as SymbolCode;
  const isProfit = Number(j.net_pnl) >= 0;
  return {
    id: `J-${j.ticket}`,
    ticket: Number(j.ticket),
    openTime: new Date(j.close_time).getTime() - 45 * 60_000,
    closeTime: new Date(j.close_time).getTime(),
    symbol: sym,
    type: (j.order_type.toUpperCase().includes('BUY') ? 'BUY' : 'SELL') as Side,
    lot: Number(j.lot),
    entry: Number(j.entry_price),
    exit: Number(j.exit_price),
    pnl: Number(j.net_pnl),
    source: j.execution_type === 'BOT' ? 'bot' : 'manual',
    execution_type: j.execution_type,
    magicNumber: Number(j.magic_number || 0),
    strategy: j.execution_type === 'BOT' ? `Auto: Magic #${j.magic_number}` : (j.setup_tag || 'Manual Discretionary'),
    setupTag: j.setup_tag || undefined,
    emotionTag: j.emotion_state || undefined,
    personalNote: j.user_note || undefined,
    auditNote: j.audit_note || undefined,
    note: j.user_note || j.audit_note || '',
    rrAchieved: isProfit ? 2.5 : -1.0,
    closeReason: isProfit ? 'TP' : 'SL',
  };
}

export function buildRealEquityHistory(
  currentBalance: number,
  journal: JournalEntry[],
  filter?: ExecutionType,
): EquityPoint[] {
  const filtered = filter ? journal.filter((j) => j.execution_type === filter) : journal;
  if (!filtered.length) {
    return currentBalance > 0 ? [{ date: Date.now(), equity: round2(currentBalance) }] : [];
  }

  // Sort chronologically ascending
  const sorted = [...filtered].sort((a, b) => a.closeTime - b.closeTime);

  // Reconstruct historical equity points based on actual trade PnL
  const totalPnl = sorted.reduce((sum, t) => sum + (t.pnl || 0), 0);
  let running = round2(currentBalance - totalPnl);

  const points: EquityPoint[] = [];
  points.push({ date: sorted[0].closeTime - 60_000, equity: round2(running) });

  for (const t of sorted) {
    running = round2(running + (t.pnl || 0));
    points.push({ date: t.closeTime, equity: round2(running) });
  }

  const now = Date.now();
  if (points.length && points[points.length - 1].date < now) {
    points.push({ date: now, equity: round2(currentBalance) });
  }

  return points;
}

export function mapDbAccountToApp(
  acc: DbAccount,
  positions: Position[],
  journal: JournalEntry[],
): Account {
  const id = `hfm-${acc.login_id}` as AccountId;
  const computed = computeJournalStats(journal);

  // Compute 100% REAL equity history based on actual closed deals
  const balanceNum = Number(acc.balance);
  const equityHistory = buildRealEquityHistory(balanceNum, journal);
  const equityHistoryManual = buildRealEquityHistory(balanceNum, journal, 'MANUAL');
  const equityHistoryBot = buildRealEquityHistory(balanceNum, journal, 'BOT');

  return {
    id,
    name: acc.account_name || `HFM #${acc.login_id}`,
    kind: acc.is_demo ? 'demo' : 'live',
    login: String(acc.login_id),
    server: acc.server,
    leverage: 500,
    balance: balanceNum,
    dailyStartBalance: balanceNum,
    dailyLossPct: 0,
    positions,
    journal,
    equityHistory,
    equityHistoryManual,
    equityHistoryBot,
    stats: computed.stats,
    sessions: computed.sessions,
  };
}

/* ============================================================================== */
/* Cloud API Functions                                                            */
/* ============================================================================== */

export async function fetchSupabaseCloudData(): Promise<{
  accounts: Record<AccountId, Account>;
  hasData: boolean;
  error: string | null;
}> {
  if (!supabase) return { accounts: {}, hasData: false, error: 'Supabase client is not configured' };

  try {
    const [accRes, posRes, jRes] = await Promise.all([
      supabase.from('tms_accounts').select('*').order('last_synced_at', { ascending: false }),
      supabase.from('tms_active_positions').select('*'),
      supabase.from('tms_trade_journal').select('*').order('close_time', { ascending: false }),
    ]);

    if (accRes.error) {
      console.error('[Supabase] Error fetching accounts:', accRes.error);
      return { accounts: {}, hasData: false, error: accRes.error.message };
    }

    if (!accRes.data || accRes.data.length === 0) {
      return { accounts: {}, hasData: false, error: null };
    }

    const dbAccounts: DbAccount[] = accRes.data;
    const dbPositions: DbPosition[] = posRes.data || [];
    const dbJournal: DbJournalEntry[] = jRes.data || [];

    const accountsRecord: Record<AccountId, Account> = {} as any;

    for (const dba of dbAccounts) {
      const loginId = Number(dba.login_id);
      const accPositions = dbPositions
        .filter((p) => Number(p.login_id) === loginId)
        .map(mapDbPositionToApp);
      const accJournal = dbJournal
        .filter((j) => Number(j.login_id) === loginId)
        .map(mapDbJournalToApp);

      const appAcc = mapDbAccountToApp(dba, accPositions, accJournal);
      accountsRecord[appAcc.id] = appAcc;
    }

    return { accounts: accountsRecord, hasData: Object.keys(accountsRecord).length > 0, error: null };
  } catch (err: any) {
    console.error('[Supabase] Failed to fetch cloud data:', err);
    return { accounts: {}, hasData: false, error: err?.message || 'Network exception connecting to Supabase' };
  }
}

export async function updateCloudJournalNote(
  ticket: number,
  patch: {
    setupTag?: string;
    emotionTag?: string;
    personalNote?: string;
    auditNote?: string;
  },
): Promise<boolean> {
  if (!supabase) return false;
  try {
    const updatePayload: Record<string, any> = {};
    if (patch.setupTag !== undefined) updatePayload.setup_tag = patch.setupTag;
    if (patch.emotionTag !== undefined) updatePayload.emotion_state = patch.emotionTag;
    if (patch.personalNote !== undefined) updatePayload.user_note = patch.personalNote;
    if (patch.auditNote !== undefined) updatePayload.audit_note = patch.auditNote;

    const { error } = await supabase
      .from('tms_trade_journal')
      .update(updatePayload)
      .eq('ticket', ticket);

    if (error) {
      console.error('[Supabase] Note update error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Exception updating note:', err);
    return false;
  }
}

export interface DbBotConfig {
  id: string;
  is_running: boolean;
  bot_mode: string;
  strategy_mode: string;
  symbol: string;
  timeframe: string;
  magic_number: number;
  advanced_params: any;
  updated_at: string;
}

export async function fetchCloudBotConfig(): Promise<DbBotConfig | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('tms_bot_configs')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (error) {
      console.warn('[Supabase] Could not fetch bot config:', error.message);
      return null;
    }
    return data as DbBotConfig;
  } catch (err) {
    console.warn('[Supabase] fetchCloudBotConfig exception:', err);
    return null;
  }
}

export async function saveCloudBotConfig(payload: Partial<DbBotConfig>): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('tms_bot_configs')
      .upsert({
        id: 'default',
        ...payload,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[Supabase] Error saving bot config:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] saveCloudBotConfig exception:', err);
    return false;
  }
}

