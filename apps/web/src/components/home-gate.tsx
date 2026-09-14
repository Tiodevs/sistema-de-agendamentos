'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { homePathForUser, useAuth } from '@/hooks/use-auth';
import { UserShell } from '@/components/user/user-shell';
import { UserHomePage } from '@/components/user/user-home';
import { LandingPage } from '@/components/marketing/landing-page';

export function HomeGate() {
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

  if (isAuthenticated && user) return null;

  return <LandingPage />;
}
