'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ContactRound, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StaggerIn } from '@/components/motion/stagger-in';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { accentForId } from '@/lib/admin-accents';
import { getClients, type Client, type ClientsPagination } from '@/lib/api';
import { formatDateShort } from '@/lib/format';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 24;

function appointmentWhenLabel(iso: string | null | undefined) {
  if (!iso) return 'Sem agendamentos';
  const date = new Date(iso);
  const formatted = formatDateShort(iso);
  return date.getTime() >= Date.now() ? `Próximo em ${formatted}` : `Último em ${formatted}`;
}

export default function AdminClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [pagination, setPagination] = useState<ClientsPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [visibility, setVisibility] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const fetchClients = useCallback(async () => {
    try {
      const res = await getClients({
        search: search || undefined,
        role: 'USER',
        includeInactive: visibility === 'ALL',
        active: visibility === 'ALL' ? undefined : visibility === 'ACTIVE',
        page,
        limit: PAGE_SIZE,
      });
      if (res.data?.clients) setClients(res.data.clients);
      if (res.data?.pagination) setPagination(res.data.pagination);
    } catch {
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  }, [page, search, visibility]);

  useEffect(() => {
    setLoading(true);
    void fetchClients();
  }, [fetchClients]);

  if (loading && !pagination) return null;

  const total = pagination?.total ?? clients.length;
  const totalPages = pagination?.totalPages ?? 1;

  return (
    <StaggerIn selector="[data-motion='enter']" className="space-y-5">
      <div data-motion="enter">
        <AdminPageHeader
          title="Clientes"
          description="Cadastro, contato e histórico de quem agenda no estúdio."
          action={
            <Button className="rounded-full" onClick={() => router.push('/admin/appointments/new')}>
              <Plus className="size-4" />
              Novo agendamento
            </Button>
          }
        />
      </div>

      <section data-motion="enter" className="admin-surface p-4 sm:p-5">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="admin-scroll-x flex gap-1 text-sm">
            {(
              [
                ['ALL', 'Todos'],
                ['ACTIVE', 'Ativos'],
                ['INACTIVE', 'Inativos'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setVisibility(value);
                  setPage(1);
                }}
                className={cn(
                  'rounded-full px-3 py-1.5 font-medium transition-colors',
                  visibility === value
                    ? 'bg-[var(--admin-card-muted)] text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, e-mail ou telefone..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="rounded-full pl-10"
            />
          </div>
        </div>

        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <ContactRound className="mb-4 size-12 text-muted-foreground/40" />
            <h2 className="text-lg font-semibold">Nenhum cliente encontrado</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {search || visibility !== 'ALL'
                ? 'Tente alterar os filtros de busca.'
                : 'Os clientes aparecem aqui depois do cadastro.'}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between px-1">
              <p className="text-sm font-medium">
                {total} {total === 1 ? 'cliente' : 'clientes'}
              </p>
            </div>
            <StaggerIn
              replayKey={`${visibility}-${search}-${page}`}
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
            >
              {clients.map((client) => {
                const accent = accentForId(client.id);
                const visits = client.appointmentCount ?? 0;
                return (
                  <Link
                    key={client.id}
                    href={`/admin/clients/${client.id}`}
                    data-motion="lift"
                    className={cn(
                      'rounded-[1.35rem] bg-[var(--admin-card-muted)] p-4 transition-colors hover:bg-[var(--admin-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      client.active === false && 'opacity-60',
                    )}
                  >
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <span className="inline-flex items-center rounded-full bg-[var(--admin-chip)] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        {visits} {visits === 1 ? 'agendamento' : 'agendamentos'}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-1 text-[11px] font-medium',
                          client.active === false
                            ? 'bg-[var(--admin-chip)] text-muted-foreground'
                            : 'bg-emerald-500/15 text-emerald-400',
                        )}
                      >
                        {client.active === false ? 'Inativo' : 'Ativo'}
                      </span>
                    </div>
                    <UserAvatar
                      name={client.name}
                      src={client.avatarUrl}
                      className="mb-5 size-16"
                      fallbackClassName={cn('text-lg', accent.bg, accent.fg)}
                    />
                    <h2 className="truncate font-semibold" title={client.name}>
                      {client.name}
                    </h2>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{client.email}</p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {appointmentWhenLabel(client.lastAppointmentAt)}
                    </p>
                  </Link>
                );
              })}
            </StaggerIn>
            {totalPages > 1 ? (
              <div className="mt-5 flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <p className="text-sm tabular-nums text-muted-foreground">
                  {page} / {totalPages}
                </p>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </StaggerIn>
  );
}
