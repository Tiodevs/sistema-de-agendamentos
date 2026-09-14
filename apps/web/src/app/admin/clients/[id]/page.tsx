'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CalendarDays, CalendarPlus, Mail, Phone, Search } from 'lucide-react';
import { toast } from 'sonner';
import { KpiCard } from '@/components/admin/dashboard-widgets';
import { StatusBadge } from '@/components/admin/status-badge';
import { StaggerIn } from '@/components/motion/stagger-in';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { accentForId } from '@/lib/admin-accents';
import { STATUS_CONFIG, STATUS_OPTIONS } from '@/lib/appointment-status';
import {
  getClient,
  type Appointment,
  type AppointmentStatus,
  type Client,
  type ClientStats,
} from '@/lib/api';
import { formatCurrency, formatDateShort, formatShortName } from '@/lib/format';
import { cn } from '@/lib/utils';

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

export default function AdminClientDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [client, setClient] = useState<Client | null>(null);
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const fetchClient = useCallback(async () => {
    if (!clientId) return;
    try {
      const res = await getClient(clientId);
      if (res.data?.client) setClient(res.data.client);
      if (res.data?.stats) setStats(res.data.stats);
      if (res.data?.appointments) setAppointments(res.data.appointments);
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      if (error.statusCode === 404) {
        setNotFound(true);
      } else {
        toast.error(error.message || 'Erro ao carregar cliente');
      }
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void fetchClient();
  }, [fetchClient]);

  const filteredAppointments = useMemo(() => {
    const query = search.toLowerCase();
    return appointments.filter((appointment) => {
      const matchesStatus = statusFilter === 'ALL' || appointment.status === statusFilter;
      const matchesSearch =
        !query ||
        appointment.product.name.toLowerCase().includes(query) ||
        appointment.employee.name.toLowerCase().includes(query) ||
        (appointment.notes || '').toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [appointments, search, statusFilter]);

  if (loading) return null;

  if (notFound || !client || !stats) {
    return (
      <section className="admin-surface flex flex-col items-center justify-center px-6 py-16">
        <CalendarDays className="mb-4 size-12 text-muted-foreground/40" />
        <h2 className="text-lg font-semibold">Cliente não encontrado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Esse cadastro pode ter sido removido ou o link está inválido.
        </p>
        <Button
          className="mt-5 rounded-full"
          variant="outline"
          onClick={() => router.push('/admin/clients')}
        >
          Voltar para clientes
        </Button>
      </section>
    );
  }

  const accent = accentForId(client.id);

  return (
    <StaggerIn selector="[data-motion='enter']" className="space-y-5">
      <div data-motion="enter" className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-2xl"
          onClick={() => router.push('/admin/clients')}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">Clientes</p>
        <Button
          className="hidden rounded-full sm:inline-flex"
          onClick={() => router.push(`/admin/appointments/new?clientId=${client.id}`)}
        >
          <CalendarPlus className="size-4" />
          Novo agendamento
        </Button>
      </div>

      <section data-motion="enter" className="admin-surface p-4 sm:p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <UserAvatar
            name={client.name}
            src={client.avatarUrl}
            className="size-20"
            fallbackClassName={cn('text-xl', accent.bg, accent.fg)}
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">{client.name}</h1>
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
            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              <a
                href={`mailto:${client.email}`}
                className="inline-flex min-w-0 items-center gap-2 hover:text-foreground"
              >
                <Mail className="size-3.5 shrink-0" />
                <span className="truncate">{client.email}</span>
              </a>
              {client.phone ? (
                <a
                  href={`tel:${client.phone}`}
                  className="inline-flex min-w-0 items-center gap-2 hover:text-foreground"
                >
                  <Phone className="size-3.5 shrink-0" />
                  <span>{client.phone}</span>
                </a>
              ) : (
                <p className="inline-flex items-center gap-2">
                  <Phone className="size-3.5 shrink-0" />
                  Sem telefone
                </p>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground sm:text-right">
            Cliente desde{' '}
            <span className="font-medium text-foreground">
              {client.createdAt ? formatDateShort(client.createdAt) : '—'}
            </span>
          </p>
        </div>
        <Button
          className="mt-5 w-full rounded-full sm:hidden"
          onClick={() => router.push(`/admin/appointments/new?clientId=${client.id}`)}
        >
          <CalendarPlus className="size-4" />
          Novo agendamento
        </Button>
      </section>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Visitas"
          value={String(stats.completed)}
          hint={`${stats.total} ${stats.total === 1 ? 'agendamento' : 'agendamentos'} no histórico`}
        />
        <KpiCard
          label="Realizado"
          value={formatCurrency(stats.completedRevenue)}
          hint={`${formatCurrency(stats.expectedRevenue)} ainda na agenda`}
        />
        <KpiCard
          label="Próximos"
          value={String(stats.upcoming)}
          hint={
            stats.lastAppointmentAt
              ? `Último horário em ${formatDateShort(stats.lastAppointmentAt)}`
              : 'Sem horários registrados'
          }
        />
        <KpiCard
          label="Faltas"
          value={String(stats.noShow)}
          hint={`${stats.cancelled} cancelados`}
        />
      </div>

      {stats.favoriteProduct || stats.favoriteEmployee ? (
        <section data-motion="enter" className="grid gap-4 sm:grid-cols-2">
          {stats.favoriteProduct ? (
            <div className="admin-surface p-4 sm:p-5">
              <p className="text-xs text-muted-foreground">Serviço mais frequente</p>
              <p className="mt-2 truncate text-lg font-semibold">{stats.favoriteProduct.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {stats.favoriteProduct.count} {stats.favoriteProduct.count === 1 ? 'vez' : 'vezes'}
              </p>
            </div>
          ) : null}
          {stats.favoriteEmployee ? (
            <div className="admin-surface p-4 sm:p-5">
              <p className="text-xs text-muted-foreground">Profissional mais frequente</p>
              <p className="mt-2 truncate text-lg font-semibold">{stats.favoriteEmployee.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {stats.favoriteEmployee.count}{' '}
                {stats.favoriteEmployee.count === 1 ? 'atendimento' : 'atendimentos'}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <section data-motion="enter" className="admin-surface p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por serviço, profissional ou observação..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="rounded-full pl-10"
            />
          </div>
          <div className="admin-scroll-x flex gap-1 text-sm">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={cn(
                'rounded-full px-3 py-1.5 font-medium whitespace-nowrap transition-colors',
                statusFilter === 'ALL'
                  ? 'bg-[var(--admin-card-muted)] text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Todos
            </button>
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'rounded-full px-3 py-1.5 font-medium whitespace-nowrap transition-colors',
                  statusFilter === status
                    ? 'bg-[var(--admin-card-muted)] text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {STATUS_CONFIG[status].label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {filteredAppointments.length === 0 ? (
        <section
          data-motion="enter"
          className="admin-surface flex flex-col items-center justify-center px-6 py-16"
        >
          <CalendarDays className="mb-4 size-12 text-muted-foreground/40" />
          <h2 className="text-lg font-semibold">Nenhum agendamento neste filtro</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || statusFilter !== 'ALL'
              ? 'Tente alterar os filtros.'
              : 'Este cliente ainda não tem histórico na agenda.'}
          </p>
        </section>
      ) : (
        <section data-motion="enter" className="admin-surface overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-sm font-medium">
              {filteredAppointments.length}{' '}
              {filteredAppointments.length === 1 ? 'agendamento' : 'agendamentos'}
            </p>
          </div>
          <StaggerIn
            replayKey={statusFilter}
            selector="[data-row]"
            className="divide-y divide-border"
          >
            {filteredAppointments.map((appointment) => (
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
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                    <p className="min-w-0 truncate font-medium" title={appointment.product.name}>
                      {appointment.product.name}
                    </p>
                    <StatusBadge status={appointment.status as AppointmentStatus} />
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground">
                    <span className="truncate" title={appointment.employee.name}>
                      {formatShortName(appointment.employee.name)}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="whitespace-nowrap tabular-nums">
                      {formatTime(appointment.date)} – {formatTime(appointment.endDate)}
                    </span>
                  </p>
                  {appointment.notes ? (
                    <p
                      className="mt-1 truncate text-xs text-muted-foreground"
                      title={appointment.notes}
                    >
                      {appointment.notes}
                    </p>
                  ) : null}
                </div>
                <p className="hidden shrink-0 font-semibold tabular-nums sm:block">
                  {formatCurrency(appointment.price)}
                </p>
              </div>
            ))}
          </StaggerIn>
        </section>
      )}
    </StaggerIn>
  );
}
