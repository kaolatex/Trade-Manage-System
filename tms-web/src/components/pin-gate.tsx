'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { Delete, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { TmsLogo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'tms_pin_unlocked_v1';
const VALID_PINS = ['120851', '888888'];

interface PinGateContextValue {
  isUnlocked: boolean;
  lock: () => void;
}

const PinGateContext = createContext<PinGateContextValue>({
  isUnlocked: false,
  lock: () => {},
});

export const usePinGate = () => useContext(PinGateContext);

export function PinGate({ children }: { children: ReactNode }) {
  const { language, setLanguage, t } = useLanguage();
  const [isUnlocked, setIsUnlocked] = useState<boolean | null>(null);
  const [pin, setPin] = useState<string>('');
  const [isError, setIsError] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      setIsUnlocked(stored === 'true');
    }
  }, []);

  const lock = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    setPin('');
    setIsUnlocked(false);
  }, []);

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length >= 6) return;
      const nextPin = pin + digit;
      setPin(nextPin);
      setIsError(false);

      if (nextPin.length === 6) {
        if (VALID_PINS.includes(nextPin)) {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(STORAGE_KEY, 'true');
          }
          setTimeout(() => {
            setIsUnlocked(true);
            setPin('');
          }, 150);
        } else {
          setIsError(true);
          setTimeout(() => {
            setPin('');
            setIsError(false);
          }, 800);
        }
      }
    },
    [pin],
  );

  const handleDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setIsError(false);
  }, []);

  const handleClear = useCallback(() => {
    setPin('');
    setIsError(false);
  }, []);

  // Keyboard support for desktop
  useEffect(() => {
    if (isUnlocked) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isUnlocked, handleDigit, handleDelete, handleClear]);

  // Loading state during SSR hydration
  if (isUnlocked === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <div className="size-8 animate-spin rounded-full border-2 border-zinc-700 border-t-profit" />
      </div>
    );
  }

  if (isUnlocked) {
    return (
      <PinGateContext.Provider value={{ isUnlocked, lock }}>
        {children}
      </PinGateContext.Provider>
    );
  }

  return (
    <PinGateContext.Provider value={{ isUnlocked, lock }}>
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-ink px-4 py-8 text-zinc-100 selection:bg-profit/20">
        {/* Subtle background ambient glows */}
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-64 w-80 -translate-x-1/2 rounded-full bg-zinc-800/10 blur-3xl" />

        {/* Top-right language switch button on PIN gate */}
        <div className="absolute right-4 top-4 z-20 flex items-center rounded-lg border border-zinc-800 bg-surface/80 p-0.5">
          <button
            type="button"
            onClick={() => setLanguage('th')}
            className={cn(
              'px-2 py-1 text-xs font-semibold rounded-md transition-all',
              language === 'th'
                ? 'bg-zinc-800 text-emerald-400 shadow-sm ring-1 ring-zinc-700/60'
                : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            TH
          </button>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={cn(
              'px-2 py-1 text-xs font-semibold rounded-md transition-all',
              language === 'en'
                ? 'bg-zinc-800 text-emerald-400 shadow-sm ring-1 ring-zinc-700/60'
                : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            EN
          </button>
        </div>

        <div className="relative z-10 w-full max-w-sm">
          {/* Header Branding with Logo Only (No redundant text) */}
          <div className="text-center">
            <div className="mx-auto mb-4 flex justify-center">
              <TmsLogo size="lg" />
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              {t.pinGate.subtitle}
            </p>
          </div>

          {/* PIN Dots Display */}
          <div
            className={cn(
              'my-8 flex justify-center gap-3.5 transition-transform duration-300',
              isError && 'animate-shake',
            )}
          >
            {Array.from({ length: 6 }).map((_, i) => {
              const filled = i < pin.length;
              return (
                <div
                  key={i}
                  className={cn(
                    'flex size-3.5 items-center justify-center rounded-full border transition-all duration-200',
                    filled
                      ? isError
                        ? 'border-loss bg-loss shadow-sm shadow-loss/40'
                        : 'border-profit bg-profit shadow-sm shadow-profit/40 scale-110'
                      : 'border-zinc-700 bg-zinc-900/60',
                  )}
                />
              );
            })}
          </div>

          {/* Error Message */}
          <div className="h-6 text-center">
            {isError ? (
              <p className="text-xs font-medium text-loss animate-fade-in">
                {t.pinGate.incorrectPin}
              </p>
            ) : (
              <p className="text-[11px] text-zinc-500">
                {t.pinGate.authorizedOnly}
              </p>
            )}
          </div>

          {/* Keypad */}
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleDigit(d)}
                className="flex h-14 items-center justify-center rounded-xl border border-zinc-800/80 bg-surface text-xl font-medium text-zinc-200 transition-all hover:border-zinc-700 hover:bg-zinc-800/60 active:scale-95"
              >
                <span className="num">{d}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="flex h-14 items-center justify-center rounded-xl border border-zinc-800/50 bg-zinc-950/40 text-xs font-semibold uppercase tracking-wider text-zinc-500 transition-all hover:bg-zinc-900/60 hover:text-zinc-300 active:scale-95"
            >
              {t.pinGate.clear}
            </button>
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="flex h-14 items-center justify-center rounded-xl border border-zinc-800/80 bg-surface text-xl font-medium text-zinc-200 transition-all hover:border-zinc-700 hover:bg-zinc-800/60 active:scale-95"
            >
              <span className="num">0</span>
            </button>
            <button
              type="button"
              onClick={handleDelete}
              aria-label="Delete last digit"
              className="flex h-14 items-center justify-center rounded-xl border border-zinc-800/80 bg-surface text-zinc-400 transition-all hover:border-zinc-700 hover:bg-zinc-800/60 hover:text-zinc-200 active:scale-95"
            >
              <Delete className="size-5" />
            </button>
          </div>

          {/* Quick preset PIN hint for easy testing */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setHintVisible(!hintVisible)}
              className="text-[11px] text-zinc-500 underline underline-offset-4 hover:text-zinc-400"
            >
              {hintVisible ? t.pinGate.hideHintButton : t.pinGate.hintButton}
            </button>
            {hintVisible && (
              <div className="animate-fade-in rounded-lg border border-zinc-800 bg-surface/90 px-3 py-2 text-center text-xs text-zinc-400">
                {t.pinGate.defaultPinHint}{' '}
                <span className="num font-semibold text-profit">120851</span> or{' '}
                <span className="num font-semibold text-profit">888888</span>
                <div className="mt-1.5 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      '120851'.split('').forEach(handleDigit);
                    }}
                    className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-200 hover:bg-zinc-700"
                  >
                    {t.pinGate.quickUnlock}
                    <ArrowRight className="size-2.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PinGateContext.Provider>
  );
}
