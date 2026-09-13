'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDashboardStats, type DashboardData, type DashboardPeriod } from '@/lib/api';
import { formatCompactHours, formatCurrency, formatDuration, formatPercent } from '@/lib/format';
import { STATUS_CONFIG, STATUS_OPTIONS } from '@/lib/appointment-status';
import { iconForProduct } from '@/lib/admin-accents';
import { WeeklyChart } from '@/components/admin/weekly-chart';
import { RankingList } from '@/components/admin/ranking-list';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertCircle, CalendarDays, CalendarPlus, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaggerIn } from '@/components/motion/stagger-in';

const PERIODS: Array<{ key: DashboardPeriod; label: string }> = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
  { key: 'last7', label: '7 dias' },
  { key: 'last30', label: '30 dias' },
];

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

function ChangeLabel({ value, light = false }: { value: number; light?: boolean }) {
  if (value === 0) {
    return (
      <span className={light ? 'text-white/50' : 'text-muted-foreground'}>Estável vs anterior</span>
    );
  }

  const up = value > 0;
  return (
    <span className={up ? 'text-emerald-400' : 'text-red-400'}>
      {up ? '+' : ''}
      {value}% vs anterior
    </span>
  );
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; name: string }>;
  onChange: (id: string) => void;
}) {
  const selected = options.find((option) => option.id === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex max-w-[12rem] items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
            value
              ? 'bg-[var(--admin-card-muted)] text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <span className="truncate">{selected?.name || label}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto rounded-2xl">
        <DropdownMenuItem onClick={() => onChange('')}>Todos</DropdownMenuItem>
        {options.map((option) => (
          <DropdownMenuItem key={option.id} onClick={() => onChange(option.id)}>
            {option.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function KpiCard({
  label,
  value,
  hint,
  change,
}: {
  label: string;
  value: string;
  hint?: string;
  change?: number;
}) {
  return (
    <section data-motion="enter" className="admin-surface p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p>
      <div className="mt-2 flex flex-col gap-0.5 text-xs">
        {typeof change === 'number' ? <ChangeLabel value={change} /> : null}
        {hint ? <span className="text-muted-foreground">{hint}</span> : null}
      </div>
    </section>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [employeeId, setEmployeeId] = useState('');
  const [productId, setProductId] = useState('');
  const hasDataRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        if (hasDataRef.current) setRefreshing(true);
        else setLoading(true);
        const res = await getDashboardStats({
          period,
          employeeId: employeeId || undefined,
          productId: productId || undefined,
        });
        if (cancelled) return;
        if (res.data?.period) {
          const appliedEmployee = res.data.period.employeeId || '';
          const appliedProduct = res.data.period.productId || '';
          if (
            res.data.period.key !== period ||
            appliedEmployee !== employeeId ||
            appliedProduct !== productId
          ) {
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
  }, [period, employeeId, productId]);

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
  const employees = data.filters?.employees ?? [];
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
  const uniqueClients = overview.uniqueClients ?? 0;
  const occupancyRate = overview.occupancyRate ?? 0;
  const avgTicket = overview.avgTicket ?? 0;

  return (
    <StaggerIn
      selector="[data-motion='enter']"
      replayKey={`${period}-${employeeId}-${productId}`}
      className="space-y-4"
    >
      <section data-motion="enter" className="admin-surface p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto text-sm">
            {PERIODS.map((item) => (
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
          <div className="flex flex-wrap items-center gap-1">
            {employees.length > 0 ? (
              <FilterDropdown
                label="Profissional"
                value={employeeId}
                options={employees}
                onChange={setEmployeeId}
              />
            ) : null}
            {products.length > 0 ? (
              <FilterDropdown
                label="Serviço"
                value={productId}
                options={products}
                onChange={setProductId}
              />
            ) : null}
          </div>
        </div>
      </section>

      <div className={cn('space-y-4 transition-opacity', refreshing && 'opacity-60')}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4">
            <section data-motion="enter" className="admin-surface p-5 sm:p-6">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Tempo na agenda</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {periodMeta?.rangeLabel || periodMeta?.label || 'Período selecionado'}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{periodMeta?.label}</span>
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
                  <p className="mt-1 text-xs text-muted-foreground">Total no período</p>
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
                title="Profissionais em destaque"
                emptyLabel="Nenhum profissional no período."
                selectedId={employeeId}
                onSelect={setEmployeeId}
                items={(data.topEmployees ?? []).map((employee) => ({
                  id: employee.employeeId,
                  name: employee.name,
                  count: employee.count,
                  revenue: employee.revenue,
                }))}
              />
            </div>
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
                      <button
                        key={appointment.id}
                        type="button"
                        onClick={() => router.push('/admin/appointments')}
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
                            {STATUS_CONFIG[appointment.status].label}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <section data-motion="enter" className="admin-surface p-5">
              <div className="mb-4 flex items-end justify-between gap-3">
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
                  : `${overview.activeEmployees} profissionais · ${overview.activeProducts} serviços`}
              </p>
              <p className="mt-2 text-xs text-white/45">
                {nextAppointment
                  ? `Próximo: ${formatShortDate(nextAppointment.date)} · ${STATUS_CONFIG[nextAppointment.status].label}`
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
                {nextAppointment ? 'Mais detalhes' : 'Novo agendamento'}
              </Button>
            </section>
          </aside>
        </div>
      </div>
    </StaggerIn>
  );
}
