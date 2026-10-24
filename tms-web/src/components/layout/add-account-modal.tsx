'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { useTrading } from '@/context/trading-context';
import { useLanguage } from '@/context/language-context';
import { Plus, ShieldCheck, Eye, EyeOff, Server, KeyRound, User, Landmark, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const POPULAR_SERVERS = [
  'HFMarketsSV-Live',
  'HFMarketsGlobal-Demo',
  'HFMarketsSA-Live',
  'HFMarketsEurope-Live',
];

interface AddAccountModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddAccountModal({ open, onClose }: AddAccountModalProps) {
  const { addHfmAccount, pushToast } = useTrading();
  const { language } = useLanguage();

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState('HFMarketsGlobal-Demo');
  const [customServer, setCustomServer] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const idNum = parseInt(loginId.trim(), 10);
    if (!idNum || isNaN(idNum)) {
      pushToast({
        tone: 'loss',
        title: language === 'th' ? 'กรุณาระบุ MT5 Login ID ให้ถูกต้อง' : 'Invalid MT5 Login ID',
      });
      return;
    }
    if (!password.trim()) {
      pushToast({
        tone: 'loss',
        title: language === 'th' ? 'กรุณากรอกรหัสผ่าน MT5' : 'Password is required',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await addHfmAccount({
        login_id: idNum,
        password: password.trim(),
        server: server.trim(),
        account_name: accountName.trim() || undefined,
      });

      if (res.ok) {
        pushToast({
          tone: 'profit',
          title: language === 'th' ? 'เชื่อมต่อพอร์ต HFM สำเร็จ' : 'HFM Account Connected',
          description: res.message,
        });
        setLoginId('');
        setPassword('');
        setAccountName('');
        onClose();
      } else {
        pushToast({
          tone: 'loss',
          title: language === 'th' ? 'เชื่อมต่อพอร์ตไม่สำเร็จ' : 'Connection Failed',
          description: res.message,
        });
      }
    } catch (err: any) {
      pushToast({
        tone: 'loss',
        title: 'Error',
        description: err.message || 'Failed to connect account',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} className="max-w-lg border-zinc-700/80 bg-[#0f0f13]">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <Landmark className="size-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-100 sm:text-base">
              {language === 'th' ? 'เชื่อมต่อพอร์ต HFM MetaTrader 5' : 'Connect HFM MT5 Account'}
            </h2>
            <p className="text-xs text-zinc-400">
              {language === 'th'
                ? 'ดึงข้อมูลพอร์ตจริงขึ้น Supabase Cloud อัตโนมัติ'
                : 'Sync live MT5 balance, equity, and journal to Supabase Cloud'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {/* Account Name */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-300">
            {language === 'th' ? 'ชื่อพอร์ต (Account Name)' : 'Account Label'}
          </label>
          <div className="relative">
            <User className="absolute left-3 top-2.5 size-4 text-zinc-500" />
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. HFM Master Pro Real"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/70 py-2 pl-9 pr-3 text-xs text-zinc-100 outline-none transition-colors focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Login ID */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-300">
            {language === 'th' ? 'MT5 Login ID (หมายเลขบัญชี)' : 'MT5 Login Account ID'} *
          </label>
          <div className="relative">
            <span className="num absolute left-3 top-2 text-xs font-bold text-zinc-500">#</span>
            <input
              type="number"
              required
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="5012839"
              className="num w-full rounded-xl border border-zinc-800 bg-zinc-950/70 py-2 pl-8 pr-3 text-xs font-semibold text-zinc-100 outline-none transition-colors focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-300">
            {language === 'th' ? 'MT5 Password (รหัสผ่านเทรด หรือ Investor)' : 'MT5 Trading or Investor Password'} *
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-2.5 size-4 text-zinc-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/70 py-2 pl-9 pr-10 text-xs text-zinc-100 outline-none transition-colors focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {/* Server Name */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-300">
              {language === 'th' ? 'เซิร์ฟเวอร์โบรกเกอร์ (HFM Server)' : 'HFM Broker Server'} *
            </label>
            <button
              type="button"
              onClick={() => setCustomServer(!customServer)}
              className="text-[11px] text-emerald-400 hover:underline"
            >
              {customServer
                ? (language === 'th' ? 'เลือกจากรายการ' : 'Select standard')
                : (language === 'th' ? 'พิมพ์เซิร์ฟเวอร์เอง' : 'Custom server')}
            </button>
          </div>

          {customServer ? (
            <div className="relative">
              <Server className="absolute left-3 top-2.5 size-4 text-zinc-500" />
              <input
                type="text"
                required
                value={server}
                onChange={(e) => setServer(e.target.value)}
                placeholder="e.g. HFMarketsSV-Live"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/70 py-2 pl-9 pr-3 text-xs text-zinc-100 outline-none transition-colors focus:border-emerald-500"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {POPULAR_SERVERS.map((srv) => (
                <button
                  key={srv}
                  type="button"
                  onClick={() => setServer(srv)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-medium transition-all',
                    server === srv
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300 shadow-sm'
                      : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200',
                  )}
                >
                  {srv}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Security Assurance Notice */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-zinc-400">
          <div className="flex items-start gap-2">
            <ShieldCheck className="size-4 shrink-0 text-emerald-400 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong className="text-zinc-200">
                {language === 'th' ? 'ความปลอดภัย 100%' : 'Local Security Protocol'}:
              </strong>{' '}
              {language === 'th'
                ? 'รหัสผ่านจะถูกบันทึกไว้ในคอมพิวเตอร์ของคุณเท่านั้น (local_credentials.json) จะไม่มีการส่งรหัสผ่านขึ้น Cloud เด็ดขาด'
                : 'Credentials are saved strictly in your local computer (local_credentials.json) and never exposed to the cloud.'}
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
          >
            {language === 'th' ? 'ยกเลิก' : 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2 text-xs font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>{language === 'th' ? 'กำลังเชื่อมต่อ MT5...' : 'Connecting MT5...'}</span>
              </>
            ) : (
              <>
                <Plus className="size-4" />
                <span>{language === 'th' ? 'เชื่อมต่อพอร์ตทันที' : 'Connect Account'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
