import type { Metadata } from 'next';
import { UserShell } from '@/components/user/user-shell';
import { NO_INDEX } from '@/lib/site';

// UX-14: área logada do cliente (agendar, meus horários, perfil) fica fora da busca.
export const metadata: Metadata = {
  robots: NO_INDEX,
};

export default function UserLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <UserShell>{children}</UserShell>;
}
