'use client';

import { Modal } from '@/components/ui/modal';
import { AlertOctagon, AlertTriangle } from 'lucide-react';
import { useTrading } from '@/context/trading-context';
import { useLanguage } from '@/context/language-context';
import { botAccountId } from '@/lib/engine';

interface PanicModalProps {
  open: boolean;
  onClose: () => void;
}

export function PanicModal({ open, onClose }: PanicModalProps) {
  const { state, panicClose } = useTrading();
  const { t } = useLanguage();
  const accId = botAccountId(state.botMode);
  const account = state.accounts[accId];
  const positionCount = account.positions.length;

  const handleConfirm = () => {
    panicClose();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="panic-modal-title">
      <div className="flex items-center gap-3 text-rose-500">
        <div className="flex size-10 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20">
          <AlertOctagon className="size-5" />
        </div>
        <div>
          <h3 id="panic-modal-title" className="text-base font-bold text-zinc-100">
            {t.panicModal.title}
          </h3>
          <p className="text-xs text-rose-400">{t.panicModal.irreversible}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-rose-900/40 bg-rose-950/20 p-3.5 text-xs text-zinc-300 space-y-2">
        <div className="flex items-start gap-2 text-rose-300">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <p>
            {t.panicModal.warningBody(positionCount, account.name)}
          </p>
        </div>
        <p className="text-[11px] text-zinc-400">
          {t.panicModal.pnlImpact}
        </p>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-zinc-700 bg-surface px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          {t.panicModal.cancelBtn}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-600/30 transition-all hover:bg-rose-500 active:scale-95"
        >
          {t.panicModal.confirmBtn}
        </button>
      </div>
    </Modal>
  );
}
