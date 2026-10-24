import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** $10,450.00 · with `sign` → +$235.50 / -$70.00 */
export function fmtMoney(n: number, opts: { sign?: boolean } = {}) {
  const abs = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const prefix = n < 0 ? '-' : opts.sign && n > 0 ? '+' : '';
  return `${prefix}$${abs}`;
}

export function fmtPct(n: number, sign = false, digits = 2) {
  const prefix = sign && n > 0 ? '+' : '';
  return `${prefix}${n.toFixed(digits)}%`;
}

export function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour12: false });
}

export function fmtHM(ts: number) {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
