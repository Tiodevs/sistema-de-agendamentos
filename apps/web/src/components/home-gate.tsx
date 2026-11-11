'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { homePathForUser, useAuth } from '@/hooks/use-auth';
import { UserShell } from '@/components/user/user-shell';
import { UserHomePage } from '@/components/user/user-home';
import { LandingPage } from '@/components/marketing/landing-page';
import { ShellSkeleton } from '@/components/shell/shell-skeleton';

/**
 * "/" é a landing para o visitante e o painel para o cliente. `hasSessionHint` vem do cookie de
 * sessão lido no servidor (ARQ-11): quem está logado recebe a casca do painel no primeiro HTML,
 * em vez de ver a landing piscar até o localStorage ser lido.
 */
export function HomeGate({ hasSessionHint = false }: { hasSessionHint?: boolean }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    if (user.role === 'USER') return;
    router.replace(homePathForUser(user));
  }, [isLoading, isAuthenticated, user, router]);

  if (isAuthenticated && user?.role === 'USER') {
    return (
      <UserShell>
        <UserHomePage />
      </UserShell>
    );
  }

  // Admin ou profissional a caminho do painel deles, ou sessão ainda carregando com o cookie.
  if ((isAuthenticated && user) || (isLoading && hasSessionHint)) return <ShellSkeleton />;

  return <LandingPage />;
}
