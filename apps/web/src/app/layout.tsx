import type { Metadata } from 'next';
import Script from 'next/script';
import '@/styles/globals.css';
import '@/styles/globals.scss';
import { cn } from '@/lib/utils';
import { plusJakarta } from '@/lib/fonts';
import { adminThemeBootstrapScript } from '@/lib/admin-theme-script';
import { introBootstrapScript } from '@/lib/intro-script';
import { Providers } from './providers';

export const metadata: Metadata = {
  metadataBase: new URL('https://agendamento.mefelipe.com.br'),
  title: 'Leemia',
  description:
    'Agenda online do estúdio Leemia. Marque serviços, escolha o profissional e confirme o horário.',
  openGraph: {
    title: 'Leemia',
    description:
      'Agenda online do estúdio Leemia. Marque serviços, escolha o profissional e confirme o horário.',
    images: ['/marketing/leemia-light-waves.png'],
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
        <Script id="leemia-intro" strategy="beforeInteractive">
          {introBootstrapScript}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
