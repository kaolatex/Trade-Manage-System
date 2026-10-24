'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { useLanguage } from '@/context/language-context';
import { KeyRound, Check, X, ShieldCheck, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChangePinModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (newPin: string) => void;
  verifyCurrentPin: (pin: string) => boolean;
}

export function ChangePinModal({
  open,
  onClose,
  onSuccess,
  verifyCurrentPin,
}: ChangePinModalProps) {
  const { t } = useLanguage();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const resetForm = () => {
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setError(null);
    setIsSuccess(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const sanitizeInput = (val: string) => val.replace(/\D/g, '').slice(0, 6);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (currentPin.length !== 6 || newPin.length !== 6 || confirmPin.length !== 6) {
      setError(t.security.pinLengthError);
      return;
    }

    if (!verifyCurrentPin(currentPin)) {
      setError(t.security.currentPinWrong);
      return;
    }

    if (newPin !== confirmPin) {
      setError(t.security.pinMismatch);
      return;
    }

    setIsSuccess(true);
    onSuccess(newPin);
    setTimeout(() => {
      handleClose();
    }, 1200);
  };

  return (
    <Modal open={open} onClose={handleClose} className="max-w-sm">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/80 text-emerald-400">
              <KeyRound className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                {t.security.changePinTitle}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {t.security.changePinSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X className="size-4" />
          </button>
        </div>

        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-6 text-center animate-fade-in">
            <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30">
              <ShieldCheck className="size-6" />
            </div>
            <p className="mt-3 text-xs font-semibold text-emerald-400">
              {t.security.pinChangedSuccess}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400 animate-shake">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Current PIN */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                {t.security.currentPin}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={currentPin}
                onChange={(e) => setCurrentPin(sanitizeInput(e.target.value))}
                placeholder="••••••"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-center font-mono text-sm tracking-widest text-zinc-200 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                required
              />
            </div>

            {/* New PIN */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                {t.security.newPin}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(sanitizeInput(e.target.value))}
                placeholder="••••••"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-center font-mono text-sm tracking-widest text-zinc-200 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                required
              />
            </div>

            {/* Confirm PIN */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                {t.security.confirmPin}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(sanitizeInput(e.target.value))}
                placeholder="••••••"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-center font-mono text-sm tracking-widest text-zinc-200 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                required
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/60 py-2 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              >
                {t.security.cancel}
              </button>
              <button
                type="submit"
                className="flex-1 rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition-all active:scale-95 shadow-sm shadow-emerald-500/20"
              >
                {t.security.savePin}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
