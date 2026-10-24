'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTrading } from '@/context/trading-context';
import { useLanguage } from '@/context/language-context';
import { LayoutDashboard, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const pathname = usePathname();
  const { state } = useTrading();
  const { t } = useLanguage();

  const navs = [
    {
      name: t.nav.portfolio,
      href: '/',
      icon: LayoutDashboard,
      active: pathname === '/',
    },
    {
      name: t.nav.botSystem,
      href: '/bot-system',
      icon: Cpu,
      active: pathname === '/bot-system',
      dot: state.botRunning ? 'bg-profit' : 'bg-warn',
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-zinc-800/80 bg-ink/90 px-4 backdrop-blur-lg md:hidden">
      {navs.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative flex flex-1 flex-col items-center justify-center gap-1 py-1 text-xs font-medium transition-colors',
              item.active ? 'text-zinc-100 font-semibold' : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            <div className="relative">
              <Icon
                className={cn(
                  'size-5 transition-transform',
                  item.active && 'scale-110 text-emerald-400',
                )}
              />
              {item.dot && (
                <span
                  className={cn(
                    'absolute -right-1 -top-0.5 size-2 rounded-full border border-ink',
                    item.dot,
                  )}
                />
              )}
            </div>
            <span className="text-[11px] truncate max-w-[120px]">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
