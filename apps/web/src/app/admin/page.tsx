'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDashboardStats, type AppointmentStatus, type DashboardData } from '@/lib/api';
import { formatCompactHours, formatCurrency, formatDuration } from '@/lib/format';
import { STATUS_CONFIG } from '@/lib/appointment-status';
import { accentForProduct, iconForProduct } from '@/lib/admin-accents';
import { WeeklyChart } from '@/components/admin/weekly-chart';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CalendarDays, CalendarPlus, AlertCircle, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaggerIn } from '@/components/motion/stagger-in';

function monthRangeLabel() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const month = now.toLocaleDateString('pt-BR', {
    month: 'short',
    timeZone: 'America/Sao_Paulo',
  });
  return `1–${lastDay} ${month} ${now.getFullYear()}`;
}

function formatSlotTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function formatShortDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Sao_Paulo',
  });
}

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayFilter, setTodayFilter] = useState<'ALL' | AppointmentStatus>('ALL');

  useEffect(() => {
    async function load() {
      try {
        const res = await getDashboardStats();
        if (res.data) setData(res.data);
      } catch {
        toast.error('Erro ao carregar dados do dashboard');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredToday = useMemo(() => {
    if (!data) return [];
    if (todayFilter === 'ALL') return data.todayAppointments;
    return data.todayAppointments.filter((item) => item.status === todayFilter);
  }, [data, todayFilter]);
  if (loading) return null;

  if (!data) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <AlertCircle className="size-10 text-muted-foreground" />
        <p className="text-muted-foreground">Erro ao carregar dados</p>
        <Button variant="outline" className="rounded-full" onClick={() => window.location.reload()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const { overview, todayAppointments, statusBreakdown, recentAppointments, topProducts } = data;
  const timeSpent = data.timeSpent ?? {
    totalMinutes: 0,
    completedMinutes: 0,
    scheduledMinutes: 0,
  };
  const weeklyActivity = data.weeklyActivity ?? [];
  const totalStatusCount = Object.values(statusBreakdown).reduce((sum, count) => sum + count, 0);
  const activeCount =
    (statusBreakdown.SCHEDULED || 0) +
    (statusBreakdown.CONFIRMED || 0) +
    (statusBreakdown.IN_PROGRESS || 0);
  const completedCount = statusBreakdown.COMPLETED || 0;
  const stoppedCount = (statusBreakdown.CANCELLED || 0) + (statusBreakdown.NO_SHOW || 0);
  const nextAppointment = todayAppointments[0];
  const todayStatuses = Array.from(new Set(todayAppointments.map((item) => item.status)));

  return (
    <StaggerIn
      selector="[data-motion='enter']"
      className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]"
    >
      <div className="space-y-4">
        <section data-motion="enter" className="admin-surface p-5 sm:p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Tempo na agenda</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{monthRangeLabel()}</span>
              <span className="flex size-8 items-center justify-center rounded-xl bg-[var(--admin-card-muted)]">
                <CalendarDays className="size-4" />
              </span>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {formatCompactHours(timeSpent.totalMinutes)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Total no mês</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {formatCompactHours(timeSpent.completedMinutes)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Concluídas</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {formatCompactHours(timeSpent.scheduledMinutes)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Agendadas</p>
            </div>
          </div>

          <WeeklyChart weeks={weeklyActivity} />

          <div className="mt-5 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-[var(--admin-accent)]" />
              Concluídas
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-full admin-bar-striped" />
              Agendadas
            </span>
          </div>
        </section>

        <section data-motion="enter" className="admin-surface p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Agenda de hoje</h2>
            <div className="flex items-center gap-3">
              <div className="flex max-w-full gap-1 overflow-x-auto text-sm">
                <button
                  type="button"
                  onClick={() => setTodayFilter('ALL')}
                  className={cn(
                    'rounded-full px-3 py-1.5 font-medium transition-colors',
                    todayFilter === 'ALL'
                      ? 'bg-[var(--admin-card-muted)] text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Todos
                </button>
                {todayStatuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setTodayFilter(status)}
                    className={cn(
                      'rounded-full px-3 py-1.5 font-medium whitespace-nowrap transition-colors',
                      todayFilter === status
                        ? 'bg-[var(--admin-card-muted)] text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {STATUS_CONFIG[status].label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => router.push('/admin/appointments')}
                className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-[var(--admin-card-muted)] sm:flex"
                aria-label="Ver agendamentos"
              >
                <Search className="size-4" />
              </button>
            </div>
          </div>

          {filteredToday.length === 0 &&
          todayAppointments.length === 0 &&
          topProducts.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {topProducts.slice(0, 3).map((product) => {
                const accent = accentForProduct(product.name);
                const Icon = iconForProduct(product.name);
                return (
                  <button
                    key={product.productId}
                    type="button"
                    onClick={() => router.push('/admin/appointments/new')}
                    data-motion="lift"
                    className="rounded-[1.35rem] bg-[var(--admin-card-muted)] p-4 text-left transition-colors hover:bg-[var(--admin-hover)]"
                  >
                    <div
                      className={cn(
                        'mb-6 flex size-16 items-center justify-center rounded-3xl',
                        accent.bg,
                      )}
                    >
                      <Icon className={cn('size-8', accent.fg)} />
                    </div>
                    <p className="text-xs text-muted-foreground">{product.count} no mês</p>
                    <p className="mt-1 font-semibold">{product.name}</p>
                  </button>
                );
              })}
            </div>
          ) : filteredToday.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[1.35rem] bg-[var(--admin-card-muted)] py-12">
              <CalendarDays className="mb-2 size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum compromisso neste filtro.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredToday.slice(0, 6).map((appointment) => {
                const accent = accentForProduct(appointment.product.name);
                const Icon = iconForProduct(appointment.product.name);
                return (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => router.push('/admin/appointments')}
                    data-motion="lift"
                    className="rounded-[1.35rem] bg-[var(--admin-card-muted)] p-4 text-left transition-colors hover:bg-[var(--admin-hover)]"
                  >
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-chip)] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        {formatDuration(appointment.product.duration)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatSlotTime(appointment.date)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'mb-5 flex size-16 items-center justify-center rounded-3xl',
                        accent.bg,
                      )}
                    >
                      <Icon className={cn('size-8', accent.fg)} />
                    </div>
                    <p className="text-xs text-muted-foreground">{appointment.employee.name}</p>
                    <p className="mt-1 font-semibold leading-snug">{appointment.product.name}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {appointment.client.name}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <section
          data-motion="enter"
          className="overflow-hidden rounded-[1.5rem] bg-black p-5 text-white"
        >
          <div className="mb-8 flex items-start justify-between gap-3">
            <div>
              <p className="text-3xl font-semibold tracking-tight">
                {formatCurrency(overview.monthRevenue)}
              </p>
              <p className="mt-1 text-sm text-white/55">
                Receita do mês
                {overview.revenueChange !== 0 ? (
                  <span className="ml-2 text-white/70">
                    {overview.revenueChange > 0 ? '+' : ''}
                    {overview.revenueChange}%
                  </span>
                ) : null}
              </p>
            </div>
            <Button
              onClick={() => router.push('/admin/appointments/new')}
              className="rounded-full bg-white text-black hover:bg-white/90"
            >
              Novo
            </Button>
          </div>

          <div className="space-y-4">
            {recentAppointments.length === 0 ? (
              <p className="text-sm text-white/50">Nenhum agendamento recente.</p>
            ) : (
              recentAppointments.map((appointment) => {
                const Icon = iconForProduct(appointment.product.name);
                return (
                  <div key={appointment.id} className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/8">
                      <Icon className="size-4 text-white/80" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{appointment.product.name}</p>
                      <p className="truncate text-xs text-white/45">{appointment.client.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(appointment.price)}</p>
                      <p className="text-[11px] text-white/40">
                        {STATUS_CONFIG[appointment.status].label}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section data-motion="enter" className="admin-surface p-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-lg font-semibold tracking-tight">
                {overview.monthAppointments} no mês
              </p>
              <p className="text-sm text-muted-foreground">Distribuição da agenda</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {overview.appointmentChange === 0
                ? 'Estável'
                : `${overview.appointmentChange > 0 ? '+' : ''}${overview.appointmentChange}%`}
            </p>
          </div>

          <div className="mb-4 flex h-4 overflow-hidden rounded-full bg-[var(--admin-card-muted)]">
            {totalStatusCount > 0 ? (
              <>
                <div
                  className="h-full bg-[var(--admin-accent)]"
                  style={{ width: `${(activeCount / totalStatusCount) * 100}%` }}
                />
                <div
                  className="h-full bg-[#34C3DD]/40"
                  style={{ width: `${(completedCount / totalStatusCount) * 100}%` }}
                />
                <div
                  className="admin-muted-striped h-full"
                  style={{ width: `${(stoppedCount / totalStatusCount) * 100}%` }}
                />
              </>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-[var(--admin-accent)]" />
              Em aberto {activeCount}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-[#34C3DD]/40" />
              Concluídos {completedCount}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-full admin-muted-striped" />
              Encerrados {stoppedCount}
            </span>
          </div>
        </section>

        <section
          data-motion="enter"
          className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-[#12352f] via-[#0d1f27] to-[#1a1430] p-5"
        >
          <p className="text-sm text-white/70">
            {nextAppointment
              ? `${formatDuration(nextAppointment.product.duration)} · ${formatSlotTime(nextAppointment.date)}`
              : `${overview.activeEmployees} profissionais · ${overview.activeProducts} serviços`}
          </p>
          <p className="mt-2 text-xs text-white/45">
            {nextAppointment
              ? `Próximo: ${formatShortDate(nextAppointment.date)}`
              : `${overview.totalClients} clientes cadastrados`}
          </p>
          <h3 className="mt-8 text-2xl font-semibold tracking-tight text-white">
            {nextAppointment ? nextAppointment.product.name : 'Novo agendamento'}
          </h3>
          <p className="mt-2 max-w-[16rem] text-sm text-white/60">
            {nextAppointment
              ? `${nextAppointment.client.name} com ${nextAppointment.employee.name}`
              : 'Abra a agenda e marque o próximo horário da equipe.'}
          </p>
          <Button
            onClick={() => router.push('/admin/appointments/new')}
            className="mt-6 rounded-full bg-black text-white hover:bg-black/80"
          >
            <CalendarPlus className="size-4" />
            Mais detalhes
          </Button>
        </section>
      </aside>
    </StaggerIn>
  );
}
