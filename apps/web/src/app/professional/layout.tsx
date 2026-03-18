'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  LogOut,
  Menu,
  ChevronLeft,
  CalendarDays,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/logo';

const sidebarItems = [
  {
    title: 'Dashboard',
    href: '/professional',
    icon: LayoutDashboard,
  },
  {
    title: 'Minha Agenda',
    href: '/professional/agenda',
    icon: CalendarDays,
  },
];

function SidebarContent({
  collapsed,
  pathname,
  onLogout,
  userName,
}: Readonly<{
  collapsed: boolean;
  pathname: string;
  onLogout: () => void;
  userName: string;
}>) {
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
        <Logo size={collapsed ? 28 : 32} />
        {!collapsed && (
          <span className="text-lg font-bold text-sidebar-foreground">
            Sentier
          </span>
        )}
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1">
          {sidebarItems.map((item) => {
            const isActive = item.href === '/professional'
              ? pathname === '/professional'
              : pathname === item.href || pathname.startsWith(item.href + '/');
            const linkContent = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                  collapsed && 'justify-center px-2',
                )}
              >
                <item.icon className="size-5 shrink-0" />
                {!collapsed && <span>{item.title}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right">{item.title}</TooltipContent>
                </Tooltip>
              );
            }

            return linkContent;
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        <div
          className={cn(
            'flex items-center gap-3',
            collapsed && 'flex-col',
          )}
        >
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {userName}
              </p>
              <p className="text-xs text-sidebar-foreground/60">Profissional</p>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onLogout}
                className="size-8 shrink-0 text-sidebar-foreground/70 hover:text-sidebar-foreground"
              >
                <LogOut className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={collapsed ? 'right' : 'top'}>
              Sair
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

export default function ProfessionalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    // Se não tem employeeId, não é profissional
    if (!isLoading && user && !user.employeeId) {
      if (user.role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/');
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !user || !user.employeeId) {
    return null;
  }

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen border-r border-sidebar-border bg-sidebar transition-all duration-300 lg:block',
          collapsed ? 'w-[68px]' : 'w-64',
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          pathname={pathname}
          onLogout={handleLogout}
          userName={user.name}
        />
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Top Bar */}
        <header className="flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-sidebar p-0">
              <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
              <SidebarContent
                collapsed={false}
                pathname={pathname}
                onLogout={handleLogout}
                userName={user.name}
              />
            </SheetContent>
          </Sheet>

          {/* Desktop collapse toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(!collapsed)}
                className="hidden lg:flex"
              >
                <ChevronLeft
                  className={cn(
                    'size-5 transition-transform duration-300',
                    collapsed && 'rotate-180',
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {collapsed ? 'Expandir menu' : 'Recolher menu'}
            </TooltipContent>
          </Tooltip>

          <div className="flex-1" />

          <h2 className="text-sm font-medium text-muted-foreground">
            Painel Profissional
          </h2>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
