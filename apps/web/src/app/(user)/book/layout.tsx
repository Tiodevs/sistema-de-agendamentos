import type { Metadata } from 'next';

// UX-14: a página é 'use client' e não pode declarar metadata; o título da aba vem daqui.
export const metadata: Metadata = {
  title: 'Agendar',
};

export default function BookLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
