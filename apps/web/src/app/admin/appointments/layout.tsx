import type { Metadata } from 'next';
import { TITLE_TEMPLATE } from '@/lib/site';

// UX-14: a página é 'use client' e não pode declarar metadata; o título da aba vem daqui.
export const metadata: Metadata = {
  title: { default: 'Agenda', template: TITLE_TEMPLATE },
};

export default function AdminAppointmentsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
