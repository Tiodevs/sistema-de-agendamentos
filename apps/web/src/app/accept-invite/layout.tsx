import type { Metadata } from 'next';
import { NO_INDEX } from '@/lib/site';

// UX-14: a página é 'use client' e não pode declarar metadata; o título da aba vem daqui.
export const metadata: Metadata = {
  title: 'Aceitar convite',
  robots: NO_INDEX,
};

export default function AcceptInviteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
