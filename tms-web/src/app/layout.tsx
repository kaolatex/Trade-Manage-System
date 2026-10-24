import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '@/context/language-context';
import { AuthGate } from '@/components/auth/auth-gate';
import { TradingProvider } from '@/context/trading-context';
import { AppShell } from '@/components/layout/app-shell';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TradeManageSystem (TMS) — Portfolio & Bot Control Terminal',
  description:
    'Private portfolio management and automated algorithmic trading system for XAUUSD & FX.',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${inter.variable} ${jetbrainsMono.variable} dark`}>
      <body className="bg-ink font-sans text-zinc-100 antialiased">
        <LanguageProvider>
          <AuthGate>
            <TradingProvider>
              <AppShell>{children}</AppShell>
            </TradingProvider>
          </AuthGate>
        </LanguageProvider>
      </body>
    </html>
  );
}
