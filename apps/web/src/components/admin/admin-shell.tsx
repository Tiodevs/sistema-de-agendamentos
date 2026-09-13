'use client';

import type { ReactNode } from 'react';
import { Package, LayoutDashboard, CalendarDays, Users, Clock } from 'lucide-react';
import { AppShell } from '@/components/shell/app-shell';

const sidebarItems = [
  { title: 'Dashboard', href: '/admin', icon: LayoutDashboard, exact: true },
  { title: 'Agendamentos', href: '/admin/appointments', icon: CalendarDays },
  { title: 'Horários', href: '/admin/schedule', icon: Clock },
  { title: 'Produtos', href: '/admin/products', icon: Package },
  { title: 'Funcionários', href: '/admin/employees', icon: Users },
];

function getBreadcrumb(pathname: string) {
  if (pathname.startsWith('/admin/appointments/new')) {
    return { parent: 'Agendamentos', current: 'Novo' };
  }
  if (pathname.startsWith('/admin/appointments')) {
    return { parent: 'Painel', current: 'Agendamentos' };
  }
  if (pathname.startsWith('/admin/schedule')) {
    return { parent: 'Painel', current: 'Horários' };
  }
  if (pathname.startsWith('/admin/products')) {
    return { parent: 'Painel', current: 'Produtos' };
  }
  if (pathname.startsWith('/admin/employees')) {
    return { parent: 'Painel', current: 'Funcionários' };
  }
  if (pathname.startsWith('/admin/profile')) {
    return { parent: 'Painel', current: 'Perfil' };
  }
  return { parent: 'Painel', current: 'Visão geral' };
}

function isAdmin(user: { role: string }) {
  return user.role === 'ADMIN';
}

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      navItems={sidebarItems}
      homeHref="/admin"
      roleLabel="Admin"
      getBreadcrumb={getBreadcrumb}
      isAuthorized={isAdmin}
      unauthorizedHref="/"
      notificationsHref="/admin/appointments"
      profileHref="/admin/profile"
      cta={{ href: '/admin/appointments/new', label: 'Novo' }}
    >
      {children}
    </AppShell>
  );
}
