'use client';

import type { ReactNode } from 'react';
import { CalendarDays, LayoutDashboard } from 'lucide-react';
import { AppShell, type AppShellUser } from '@/components/shell/app-shell';

const navItems = [
  { title: 'Dashboard', href: '/professional', icon: LayoutDashboard, exact: true },
  { title: 'Minha Agenda', href: '/professional/agenda', icon: CalendarDays },
];

function getBreadcrumb(pathname: string) {
  if (pathname.startsWith('/professional/agenda')) {
    return { parent: 'Painel', current: 'Agenda' };
  }
  if (pathname.startsWith('/professional/profile')) {
    return { parent: 'Painel', current: 'Perfil' };
  }
  return { parent: 'Painel', current: 'Visão geral' };
}

function isProfessional(user: AppShellUser) {
  return user.role === 'EMPLOYEE' || Boolean(user.employeeId);
}

function getUnauthorizedHref(user: AppShellUser) {
  return user.role === 'ADMIN' ? '/admin' : '/';
}

export function ProfessionalShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      navItems={navItems}
      homeHref="/professional"
      roleLabel="Profissional"
      getBreadcrumb={getBreadcrumb}
      isAuthorized={isProfessional}
      unauthorizedHref={getUnauthorizedHref}
      notificationsHref="/professional/agenda"
      profileHref="/professional/profile"
    >
      {children}
    </AppShell>
  );
}
