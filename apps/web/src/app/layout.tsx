import type { Metadata } from 'next';
import { Suspense } from 'react';
import Script from 'next/script';
import '@/styles/globals.css';
import '@/styles/globals.scss';
import { cn } from '@/lib/utils';
import { plusJakarta } from '@/lib/fonts';
import { adminThemeBootstrapScript } from '@/lib/admin-theme-script';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Sistema de Agendamentos',
  description: 'Sistema de agendamentos online',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={cn('dark', plusJakarta.variable)} suppressHydrationWarning>
      <body className={cn('min-h-screen bg-background font-sans antialiased')}>
        <Script id="admin-theme" strategy="beforeInteractive">
          {adminThemeBootstrapScript}
        </Script>
        <Suspense>
          <Providers>{children}</Providers>
        </Suspense>
      </body>
    </html>
  );
}
