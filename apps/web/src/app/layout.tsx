import type { Metadata } from 'next';
import '@/styles/globals.css';
import '@/styles/globals.scss';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Sistema de Agendamentos',
  description: 'Sistema de agendamentos online',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={cn('min-h-screen bg-background font-sans antialiased')}>
        {children}
      </body>
    </html>
  );
}
