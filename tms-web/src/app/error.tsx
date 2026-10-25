'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to client console for easy debugging
    console.error('TMS Client Exception Caught by ErrorBoundary:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#07080B] px-4 text-center text-zinc-100">
      <div className="relative max-w-md w-full rounded-2xl border border-zinc-800 bg-zinc-950/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400">
          <AlertCircle className="size-6" />
        </div>

        <h2 className="text-lg font-bold text-zinc-100">
          ระบบตรวจพบข้อผิดพลาดในการโหลด
        </h2>
        <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
          Application encountered a client exception. ข้อมูลล่าสุดได้รับการบันทึกปลอดภัยใน Supabase แล้ว
        </p>

        {error.message && (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-left font-mono text-[11px] text-zinc-400 overflow-x-auto max-h-32">
            {error.message}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 px-4 py-2.5 text-xs font-semibold text-emerald-300 border border-emerald-500/30 transition-all hover:bg-emerald-500/30 active:scale-95"
          >
            <RefreshCw className="size-3.5" />
            <span>ลองใหม่อีกครั้ง (Retry)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              window.location.href = '/';
            }}
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-850 hover:text-white"
          >
            <Home className="size-3.5" />
            <span>หน้าหลัก</span>
          </button>
        </div>
      </div>
    </div>
  );
}
