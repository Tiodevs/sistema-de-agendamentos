import type { Metadata } from 'next';
import { ProfessionalShell } from '@/components/professional/professional-shell';
import { NO_INDEX, TITLE_TEMPLATE } from '@/lib/site';

// UX-14: título de /professional; as subrotas trocam o título e herdam o noindex.
export const metadata: Metadata = {
  title: { default: 'Painel do profissional', template: TITLE_TEMPLATE },
  robots: NO_INDEX,
};

export default function ProfessionalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ProfessionalShell>{children}</ProfessionalShell>;
}
