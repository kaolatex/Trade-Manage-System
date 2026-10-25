'use client';

import { useTrading } from '@/context/trading-context';
import { useLanguage } from '@/context/language-context';
import { Landmark, RefreshCw, AlertCircle, Terminal, Plus, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NoAccountEmptyState() {
  const { state, setAddAccountModalOpen, triggerSyncNow } = useTrading();
  const { language } = useLanguage();

  const hasRealAccounts = Object.keys(state.accounts).filter((k) => k !== 'all').length > 0;
  const isError = Boolean(state.supabaseStatus.error);

  if (hasRealAccounts && !isError) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* 1. Supabase Error Alert (if any) */}
      {isError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-rose-200 shadow-lg backdrop-blur-md">
          <div className="flex items-start gap-3">
            <ShieldAlert className="size-5 shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-rose-300">
                {language === 'th' ? 'ข้อผิดพลาดในการเชื่อมต่อ Supabase Database' : 'Supabase Database Connection Error'}
              </p>
              <p className="font-mono text-[11px] text-rose-200/90 break-all bg-black/30 p-2 rounded border border-rose-500/20">
                {state.supabaseStatus.error}
              </p>
              <p className="text-[11px] text-rose-400">
                {language === 'th'
                  ? 'หากเกิดปัญหา Row-Level Security (42501) ให้รัน SQL ใน supabase_schema.sql หรือใช้ service_role secret ใน tms-bot/.env'
                  : 'If RLS 42501 occurs, run supabase_schema.sql in Supabase SQL Editor or set service_role secret in tms-bot/.env.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Zero-Mock Policy Empty State Banner */}
      {!hasRealAccounts && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/20 via-surface to-surface p-6 shadow-xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-inner">
                <Landmark className="size-6" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-zinc-100 sm:text-lg">
                    No HFM Account Synced Yet
                  </h2>
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                    STRICT ZERO-MOCK
                  </span>
                </div>
                <p className="max-w-2xl text-xs text-zinc-400 leading-relaxed">
                  {language === 'th'
                    ? 'ระบบทำงานในโหมด Zero-Mock Policy 100% (ไม่แสดงพอร์ตหรือออเดอร์จำลอง) ข้อมูลบนหน้าจอจะดึงมาจากตาราง Supabase Cloud (tms_accounts, tms_active_positions, tms_trade_journal) เท่านั้น'
                    : 'System operates under a Strict Zero-Mock Policy. All metrics, active positions, and journal entries are rendered directly from live Supabase Cloud tables.'}
                </p>

                {/* Quick Step Guide */}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-zinc-300">
                  <span className="flex items-center gap-1 font-mono text-zinc-400">
                    <span className="flex size-4 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-300">1</span>
                    {language === 'th' ? 'เปิดโปรแกรม MT5 (HFM)' : 'Open MT5 Terminal'}
                  </span>
                  <span className="text-zinc-600">&rarr;</span>
                  <span className="flex items-center gap-1 font-mono text-zinc-400">
                    <span className="flex size-4 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-300">2</span>
                    <Terminal className="size-3 text-emerald-400 inline" />
                    <span>run_sync.bat</span>
                  </span>
                  <span className="text-zinc-600">&rarr;</span>
                  <span className="flex items-center gap-1 font-mono text-zinc-400">
                    <span className="flex size-4 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-300">3</span>
                    {language === 'th' ? 'กด Refresh from Cloud' : 'Refresh Cloud'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setAddAccountModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-300 transition-all hover:bg-emerald-500/30 active:scale-95 shadow-md shadow-emerald-950/50"
              >
                <Plus className="size-3.5" />
                <span>{language === 'th' ? 'เพิ่มพอร์ต HFM' : 'Connect Account'}</span>
              </button>

              <button
                type="button"
                onClick={() => triggerSyncNow()}
                disabled={state.isSyncing}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-surface px-4 py-2 text-xs font-semibold text-zinc-200 transition-all hover:bg-zinc-800 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={cn('size-3.5 text-zinc-400', state.isSyncing && 'animate-spin text-emerald-400')} />
                <span>{state.isSyncing ? 'Syncing...' : '🔄 Refresh from Cloud'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
