import type { Metadata } from 'next';
import Script from 'next/script';
import '@/styles/globals.css';
import { cn } from '@/lib/utils';
import { plusJakarta } from '@/lib/fonts';
import { adminThemeBootstrapScript } from '@/lib/admin-theme-script';
import { introBootstrapScript } from '@/lib/intro-script';
import { SITE_DESCRIPTION, SITE_IMAGE, SITE_NAME, SITE_URL, TITLE_TEMPLATE } from '@/lib/site';
import { Providers } from './providers';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // UX-14: cada rota declara só o próprio nome; o sufixo da marca vem daqui.
  title: { default: SITE_NAME, template: TITLE_TEMPLATE },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [SITE_IMAGE],
    siteName: SITE_NAME,
    locale: 'pt_BR',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ARQ-10: `dark` aqui é só o que o servidor manda (e o que vale sem JavaScript, caso da
  // landing, sempre escura). O script `admin-theme` troca a classe antes da primeira pintura:
  // tema salvo, se houver; senão o do sistema (prefers-color-scheme).
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
