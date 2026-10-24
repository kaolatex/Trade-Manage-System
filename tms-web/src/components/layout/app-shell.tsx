'use client';

import { ReactNode } from 'react';
import { TopHeader } from './top-header';
import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';
import { ToastViewport } from './toast-viewport';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-ink text-zinc-100">
      <TopHeader />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-x-hidden p-4 pb-24 md:p-6 md:pb-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
      <BottomNav />
      <ToastViewport />
    </div>
  );
}
