'use client';

import type { ReactNode } from 'react';
import { CalendarDays, CalendarPlus, Home } from 'lucide-react';
import { AppShell } from '@/components/shell/app-shell';

const navItems = [
  { title: 'Início', href: '/', icon: Home, exact: true },
  { title: 'Agendar', href: '/book', icon: CalendarPlus },
  { title: 'Meus Horários', href: '/appointments', icon: CalendarDays },
];

function getBreadcrumb(pathname: string) {
  if (pathname.startsWith('/book')) {
    return { parent: 'Painel', current: 'Agendar' };
  }
  if (pathname.startsWith('/appointments')) {
    return { parent: 'Painel', current: 'Meus horários' };
  }
  return { parent: 'Painel', current: 'Início' };
}

function isClientUser(user: { role: string }) {
  return user.role !== 'ADMIN';
}

function searchHref(query: string) {
  return query ? `/appointments?q=${encodeURIComponent(query)}` : '/appointments';
}

export function UserShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      navItems={navItems}
      homeHref="/"
      roleLabel="Cliente"
      getBreadcrumb={getBreadcrumb}
      isAuthorized={isClientUser}
      unauthorizedHref="/admin"
      searchHref={searchHref}
      searchPlaceholder="Buscar horários"
      notificationsHref="/appointments"
      cta={{ href: '/book', label: 'Novo' }}
    >
      {children}
    </AppShell>
  );
}
