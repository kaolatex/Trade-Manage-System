'use client';

import { useEffect, useState } from 'react';
import { useTrading } from '@/context/trading-context';
import { useLanguage } from '@/context/language-context';
import { useSecurity } from '@/components/auth/auth-gate';
import { StatusDot } from '@/components/ui/badge';
import { TmsLogo } from '@/components/ui/logo';
import {
  Lock,
  ChevronDown,
  Check,
  Clock,
  RefreshCw,
  Cloud,
  Plus,
  Globe,
  User,
  KeyRound,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { AccountId } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AddAccountModal } from './add-account-modal';

export function TopHeader() {
  const {
    state,
    selectAccount,
    triggerSyncNow,
    addAccountModalOpen,
    setAddAccountModalOpen,
  } = useTrading();
  const { language, setLanguage, t } = useLanguage();
  const { user, lock, signOut, openChangePinModal } = useSecurity();
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSecurityMenuOpen, setIsSecurityMenuOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString(language === 'th' ? 'th-TH' : 'en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      );
      setDateStr(
        now.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [language]);

  const currentAccount = state.accounts[state.selectedAccountId] || state.accounts.all;
  const isAllOverview = state.selectedAccountId === 'all';
  const individualAccounts = (Object.keys(state.accounts) as AccountId[]).filter(
    (k) => k !== 'all',
  );

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-zinc-800/80 bg-ink/80 px-4 backdrop-blur-md sm:px-6">
        {/* Left: Branding with Clean Logo & Connection Bridge Status */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          <div className="flex items-center gap-2">
            <TmsLogo size="sm" />
          </div>

          {/* 1. Supabase DB Status Indicator */}
          {state.supabaseStatus.connected ? (
            <div
              className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-xs text-emerald-300"
              title="Supabase Cloud Database connected and operational"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
              </span>
              <span className="font-medium text-[11px] text-emerald-200">
                Supabase DB: 🟢 Connected
              </span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-950/40 px-2.5 py-1 text-xs text-rose-300"
              title={state.supabaseStatus.error || 'Cannot connect to Supabase Cloud'}
            >
              <span className="size-2 rounded-full bg-rose-500"></span>
              <span className="font-medium text-[11px] text-rose-200">
                Supabase DB: 🔴 {state.supabaseStatus.error ? `Error (${state.supabaseStatus.error.slice(0, 24)}...)` : 'Error'}
              </span>
            </div>
          )}

          {/* 2. Local MT5 Bridge (Port 8000) Status Indicator */}
          {state.bridgeStatus.connected ? (
            <div
              className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-xs text-emerald-300"
              title="Connected to local MetaTrader 5 Python Sync Bridge (Port 8000)"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
              </span>
              <span className="font-medium text-[11px] text-emerald-200">
                Local MT5 Bridge: 🟢 Online
              </span>
              <span className="text-emerald-700">&bull;</span>
              <span className="num text-[11px] text-emerald-400 font-mono">
                {state.bridgeStatus.latency}ms
              </span>
            </div>
          ) : (
            <div
              className="hidden sm:flex items-center gap-1.5 rounded-full border border-zinc-700/60 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-400"
              title="Local MT5 Bridge is not running on port 8000. Displaying cached Supabase Cloud data."
            >
              <span className="size-2 rounded-full bg-zinc-500"></span>
              <span className="font-medium text-[11px] text-zinc-300">
                Local MT5 Bridge: ⚪ Offline (Viewing Cloud Data)
              </span>
            </div>
          )}

          {/* 3. Refresh from Cloud Button */}
          <button
            type="button"
            onClick={() => triggerSyncNow()}
            disabled={state.isSyncing}
            title={
              language === 'th'
                ? 'ดึงข้อมูลล่าสุดจาก Supabase Cloud และกระตุ้น MT5 Bridge'
                : 'Refresh latest data from Supabase Cloud'
            }
            className={cn(
              'flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-surface px-2.5 py-1 text-xs text-zinc-300 transition-all hover:border-zinc-700 hover:bg-zinc-800 active:scale-95',
              state.isSyncing && 'opacity-70 pointer-events-none',
            )}
          >
            <RefreshCw
              className={cn(
                'size-3 text-zinc-400',
                state.isSyncing && 'animate-spin text-emerald-400',
              )}
            />
            <span className="hidden md:inline font-medium text-[11px]">
              {state.isSyncing
                ? language === 'th'
                  ? 'กำลังดึงข้อมูล...'
                  : 'Refreshing...'
                : '🔄 Refresh from Cloud'}
            </span>
          </button>
        </div>

        {/* Right: Quick Add + Account Selector + Clock + Language + Lock */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Add HFM Account Button */}
          <button
            type="button"
            onClick={() => setAddAccountModalOpen(true)}
            title={
              language === 'th'
                ? 'เพิ่มพอร์ต MetaTrader 5 ของโบรกเกอร์ HFM'
                : 'Add HFM MetaTrader 5 Account'
            }
            className="hidden lg:flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            <Plus className="size-3.5" />
            <span>+ Add HFM Account</span>
          </button>

          {/* Multi-Account Switcher Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-surface px-3 py-1.5 text-xs text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-800/50"
            >
              {isAllOverview ? (
                <div className="flex size-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20" />
              ) : (
                <div
                  className={cn(
                    'size-2 rounded-full',
                    currentAccount?.kind === 'demo' ? 'bg-warn' : 'bg-profit',
                  )}
                />
              )}
              <span className="max-w-[130px] truncate font-medium sm:max-w-[200px]">
                {isAllOverview
                  ? language === 'th'
                    ? '🌐 รวมทุกพอร์ต (Overview)'
                    : '🌐 All Accounts Overview'
                  : currentAccount?.name || 'Account'}
              </span>
              <ChevronDown className="size-3.5 text-zinc-400" />
            </button>

            {isDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsDropdownOpen(false)}
                />
                <div className="absolute right-0 top-full z-50 mt-1.5 w-72 animate-scale-in rounded-xl border border-zinc-800 bg-surface p-1.5 shadow-2xl shadow-black/80">
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    {language === 'th' ? 'เลือกพอร์ตโฟลิโอ' : 'Select Portfolio'}
                  </div>

                  {/* Option 1: All Accounts Overview */}
                  <button
                    type="button"
                    onClick={() => {
                      selectAccount('all');
                      setIsDropdownOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors mb-1',
                      isAllOverview
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 font-medium'
                        : 'text-zinc-300 hover:bg-zinc-800/60',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Globe className="size-3.5 text-emerald-400 shrink-0" />
                        <p className="truncate text-xs font-semibold text-zinc-100">
                          {language === 'th'
                            ? '🌐 รวมทุกพอร์ต (All Overview)'
                            : '🌐 All Accounts Overview'}
                        </p>
                      </div>
                      <p className="num text-[10px] text-emerald-400 ml-5 font-mono">
                        ${(state.accounts.all?.balance || 0).toLocaleString('en-US')} &bull;{' '}
                        {individualAccounts.length}{' '}
                        {language === 'th' ? 'พอร์ตเชื่อมต่อ' : 'accounts'}
                      </p>
                    </div>
                    {isAllOverview && <Check className="size-4 text-emerald-400 shrink-0" />}
                  </button>

                  <div className="my-1 h-px bg-zinc-800/80" />

                  {/* Individual Accounts */}
                  <div className="max-h-56 overflow-y-auto pr-0.5 space-y-0.5">
                    {individualAccounts.map((accId) => {
                      const acc = state.accounts[accId];
                      if (!acc) return null;
                      const isSelected = accId === state.selectedAccountId;
                      return (
                        <button
                          key={accId}
                          type="button"
                          onClick={() => {
                            selectAccount(accId);
                            setIsDropdownOpen(false);
                          }}
                          className={cn(
                            'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors',
                            isSelected
                              ? 'bg-zinc-800/80 text-zinc-100 font-medium'
                              : 'text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200',
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  'size-1.5 rounded-full shrink-0',
                                  acc.kind === 'demo' ? 'bg-warn' : 'bg-profit',
                                )}
                              />
                              <p className="truncate text-xs text-zinc-200 font-medium">
                                {acc.name}
                              </p>
                            </div>
                            <p className="num text-[10px] text-zinc-500 ml-3 font-mono">
                              #{acc.login} &bull; ${acc.balance.toLocaleString('en-US')}{' '}
                              <span className="text-zinc-600">({acc.server})</span>
                            </p>
                          </div>
                          {isSelected && <Check className="size-3.5 text-profit shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="my-1.5 h-px bg-zinc-800/80" />

                  {/* Bottom Action: Add HFM Account */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setAddAccountModalOpen(true);
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/60 py-2 text-xs font-medium text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-colors"
                  >
                    <Plus className="size-3.5" />
                    <span>
                      {language === 'th' ? '+ เพิ่มพอร์ต HFM Account' : '+ Add HFM Account'}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Real-time Clock */}
          <div className="hidden items-center gap-1.5 rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-2.5 py-1 text-xs text-zinc-400 xl:flex">
            <Clock className="size-3.5 text-zinc-500" />
            <span className="num text-zinc-200 font-medium">{timeStr}</span>
            <span className="text-[10px] text-zinc-500">({dateStr})</span>
          </div>

          {/* Language Switcher Button (TH / EN) */}
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900/70 p-0.5">
            <button
              type="button"
              onClick={() => setLanguage('th')}
              title="เปลี่ยนเป็นภาษาไทย"
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-all duration-200',
                language === 'th'
                  ? 'bg-zinc-800 text-emerald-400 shadow-sm ring-1 ring-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              <span>TH</span>
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              title="Switch to English"
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-all duration-200',
                language === 'en'
                  ? 'bg-zinc-800 text-emerald-400 shadow-sm ring-1 ring-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              <span>EN</span>
            </button>
          </div>

          {/* Quick Lock Button */}
          <button
            type="button"
            onClick={lock}
            title={t.common.lockTooltip}
            className="flex size-8 items-center justify-center rounded-lg border border-zinc-800 bg-surface text-zinc-400 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <Lock className="size-3.5" />
          </button>

          {/* User Profile & Security Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSecurityMenuOpen(!isSecurityMenuOpen)}
              title={t.security.menuTitle}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-surface px-2 py-1 text-xs text-zinc-300 transition-all hover:border-zinc-700 hover:bg-zinc-800 active:scale-95"
            >
              <div className="flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 font-mono text-[10px] font-bold">
                {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
              <ChevronDown className="size-3 text-zinc-500" />
            </button>

            {isSecurityMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsSecurityMenuOpen(false)}
                />
                <div className="absolute right-0 top-full z-40 mt-1.5 w-60 animate-scale-in rounded-xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-2xl shadow-black/80 backdrop-blur-xl">
                  {/* User Info Header */}
                  <div className="border-b border-zinc-800/80 px-2 py-2">
                    <p className="truncate text-xs font-semibold text-zinc-100">
                      {user?.email}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-400">
                      <ShieldCheck className="size-3" />
                      <span>Supabase Authenticated</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-1 pt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSecurityMenuOpen(false);
                        lock();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100 transition-colors"
                    >
                      <Lock className="size-3.5 text-zinc-500" />
                      <span>{t.security.lockNow}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsSecurityMenuOpen(false);
                        openChangePinModal();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100 transition-colors"
                    >
                      <KeyRound className="size-3.5 text-zinc-500" />
                      <span>{t.security.changePin}</span>
                    </button>

                    <div className="my-1 h-px bg-zinc-800/80" />

                    <button
                      type="button"
                      onClick={() => {
                        setIsSecurityMenuOpen(false);
                        signOut();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="size-3.5" />
                      <span>{t.security.signOut}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Add Account Modal */}
      <AddAccountModal
        open={addAccountModalOpen}
        onClose={() => setAddAccountModalOpen(false)}
      />
    </>
  );
}
