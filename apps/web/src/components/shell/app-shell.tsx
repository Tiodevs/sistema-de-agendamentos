'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  LogOut,
  Menu,
  Search,
  LayoutGrid,
  CalendarPlus,
  Bell,
  Share2,
  Moon,
  Sun,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetClose, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getInitials } from '@/lib/format';
import { AdminThemeToggle } from '@/components/admin/theme-toggle';
import { useAdminTheme } from '@/components/admin/admin-theme';

export type AppShellNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
};

export type AppShellCta = {
  href: string;
  label: string;
};

function isActivePath(pathname: string, item: AppShellNavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLinks({
  pathname,
  items,
  withLabel = false,
  onNavigate,
}: {
  pathname: string;
  items: AppShellNavItem[];
  withLabel?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className={cn('flex flex-col', withLabel ? 'gap-1 px-3' : 'items-center gap-2')}>
      {items.map((item) => {
        const active = isActivePath(pathname, item);
        const link = (
          <Link
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center rounded-2xl text-sm font-medium transition-colors',
              withLabel ? 'gap-3 px-3 py-2.5' : 'size-11 justify-center',
              active ? 'bg-white/10 text-white' : 'text-white/45 hover:bg-white/5 hover:text-white',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <item.icon className="size-5 shrink-0" />
            {withLabel ? <span>{item.title}</span> : <span className="sr-only">{item.title}</span>}
          </Link>
        );

        if (withLabel) return <div key={item.href}>{link}</div>;

        return (
          <Tooltip key={item.href}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{item.title}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

function UserMenu({
  userName,
  roleLabel,
  onLogout,
}: {
  userName: string;
  roleLabel: string;
  onLogout: () => void;
}) {
  const { theme, toggleTheme, mounted } = useAdminTheme();
  const isDark = theme === 'dark';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          aria-label="Menu do usuário"
        >
          <Avatar className="size-10">
            <AvatarFallback className="bg-white/10 text-xs text-white">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top" className="w-52 rounded-2xl">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{userName}</p>
          <p className="text-xs text-muted-foreground">{roleLabel}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={toggleTheme} disabled={!mounted}>
          {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {isDark ? 'Modo claro' : 'Modo escuro'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
          <LogOut className="size-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({
  children,
  navItems,
  homeHref,
  roleLabel,
  getBreadcrumb,
  isAuthorized,
  unauthorizedHref,
  searchHref,
  searchPlaceholder = 'Buscar',
  notificationsHref,
  cta,
}: {
  children: ReactNode;
  navItems: AppShellNavItem[];
  homeHref: string;
  roleLabel: string;
  getBreadcrumb: (pathname: string) => { parent: string; current: string };
  isAuthorized: (user: { role: string }) => boolean;
  unauthorizedHref: string;
  searchHref: (query: string) => string;
  searchPlaceholder?: string;
  notificationsHref: string;
  cta: AppShellCta;
}) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const breadcrumb = useMemo(() => getBreadcrumb(pathname), [getBreadcrumb, pathname]);
  const { theme, toggleTheme } = useAdminTheme();

  useEffect(() => {
    document.body.classList.add('admin-theme');
    return () => {
      document.body.classList.remove('admin-theme');
    };
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!isLoading && user && !isAuthorized(user)) {
      router.push(unauthorizedHref);
    }
  }, [isLoading, isAuthenticated, user, router, isAuthorized, unauthorizedHref]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function handleLogout() {
    router.replace('/login');
    logout();
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(searchHref(query.trim()));
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copiado');
    } catch {
      toast.error('Não foi possível copiar o link');
    }
  }

  if (isLoading || !isAuthenticated || !user || !isAuthorized(user)) {
    return (
      <div className="admin-theme admin-frame flex min-h-screen items-center justify-center p-4">
        <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-[var(--admin-accent)]" />
      </div>
    );
  }

  return (
    <div className="admin-theme admin-frame p-3 sm:p-4 lg:p-5">
      <div className="flex items-start gap-3 lg:gap-4">
        <aside className="admin-rail hidden w-[4.5rem] shrink-0 flex-col items-center self-start rounded-[32px] py-5 lg:flex">
          <Link
            href={homeHref}
            className="mb-8 flex size-11 items-center justify-center rounded-2xl bg-white/5"
          >
            <Logo size={26} />
            <span className="sr-only">Sentier</span>
          </Link>
          <div className="min-h-0 flex-1">
            <NavLinks pathname={pathname} items={navItems} />
          </div>
          <UserMenu userName={user.name} roleLabel={roleLabel} onLogout={handleLogout} />
        </aside>

        <section className="admin-panel min-h-[calc(100dvh-1.5rem)] min-w-0 flex-1 rounded-[28px] sm:min-h-[calc(100dvh-2rem)] sm:rounded-[32px] lg:min-h-[calc(100dvh-2.5rem)]">
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-4 py-4 sm:px-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-x-4">
            <div className="flex min-w-0 items-center gap-3">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-2xl lg:hidden"
                    aria-label="Abrir menu"
                  >
                    <Menu className="size-5" />
                    <span className="sr-only">Abrir menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" showCloseButton={false} className="admin-mobile-nav">
                  <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
                  <div className="flex h-full min-h-0 flex-col py-5">
                    <div className="mb-6 flex items-center justify-between gap-3 px-5">
                      <div className="flex items-center gap-3">
                        <Logo size={28} />
                        <span className="text-lg font-semibold">Sentier</span>
                      </div>
                      <SheetClose asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-2xl text-white/70 hover:bg-white/10 hover:text-white"
                        >
                          <X className="size-5" />
                          <span className="sr-only">Fechar menu</span>
                        </Button>
                      </SheetClose>
                    </div>
                    <NavLinks
                      pathname={pathname}
                      items={navItems}
                      withLabel
                      onNavigate={() => setMobileOpen(false)}
                    />
                    <div className="mt-auto space-y-1 px-5 pt-4">
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-white/70 hover:bg-white/10 hover:text-white"
                        onClick={toggleTheme}
                      >
                        {theme === 'dark' ? (
                          <Sun className="size-4" />
                        ) : (
                          <Moon className="size-4" />
                        )}
                        {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-white/70 hover:bg-white/10 hover:text-white"
                        onClick={handleLogout}
                      >
                        <LogOut className="size-4" />
                        Sair
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              <div className="flex min-w-0 items-center gap-2 text-sm">
                <LayoutGrid className="hidden size-4 text-muted-foreground sm:block" />
                <span className="hidden text-muted-foreground sm:inline">{breadcrumb.parent}</span>
                <span className="hidden text-muted-foreground sm:inline">/</span>
                <span className="truncate font-medium">{breadcrumb.current}</span>
              </div>
            </div>

            <form
              onSubmit={handleSearch}
              className="col-span-2 min-w-0 w-full lg:col-span-1 lg:col-start-2 lg:row-start-1"
            >
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-full bg-[var(--admin-card-muted)] pl-10"
                  aria-label={searchPlaceholder}
                />
              </div>
            </form>

            <div className="col-start-2 row-start-1 flex items-center justify-end gap-1.5 lg:col-start-3 lg:row-start-1">
              <AdminThemeToggle />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-2xl"
                    onClick={() => router.push(notificationsHref)}
                    aria-label="Agendamentos"
                  >
                    <Bell className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Agendamentos</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-2xl"
                    onClick={handleShare}
                    aria-label="Copiar link"
                  >
                    <Share2 className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copiar link</TooltipContent>
              </Tooltip>
              <Button onClick={() => router.push(cta.href)} className="rounded-full px-4">
                <CalendarPlus className="size-4" />
                <span className="hidden sm:inline">{cta.label}</span>
              </Button>
            </div>
          </header>

          <main className="px-4 pb-5 sm:px-6 lg:px-7">{children}</main>
        </section>
      </div>
    </div>
  );
}
