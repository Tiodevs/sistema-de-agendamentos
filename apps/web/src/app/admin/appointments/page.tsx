'use client';

import { useState, useEffect, useCallback } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getAppointments,
  updateAppointmentStatus,
  undoAppointmentStatus,
  type AppointmentStatus,
  type AppointmentsQuery,
} from '@/lib/api';
import { addDateKey, todayDateKey } from '@/lib/datetime';
import { formatCurrency, formatShortName } from '@/lib/format';
import { STATUS_CONFIG, STATUS_OPTIONS } from '@/lib/appointment-status';
import { STATUS_ACTION_LABELS, effectiveAllowed, groupActions } from '@/lib/status-actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/user-avatar';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { StatusConfirmDialog } from '@/components/appointments/status-confirm-dialog';
import { useStatusChange } from '@/components/appointments/use-status-change';
import {
  Plus,
  Search,
  MoreHorizontal,
  Loader2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaggerIn } from '@/components/motion/stagger-in';
import { ListSkeleton, LoadError } from '@/components/shell/page-states';

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function formatDayMonth(isoString: string): string {
  const date = new Date(isoString);
  const sameYear =
    date.toLocaleDateString('pt-BR', { year: 'numeric', timeZone: 'America/Sao_Paulo' }) ===
    new Date().toLocaleDateString('pt-BR', { year: 'numeric', timeZone: 'America/Sao_Paulo' });

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: sameYear ? undefined : '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

type Period = 'upcoming' | 'today' | 'week' | 'past' | 'all';

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: 'upcoming', label: 'A partir de hoje' },
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Próximos 7 dias' },
  { id: 'past', label: 'Anteriores' },
  { id: 'all', label: 'Tudo' },
];

/**
 * UX-09: a agenda abre no que vem pela frente e a API devolve uma página por vez. O período vira
 * `from`/`to` (dias no fuso de São Paulo); o passado vem do mais recente para o mais antigo.
 */
function periodQuery(period: Period): Pick<AppointmentsQuery, 'from' | 'to' | 'order'> {
  const today = todayDateKey();
  switch (period) {
    case 'today':
      return { from: today, to: today };
    case 'week':
      return { from: today, to: addDateKey(today, 6) };
    case 'past':
      return { to: addDateKey(today, -1), order: 'desc' };
    case 'all':
      return { from: '2000-01-01', order: 'desc' };
    default:
      // Sem período, a API começa em hoje.
      return {};
  }
}

