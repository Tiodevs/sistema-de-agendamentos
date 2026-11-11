import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/admin-shell';
import { NO_INDEX, TITLE_TEMPLATE } from '@/lib/site';

// UX-14: título de /admin; as subrotas trocam o título e herdam o noindex.
export const metadata: Metadata = {
  title: { default: 'Painel', template: TITLE_TEMPLATE },
  robots: NO_INDEX,
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminShell>{children}</AdminShell>;
}
