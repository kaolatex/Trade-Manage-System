'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useLanguage } from '@/context/language-context';
import { TmsLogo } from '@/components/ui/logo';
import { ChangePinModal } from './change-pin-modal';
import {
  Lock,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  LogOut,
  Delete,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SESSION_PIN_KEY = 'tms_session_pin_unlocked_v2';
const USER_PIN_STORAGE_KEY = 'tms_user_custom_pin_v2';
const DEFAULT_PIN = '120851';
const AUTO_LOCK_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

interface SecurityContextValue {
  user: User | null;
  session: Session | null;
  isAuthLoading: boolean;
  isPinUnlocked: boolean;
  lock: () => void;
  signOut: () => Promise<void>;
  changePin: (newPin: string) => void;
  verifyCurrentPin: (pin: string) => boolean;
  openChangePinModal: () => void;
}

const SecurityContext = createContext<SecurityContextValue>({
  user: null,
  session: null,
  isAuthLoading: true,
  isPinUnlocked: false,
  lock: () => {},
  signOut: async () => {},
  changePin: () => {},
  verifyCurrentPin: () => false,
  openChangePinModal: () => {},
});

export const useSecurity = () => useContext(SecurityContext);
export const usePinGate = () => {
  const sec = useSecurity();
  return {
    isUnlocked: sec.isPinUnlocked && Boolean(sec.user),
    lock: sec.lock,
  };
};

export function AuthGate({ children }: { children: ReactNode }) {
  const { language, setLanguage, t } = useLanguage();

  // Supabase Auth State
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Login Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // PIN Lock State
  const [isPinUnlocked, setIsPinUnlocked] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isChangePinModalOpen, setIsChangePinModalOpen] = useState(false);

  // 15-Minute Inactivity Timer Ref
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // --------------------------------------------------------------------------
  // 1. Supabase Auth Initialization
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setIsAuthLoading(false);
      return;
    }

    let isMounted = true;

    // Check active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setIsAuthLoading(false);
      }
    });

    // Listen to Supabase auth events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (isMounted) {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setIsAuthLoading(false);
        if (!newSession) {
          // Clear session PIN unlock on sign out
          sessionStorage.removeItem(SESSION_PIN_KEY);
          setIsPinUnlocked(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // --------------------------------------------------------------------------
  // 2. PIN Lock Session Initialization
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(SESSION_PIN_KEY);
      setIsPinUnlocked(stored === 'true');
    }
  }, []);

  // --------------------------------------------------------------------------
  // 3. PIN Verification & Management
  // --------------------------------------------------------------------------
  const getStoredPin = useCallback((): string => {
    if (typeof window === 'undefined') return DEFAULT_PIN;
    return localStorage.getItem(USER_PIN_STORAGE_KEY) || DEFAULT_PIN;
  }, []);

  const verifyCurrentPin = useCallback(
    (inputPin: string): boolean => {
      return inputPin === getStoredPin();
    },
    [getStoredPin],
  );

  const changePin = useCallback((newPin: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(USER_PIN_STORAGE_KEY, newPin);
    }
  }, []);

  const lock = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(SESSION_PIN_KEY);
    }
    setPin('');
    setIsPinUnlocked(false);
  }, []);

  const signOut = useCallback(async () => {
    lock();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
  }, [lock]);

  // --------------------------------------------------------------------------
  // 4. Inactivity Auto-Lock (15 minutes)
  // --------------------------------------------------------------------------
  const resetInactivityTimer = useCallback(() => {
    const now = Date.now();
    // Throttle activity checks to once every 5 seconds
    if (now - lastActivityRef.current < 5000) return;
    lastActivityRef.current = now;

    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    if (user && isPinUnlocked) {
      inactivityTimerRef.current = setTimeout(() => {
        lock();
      }, AUTO_LOCK_TIMEOUT_MS);
    }
  }, [user, isPinUnlocked, lock]);

  useEffect(() => {
    if (!user || !isPinUnlocked) return;

    // Start initial timer
    inactivityTimerRef.current = setTimeout(() => {
      lock();
    }, AUTO_LOCK_TIMEOUT_MS);

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleUserActivity = () => resetInactivityTimer();

    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
    };
  }, [user, isPinUnlocked, resetInactivityTimer, lock]);

  // --------------------------------------------------------------------------
  // 5. PIN Keypad & Keyboard Input Handler
  // --------------------------------------------------------------------------
  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length >= 6) return;
      const nextPin = pin + digit;
      setPin(nextPin);
      setPinError(false);

      if (nextPin.length === 6) {
        const targetPin = getStoredPin();
        if (nextPin === targetPin) {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(SESSION_PIN_KEY, 'true');
          }
          setTimeout(() => {
            setIsPinUnlocked(true);
            setPin('');
          }, 150);
        } else {
          setPinError(true);
          setTimeout(() => {
            setPin('');
            setPinError(false);
          }, 700);
        }
      }
    },
    [pin, getStoredPin],
  );

  const handleDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setPinError(false);
  }, []);

  const handleClear = useCallback(() => {
    setPin('');
    setPinError(false);
  }, []);

  // Keyboard navigation on PIN screen
  useEffect(() => {
    if (!user || isPinUnlocked) return;

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
  }, [user, isPinUnlocked, handleDigit, handleDelete, handleClear]);

  // --------------------------------------------------------------------------
  // 6. Supabase Login Submit Handler
  // --------------------------------------------------------------------------
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!supabase || !isSupabaseConfigured()) {
      setAuthError(t.auth.notConfigured);
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setAuthError(t.auth.invalidCredentials);
      } else if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        // Automatically unlock PIN on fresh password login
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(SESSION_PIN_KEY, 'true');
        }
        setIsPinUnlocked(true);
      }
    } catch (err: any) {
      setAuthError(err.message || t.auth.invalidCredentials);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // Render: Loading Screen
  // --------------------------------------------------------------------------
  if (isAuthLoading || isPinUnlocked === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090A0F]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-9 animate-spin rounded-full border-2 border-zinc-800 border-t-emerald-400" />
          <span className="text-xs font-mono text-zinc-500">TMS SECURITY VERIFY...</span>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render: Layer 1 - Supabase Authentication Screen (Apple Dark Mode)
  // --------------------------------------------------------------------------
  if (!user) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#07080B] px-4 py-8 text-zinc-100 selection:bg-emerald-500/20">
        {/* Apple Minimalist Ambient Glows */}
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-emerald-500/5 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-zinc-800/10 blur-[100px]" />

        {/* Top-Right Language Toggle */}
        <div className="absolute right-4 top-4 z-20 flex items-center rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-0.5 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setLanguage('th')}
            className={cn(
              'px-2.5 py-1 text-xs font-semibold rounded-md transition-all',
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
              'px-2.5 py-1 text-xs font-semibold rounded-md transition-all',
              language === 'en'
                ? 'bg-zinc-800 text-emerald-400 shadow-sm ring-1 ring-zinc-700/60'
                : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            EN
          </button>
        </div>

        {/* Main Login Card */}
        <div className="relative z-10 w-full max-w-sm">
          <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-7 shadow-2xl shadow-black/80 backdrop-blur-xl">
            {/* Branding & Logo */}
            <div className="text-center">
              <div className="mx-auto mb-4 flex justify-center">
                <TmsLogo size="lg" />
              </div>
              <h2 className="text-base font-semibold tracking-tight text-zinc-100">
                {t.auth.title}
              </h2>
              <p className="mt-1 text-xs text-zinc-400">
                {t.auth.subtitle}
              </p>
            </div>

            {/* Security Badge */}
            <div className="mt-4 flex items-center justify-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[11px] text-emerald-400">
              <ShieldCheck className="size-3.5" />
              <span className="font-medium">{t.auth.securityBadge}</span>
            </div>

            {/* Error Message */}
            {authError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 animate-shake">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span className="leading-tight">{authError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLoginSubmit} className="mt-5 space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  {t.auth.emailLabel}
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.auth.emailPlaceholder}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 py-2.5 pl-9 pr-3 text-xs text-zinc-100 placeholder-zinc-600 transition-all focus:border-emerald-500 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  {t.auth.passwordLabel}
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t.auth.passwordPlaceholder}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 py-2.5 pl-9 pr-9 text-xs text-zinc-100 placeholder-zinc-600 transition-all focus:border-emerald-500 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-xs font-semibold text-zinc-950 shadow-md shadow-emerald-500/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>{t.auth.signingIn}</span>
                  </>
                ) : (
                  <>
                    <Lock className="size-3.5" />
                    <span>{t.auth.signInButton}</span>
                  </>
                )}
              </button>
            </form>

            {/* Private Notice - Strictly NO Register Button */}
            <div className="mt-5 border-t border-zinc-800/80 pt-3.5 text-center">
              <p className="text-[10px] leading-relaxed text-zinc-500">
                {t.auth.privateNotice}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render: Layer 2 - Session Quick PIN Lock Screen (100% No Hints)
  // --------------------------------------------------------------------------
  if (!isPinUnlocked) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#07080B] px-4 py-8 text-zinc-100 selection:bg-emerald-500/20">
        {/* Subtle Ambient Glow */}
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-64 w-80 -translate-x-1/2 rounded-full bg-zinc-800/10 blur-3xl" />

        {/* Top-Right Language Toggle */}
        <div className="absolute right-4 top-4 z-20 flex items-center rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-0.5 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setLanguage('th')}
            className={cn(
              'px-2.5 py-1 text-xs font-semibold rounded-md transition-all',
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
              'px-2.5 py-1 text-xs font-semibold rounded-md transition-all',
              language === 'en'
                ? 'bg-zinc-800 text-emerald-400 shadow-sm ring-1 ring-zinc-700/60'
                : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            EN
          </button>
        </div>

        <div className="relative z-10 w-full max-w-sm">
          {/* Header Branding */}
          <div className="text-center">
            <div className="mx-auto mb-4 flex justify-center">
              <TmsLogo size="lg" />
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              {t.pinGate.subtitle}
            </p>

            {/* Logged in User Chip */}
            <div className="mx-auto mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1 text-[11px] text-zinc-400">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              <span className="text-zinc-500">{t.pinGate.loggedInAs}</span>
              <span className="font-mono text-zinc-300">{user.email}</span>
            </div>
          </div>

          {/* PIN Dots (Clean, 6 Dots, Zero Hints) */}
          <div
            className={cn(
              'my-8 flex justify-center gap-3.5 transition-transform duration-300',
              pinError && 'animate-shake',
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
                      ? pinError
                        ? 'border-red-500 bg-red-500 shadow-sm shadow-red-500/40'
                        : 'border-emerald-400 bg-emerald-400 shadow-sm shadow-emerald-400/40 scale-110'
                      : 'border-zinc-700 bg-zinc-900/60',
                  )}
                />
              );
            })}
          </div>

          {/* Message Area */}
          <div className="h-6 text-center">
            {pinError ? (
              <p className="text-xs font-medium text-red-400 animate-fade-in">
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
                className="flex h-14 items-center justify-center rounded-xl border border-zinc-800/80 bg-zinc-900/70 text-xl font-medium text-zinc-200 transition-all hover:border-zinc-700 hover:bg-zinc-800/80 active:scale-95"
              >
                <span className="font-mono">{d}</span>
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
              className="flex h-14 items-center justify-center rounded-xl border border-zinc-800/80 bg-zinc-900/70 text-xl font-medium text-zinc-200 transition-all hover:border-zinc-700 hover:bg-zinc-800/80 active:scale-95"
            >
              <span className="font-mono">0</span>
            </button>
            <button
              type="button"
              onClick={handleDelete}
              aria-label="Delete last digit"
              className="flex h-14 items-center justify-center rounded-xl border border-zinc-800/80 bg-zinc-900/70 text-zinc-400 transition-all hover:border-zinc-700 hover:bg-zinc-800/80 hover:text-zinc-200 active:scale-95"
            >
              <Delete className="size-5" />
            </button>
          </div>

          {/* Sign Out Option (No hint!) */}
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400 transition-colors"
            >
              <LogOut className="size-3.5" />
              <span>{t.pinGate.signOut}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render: Both Layers Passed -> Full App Access
  // --------------------------------------------------------------------------
  return (
    <SecurityContext.Provider
      value={{
        user,
        session,
        isAuthLoading,
        isPinUnlocked,
        lock,
        signOut,
        changePin,
        verifyCurrentPin,
        openChangePinModal: () => setIsChangePinModalOpen(true),
      }}
    >
      {children}

      {/* Change PIN Modal */}
      <ChangePinModal
        open={isChangePinModalOpen}
        onClose={() => setIsChangePinModalOpen(false)}
        onSuccess={(newPin) => {
          changePin(newPin);
        }}
        verifyCurrentPin={verifyCurrentPin}
      />
    </SecurityContext.Provider>
  );
}