export default function AppointmentsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'ALL'>('ALL');
  const [period, setPeriod] = useState<Period>('upcoming');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get('q');
    if (query) {
      setSearch(query);
      setTerm(query.trim());
      // Quem chega com uma busca (ficha do cliente, painel) quer ver o histórico também.
      setPeriod('all');
    }
  }, []);

  // A busca é feita no servidor (nome, e-mail ou telefone do cliente), depois de uma pausa na
  // digitação.
  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const agenda = useQuery({
    queryKey: ['appointments', 'admin', { period, statusFilter, term, page }],
    placeholderData: keepPreviousData,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const res = await getAppointments(
        {
          ...periodQuery(period),
          ...(statusFilter !== 'ALL' && { status: statusFilter }),
          ...(term && { search: term }),
          page,
          limit: PAGE_SIZE,
        },
        { signal },
      );
      return {
        appointments: res.data?.appointments ?? [],
        pagination: res.data?.pagination ?? { page, limit: PAGE_SIZE, total: 0, totalPages: 1 },
      };
    },
  });
  const { refetch } = agenda;
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // UX-06 / DOM-01: só as mudanças que a API permite; cancelar e registrar falta confirmam antes.
  const statusChange = useStatusChange({
    change: updateAppointmentStatus,
    undo: undoAppointmentStatus,
    onChanged: refresh,
  });

  const appointments = agenda.data?.appointments ?? [];
  const pagination = agenda.data?.pagination;
  const total = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;
  const filtered = Boolean(term) || statusFilter !== 'ALL' || period !== 'upcoming';

  function choosePeriod(next: Period) {
    setPeriod(next);
    setPage(1);
  }

  function chooseStatus(next: AppointmentStatus | 'ALL') {
    setStatusFilter(next);
    setPage(1);
  }

  if (agenda.isPending) return <ListSkeleton label="Carregando agendamentos…" />;

  return (
    <StaggerIn selector="[data-motion='enter']" className="space-y-5">
      <div data-motion="enter">
        <AdminPageHeader
          title="Agendamentos"
          description="Acompanhe e atualize os horários da agenda."
          action={
            <Button onClick={() => router.push('/admin/appointments/new')} className="rounded-full">
              <Plus className="size-4" />
              Novo Agendamento
            </Button>
          }
        />
      </div>

      <section data-motion="enter" className="admin-surface p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar cliente por nome, e-mail ou telefone"
              aria-label="Buscar cliente por nome, e-mail ou telefone"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="rounded-full pl-10"
            />
          </div>
          <div className="admin-scroll-x flex gap-1 text-sm">
            <button
              type="button"
              onClick={() => chooseStatus('ALL')}
              className={cn(
                'rounded-full px-3 py-1.5 font-medium whitespace-nowrap transition-colors',
                statusFilter === 'ALL'
                  ? 'bg-[var(--admin-card-muted)] text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              aria-pressed={statusFilter === 'ALL'}
            >
              Todos
            </button>
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => chooseStatus(status)}
                className={cn(
                  'rounded-full px-3 py-1.5 font-medium whitespace-nowrap transition-colors',
                  statusFilter === status
                    ? 'bg-[var(--admin-card-muted)] text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-pressed={statusFilter === status}
              >
                {STATUS_CONFIG[status].label}
              </button>
            ))}
          </div>
        </div>
        <div
          role="group"
          aria-label="Período"
          className="admin-scroll-x mt-3 flex gap-1 border-t border-border pt-3 text-sm"
        >
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => choosePeriod(item.id)}
              aria-pressed={period === item.id}
              className={cn(
                'rounded-full px-3 py-1.5 font-medium whitespace-nowrap transition-colors',
                period === item.id
                  ? 'bg-[var(--admin-card-muted)] text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {agenda.isError ? (
        <LoadError
          title="Não foi possível carregar os agendamentos"
          onRetry={() => void agenda.refetch()}
        />
      ) : appointments.length === 0 ? (
        <section
          data-motion="enter"
          className="admin-surface flex flex-col items-center justify-center px-6 py-16"
        >
          <CalendarDays className="mb-4 size-12 text-muted-foreground/40" />
          <h2 className="text-lg font-semibold">Nenhum agendamento encontrado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered
              ? 'Tente alterar a busca, o status ou o período.'
              : 'Nada marcado de hoje em diante. Veja “Anteriores” ou crie um agendamento.'}
          </p>
          {!filtered ? (
            <Button
              onClick={() => router.push('/admin/appointments/new')}
              className="mt-5 rounded-full"
            >
              <Plus className="size-4" />
              Novo Agendamento
            </Button>
          ) : null}
        </section>
      ) : (
        <section data-motion="enter" className="admin-surface overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-sm font-medium" aria-live="polite">
              {total} {total === 1 ? 'agendamento' : 'agendamentos'}
              {agenda.isFetching ? (
                <Loader2
                  className="ml-2 inline size-3.5 animate-spin text-muted-foreground"
                  aria-label="Atualizando"
                />
              ) : null}
            </p>
            {totalPages > 1 ? (
              <p className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </p>
            ) : null}
          </div>
          <StaggerIn
            replayKey={`${statusFilter}-${period}-${page}`}
            selector="[data-row]"
            className="divide-y divide-border"
          >
            {appointments.map((appointment) => {
              const { progress, destructive } = groupActions(
                effectiveAllowed(appointment, 'ADMIN'),
              );
              const busy = statusChange.updatingId === appointment.id;

              return (
                <div
                  key={appointment.id}
                  data-row
                  data-motion="lift"
                  className="flex items-start gap-3 px-4 py-4 sm:items-center sm:px-5"
                >
                  <div className="flex w-[4.75rem] shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl bg-[var(--admin-card-muted)] px-2 py-2.5 text-center">
                    <span className="text-[11px] leading-tight text-muted-foreground">
                      {formatDayMonth(appointment.date)}
                    </span>
                    <span className="mt-1 text-sm font-semibold leading-none tabular-nums">
                      {formatTime(appointment.date)}
                    </span>
                  </div>
                  <UserAvatar
                    name={appointment.client.name}
                    src={appointment.client.avatarUrl}
                    className="hidden size-10 shrink-0 md:flex"
                    fallbackClassName="bg-[var(--admin-card-muted)] text-xs"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                      <Link
                        href={`/admin/clients/${appointment.client.id}`}
                        className="min-w-0 truncate font-medium hover:underline"
                        title={appointment.client.name}
                      >
                        {formatShortName(appointment.client.name)}
                      </Link>
                      <StatusBadge status={appointment.status} />
                    </div>
                    <p
                      className="mt-1 truncate text-sm text-muted-foreground"
                      title={appointment.product.name}
                    >
                      {appointment.product.name}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground">
                      <span className="truncate" title={appointment.employee.name}>
                        {formatShortName(appointment.employee.name)}
                      </span>
                      <span aria-hidden>·</span>
                      <span className="whitespace-nowrap tabular-nums">
                        {formatTime(appointment.date)} – {formatTime(appointment.endDate)}
                      </span>
                      <span className="sm:hidden" aria-hidden>
                        ·
                      </span>
                      <span className="whitespace-nowrap font-medium text-foreground sm:hidden">
                        {formatCurrency(appointment.price)}
                      </span>
                    </p>
                  </div>
                  <p className="hidden shrink-0 font-semibold tabular-nums sm:block">
                    {formatCurrency(appointment.price)}
                  </p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 shrink-0 rounded-2xl"
                        aria-label={`Ações do agendamento de ${appointment.client.name}`}
                        disabled={busy}
                      >
                        {busy ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <MoreHorizontal className="size-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-2xl">
                      {progress.length === 0 && destructive.length === 0 ? (
                        <DropdownMenuItem disabled>Sem mudanças possíveis</DropdownMenuItem>
                      ) : null}
                      {progress.map((status) => (
                        <DropdownMenuItem
                          key={status}
                          onClick={() => statusChange.request(appointment, status)}
                        >
                          {STATUS_ACTION_LABELS[status]}
                        </DropdownMenuItem>
                      ))}
                      {progress.length > 0 && destructive.length > 0 ? (
                        <DropdownMenuSeparator />
                      ) : null}
                      {destructive.map((status) => (
                        <DropdownMenuItem
                          key={status}
                          variant="destructive"
                          onClick={() => statusChange.request(appointment, status)}
                        >
                          {STATUS_ACTION_LABELS[status]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </StaggerIn>
          {totalPages > 1 ? (
            <nav
              aria-label="Páginas da agenda"
              className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5"
            >
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={page <= 1 || agenda.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="size-4" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={page >= totalPages || agenda.isFetching}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Próxima
                <ChevronRight className="size-4" />
              </Button>
            </nav>
          ) : null}
        </section>
      )}

      <StatusConfirmDialog
        pending={statusChange.pending}
        loading={statusChange.isUpdating}
        onConfirm={statusChange.confirmPending}
        onDismiss={statusChange.dismissPending}
      />
    </StaggerIn>
  );
}
