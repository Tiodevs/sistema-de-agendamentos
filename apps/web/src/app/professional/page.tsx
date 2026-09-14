'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getProfessionalDashboard,
  type DashboardPeriod,
  type ProfessionalDashboardData,
} from '@/lib/api';
import { formatCompactHours, formatCurrency, formatDuration, formatPercent } from '@/lib/format';
import { STATUS_CONFIG, STATUS_OPTIONS } from '@/lib/appointment-status';
import { iconForProduct } from '@/lib/admin-accents';
import { WeeklyChart } from '@/components/admin/weekly-chart';
import { RankingList } from '@/components/admin/ranking-list';
import {
  ChangeLabel,
  DASHBOARD_PERIODS,
  FilterDropdown,
  formatShortDate,
  formatSlotTime,
  KpiCard,
} from '@/components/admin/dashboard-widgets';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AlertCircle, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaggerIn } from '@/components/motion/stagger-in';

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function ProfessionalDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<ProfessionalDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [productId, setProductId] = useState('');
  const hasDataRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        if (hasDataRef.current) setRefreshing(true);
        else setLoading(true);
        const res = await getProfessionalDashboard({
          period,
          productId: productId || undefined,
        });
        if (cancelled) return;
        if (res.data?.period) {
          const appliedProduct = res.data.period.productId || '';
          if (res.data.period.key !== period || appliedProduct !== productId) {
            return;
          }
        }
        if (res.data) {
          setData(res.data);
          hasDataRef.current = true;
        }
      } catch {
        if (!cancelled) toast.error('Erro ao carregar dados do dashboard');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void fetchStats();
    return () => {
      cancelled = true;
    };
  }, [period, productId]);

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

  const overview = data.overview ?? {
    monthAppointments: 0,
    appointmentChange: 0,
    monthRevenue: 0,
    revenueChange: 0,
    totalClients: 0,
  };
  const todayAppointments = data.todayAppointments ?? [];
  const statusBreakdown = data.statusBreakdown ?? {};
  const recentAppointments = data.recentAppointments ?? [];
  const topProducts = data.topProducts ?? [];
  const timeSpent = data.timeSpent ?? {
    totalMinutes: 0,
    completedMinutes: 0,
    scheduledMinutes: 0,
  };
  const weeklyActivity = data.weeklyActivity ?? [];
  const products = data.filters?.products ?? [];
  const periodMeta = data.period;
  const totalStatusCount = Object.values(statusBreakdown).reduce((sum, count) => sum + count, 0);
  const visibleStatuses = STATUS_OPTIONS.filter((status) => (statusBreakdown[status] || 0) > 0);
  const completedCount = statusBreakdown.COMPLETED || 0;
  const nextAppointment =
    todayAppointments.find(
      (item) =>
        item.status === 'SCHEDULED' || item.status === 'CONFIRMED' || item.status === 'IN_PROGRESS',
    ) ?? todayAppointments[0];
  const completedRevenue = overview.completedRevenue ?? 0;
  const expectedRevenue = overview.expectedRevenue ?? 0;
  const uniqueClients = overview.uniqueClients ?? overview.totalClients ?? 0;
  const occupancyRate = overview.occupancyRate ?? 0;
  const avgTicket = overview.avgTicket ?? 0;

  return (
    <StaggerIn
      selector="[data-motion='enter']"
      replayKey={`${period}-${productId}`}
      className="space-y-4"
    >
      <section data-motion="enter" className="admin-surface p-4 sm:p-5">
        <div className="mb-4 min-w-0">
          <p className="text-sm text-muted-foreground">{greetingForNow()}</p>
          <h1 className="mt-1 truncate text-lg font-semibold tracking-tight sm:text-xl">
            {data.employee?.name || 'Profissional'}
          </h1>
        </div>
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="admin-scroll-x flex gap-1 text-sm">
            {DASHBOARD_PERIODS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPeriod(item.key)}
                className={cn(
                  'rounded-full px-3 py-1.5 font-medium whitespace-nowrap transition-colors',
                  period === item.key
                    ? 'bg-[var(--admin-card-muted)] text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          {products.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1">
              <FilterDropdown
                label="Serviço"
                value={productId}
                options={products}
                onChange={setProductId}
              />
            </div>
          ) : null}
        </div>
      </section>

      <div className={cn('space-y-4 transition-opacity', refreshing && 'opacity-60')}>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Agendamentos"
            value={String(overview.monthAppointments)}
            change={overview.appointmentChange}
            hint={`${overview.completedAppointments ?? completedCount} concluídos · ${uniqueClients} clientes`}
          />
          <KpiCard
            label="Receita"
            value={formatCurrency(overview.monthRevenue)}
            change={overview.revenueChange}
            hint={`${formatCurrency(completedRevenue)} realizado · ${formatCurrency(expectedRevenue)} previsto`}
          />
          <KpiCard
            label="Ticket médio"
            value={formatCurrency(avgTicket)}
            hint="Por agendamento válido no período"
          />
          <KpiCard
            label="Ocupação"
            value={formatPercent(occupancyRate)}
            hint={
              (overview.availableMinutes ?? 0) > 0
                ? `${formatCompactHours(overview.occupancyMinutes ?? timeSpent.totalMinutes)} de ${formatCompactHours(overview.availableMinutes ?? 0)} disponíveis`
                : 'Sem expediente no período'
            }
          />
        </div>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-4">
            <section data-motion="enter" className="admin-surface p-4 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3 sm:mb-6">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold tracking-tight">Tempo na agenda</h2>
                  <p className="mt-1 text-sm leading-snug text-muted-foreground">
                    {periodMeta?.rangeLabel || periodMeta?.label || 'Período selecionado'}
                  </p>
                </div>
                <div className="hidden shrink-0 items-center gap-2 text-sm text-muted-foreground sm:flex">
                  <span>{periodMeta?.label}</span>
                  <span className="flex size-8 items-center justify-center rounded-xl bg-[var(--admin-card-muted)]">
                    <CalendarDays className="size-4" />
                  </span>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-3 gap-2 sm:mb-8 sm:gap-4">
                <div className="min-w-0">
                  <p className="text-xl font-semibold tracking-tight sm:text-3xl">
                    {formatCompactHours(timeSpent.totalMinutes)}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground sm:text-xs">
                    Total no período
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-semibold tracking-tight sm:text-3xl">
                    {formatCompactHours(timeSpent.completedMinutes)}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground sm:text-xs">
                    Concluídas
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-semibold tracking-tight sm:text-3xl">
                    {formatCompactHours(timeSpent.scheduledMinutes)}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground sm:text-xs">
                    Agendadas
                  </p>
                </div>
              </div>

              <WeeklyChart weeks={weeklyActivity} />

              <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
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

            <div className="grid gap-4 lg:grid-cols-2">
              <RankingList
                title="Serviços mais agendados"
                emptyLabel="Nenhum serviço no período."
                selectedId={productId}
                onSelect={setProductId}
                items={topProducts.map((product) => ({
                  id: product.productId,
                  name: product.name,
                  count: product.count,
                  revenue: product.revenue,
                }))}
              />
              <RankingList
                title="Clientes em destaque"
                emptyLabel="Nenhum cliente no período."
                items={(data.topClients ?? []).map((client) => ({
                  id: client.clientId,
                  name: client.name,
                  count: client.count,
                  revenue: client.revenue,
                }))}
              />
            </div>
          </div>

          <aside className="min-w-0 space-y-4">
            <section
              data-motion="enter"
              className="overflow-hidden rounded-[1.5rem] bg-black p-5 text-white"
            >
              <div className="mb-8 flex items-start justify-between gap-3">
                <div>
                  <p className="text-3xl font-semibold tracking-tight">
                    {formatCurrency(overview.monthRevenue)}
                  </p>
                  <p className="mt-1 text-sm text-white/55">Receita do período</p>
                  <p className="mt-1 text-xs">
                    <ChangeLabel value={overview.revenueChange} light />
                  </p>
                  <p className="mt-3 text-xs text-white/45">
                    {formatCurrency(completedRevenue)} realizado
                    <span className="mx-1.5">·</span>
                    {formatCurrency(expectedRevenue)} previsto
                  </p>
                </div>
                <Button
                  onClick={() => router.push('/professional/agenda')}
                  className="rounded-full bg-white text-black hover:bg-white/90"
                >
                  Agenda
                </Button>
              </div>

              <div className="space-y-4">
                {recentAppointments.length === 0 ? (
                  <p className="text-sm text-white/50">Nenhum agendamento recente.</p>
                ) : (
                  recentAppointments.map((appointment) => {
                    const Icon = iconForProduct(appointment.product.name);
                    return (
                      <button
                        key={appointment.id}
                        type="button"
                        onClick={() => router.push('/professional/agenda')}
                        className="flex w-full items-center gap-3 text-left"
                      >
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/8">
                          <Icon className="size-4 text-white/80" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{appointment.product.name}</p>
                          <p className="truncate text-xs text-white/45">
                            {appointment.client.name} · {formatShortDate(appointment.date)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            {formatCurrency(appointment.price)}
                          </p>
                          <p className="text-[11px] text-white/40">
                            {STATUS_CONFIG[appointment.status]?.label ?? appointment.status}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <section data-motion="enter" className="admin-surface p-4 sm:p-5">
              <div className="mb-4 flex min-w-0 items-end justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold tracking-tight">
                    {overview.totalAppointments ?? totalStatusCount} no período
                  </p>
                  <p className="text-sm text-muted-foreground">Distribuição por status</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatPercent(overview.completionRate ?? 0)} concluídos
                </p>
              </div>

              <div className="mb-4 flex h-4 overflow-hidden rounded-full bg-[var(--admin-card-muted)]">
                {visibleStatuses.map((status) => {
                  const count = statusBreakdown[status] || 0;
                  return (
                    <div
                      key={status}
                      className={cn('h-full min-w-1', STATUS_CONFIG[status].dotColor)}
                      style={{ width: `${(count / totalStatusCount) * 100}%` }}
                      title={`${STATUS_CONFIG[status].label}: ${count}`}
                    />
                  );
                })}
              </div>

              <div className="space-y-2.5">
                {visibleStatuses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum agendamento no período.</p>
                ) : (
                  visibleStatuses.map((status) => {
                    const count = statusBreakdown[status] || 0;
                    const share = totalStatusCount > 0 ? (count / totalStatusCount) * 100 : 0;
                    return (
                      <div key={status} className="flex items-center gap-3 text-sm">
                        <span
                          className={cn(
                            'size-2.5 shrink-0 rounded-full',
                            STATUS_CONFIG[status].dotColor,
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">
                          {STATUS_CONFIG[status].label}
                        </span>
                        <span className="tabular-nums text-foreground">{count}</span>
                        <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                          {Math.round(share)}%
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section
              data-motion="enter"
              className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-[#12352f] via-[#0d1f27] to-[#1a1430] p-5"
            >
              <p className="text-sm text-white/70">
                {nextAppointment
                  ? `${formatDuration(nextAppointment.product.duration)} · ${formatSlotTime(nextAppointment.date)}`
                  : `${overview.monthAppointments} no período`}
              </p>
              <p className="mt-2 text-xs text-white/45">
                {nextAppointment
                  ? `Próximo: ${formatShortDate(nextAppointment.date)} · ${STATUS_CONFIG[nextAppointment.status]?.label ?? nextAppointment.status}`
                  : `${uniqueClients} clientes no recorte`}
              </p>
              <h3 className="mt-8 text-2xl font-semibold tracking-tight text-white">
                {nextAppointment ? nextAppointment.product.name : 'Agenda livre'}
              </h3>
              <p className="mt-2 max-w-[16rem] text-sm text-white/60">
                {nextAppointment
                  ? `Com ${nextAppointment.client.name}`
                  : 'Quando chegar o próximo horário, ele aparece aqui.'}
              </p>
              <Button
                onClick={() => router.push('/professional/agenda')}
                className="mt-6 rounded-full bg-black text-white hover:bg-black/80"
              >
                {nextAppointment ? 'Ver detalhes' : 'Ver agenda'}
              </Button>
            </section>
          </aside>
        </div>
      </div>
    </StaggerIn>
  );
}
