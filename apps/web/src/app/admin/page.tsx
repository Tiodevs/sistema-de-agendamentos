'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getDashboardStats,
  type DashboardData,
  type AppointmentStatus,
} from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Package,
  Users,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Loader2,
  ArrowRight,
  Clock,
  CalendarPlus,
  DollarSign,
  UserCheck,
  BarChart3,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; color: string; dotColor: string }
> = {
  SCHEDULED: { label: 'Agendado', color: 'text-blue-400', dotColor: 'bg-blue-400' },
  CONFIRMED: { label: 'Confirmado', color: 'text-emerald-400', dotColor: 'bg-emerald-400' },
  IN_PROGRESS: { label: 'Em andamento', color: 'text-yellow-400', dotColor: 'bg-yellow-400' },
  COMPLETED: { label: 'Concluído', color: 'text-green-400', dotColor: 'bg-green-400' },
  CANCELLED: { label: 'Cancelado', color: 'text-red-400', dotColor: 'bg-red-400' },
  NO_SHOW: { label: 'Não compareceu', color: 'text-gray-400', dotColor: 'bg-gray-400' },
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatSlotTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function ChangeIndicator({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (value === 0) return null;
  const isPositive = value > 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        isPositive ? 'text-emerald-400' : 'text-red-400',
      )}
    >
      {isPositive ? (
        <TrendingUp className="size-3" />
      ) : (
        <TrendingDown className="size-3" />
      )}
      {isPositive ? '+' : ''}
      {value}%{suffix}
    </span>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <AlertCircle className="size-10 text-muted-foreground" />
        <p className="text-muted-foreground">Erro ao carregar dados</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const { overview, todayAppointments, statusBreakdown, recentAppointments, topProducts, topEmployees } = data;

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  const totalStatusCount = Object.values(statusBreakdown).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{greeting}! 👋</h1>
          <p className="text-muted-foreground">
            Aqui está o resumo do seu negócio.
          </p>
        </div>
        <Button onClick={() => router.push('/admin/appointments/new')}>
          <CalendarPlus className="mr-2 size-4" />
          Novo Agendamento
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Agendamentos do mês */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Agendamentos
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10">
              <CalendarDays className="size-4 text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overview.monthAppointments}</div>
            <div className="mt-1 flex items-center gap-2">
              <ChangeIndicator value={overview.appointmentChange} />
              <span className="text-xs text-muted-foreground">vs. mês anterior</span>
            </div>
          </CardContent>
        </Card>

        {/* Receita do mês */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receita do Mês
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <DollarSign className="size-4 text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(overview.monthRevenue)}</div>
            <div className="mt-1 flex items-center gap-2">
              <ChangeIndicator value={overview.revenueChange} />
              <span className="text-xs text-muted-foreground">vs. mês anterior</span>
            </div>
          </CardContent>
        </Card>

        {/* Clientes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clientes
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10">
              <UserCheck className="size-4 text-violet-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overview.totalClients}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              usuários cadastrados
            </p>
          </CardContent>
        </Card>

        {/* Equipe */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Equipe & Serviços
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-orange-500/10">
              <Package className="size-4 text-orange-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-3">
              <div>
                <span className="text-3xl font-bold">{overview.activeEmployees}</span>
                <span className="ml-1 text-xs text-muted-foreground">profissionais</span>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <span className="text-3xl font-bold">{overview.activeProducts}</span>
                <span className="ml-1 text-xs text-muted-foreground">serviços</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Middle Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Agendamentos de Hoje */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-5 text-primary" />
                Agenda de Hoje
              </CardTitle>
              <CardDescription>
                {todayAppointments.length === 0
                  ? 'Nenhum agendamento para hoje'
                  : `${todayAppointments.length} agendamento${todayAppointments.length !== 1 ? 's' : ''}`}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/admin/appointments')}
            >
              Ver todos
              <ArrowRight className="ml-1 size-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {todayAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10">
                <CalendarDays className="mb-2 size-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Nenhum compromisso agendado para hoje.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayAppointments.map((apt) => {
                  const statusCfg = STATUS_CONFIG[apt.status];
                  return (
                    <div
                      key={apt.id}
                      className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3"
                    >
                      <div className="hidden size-10 shrink-0 flex-col items-center justify-center rounded-lg border bg-background sm:flex">
                        <span className="text-xs font-bold">
                          {formatSlotTime(apt.date)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">
                            {apt.product.name}
                          </span>
                          <div className={cn('size-1.5 shrink-0 rounded-full', statusCfg.dotColor)} />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatSlotTime(apt.date)} – {formatSlotTime(apt.endDate)}</span>
                          <span>·</span>
                          <span>{apt.client.name}</span>
                        </div>
                      </div>
                      <Avatar className="size-8 shrink-0">
                        <AvatarFallback className="text-[10px]">
                          {getInitials(apt.employee.name)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-5 text-primary" />
              Status do Mês
            </CardTitle>
            <CardDescription>
              Distribuição dos agendamentos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {totalStatusCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <CalendarDays className="mb-2 size-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">Sem agendamentos este mês</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(Object.entries(STATUS_CONFIG) as [AppointmentStatus, typeof STATUS_CONFIG[AppointmentStatus]][]).map(
                  ([status, cfg]) => {
                    const count = statusBreakdown[status] || 0;
                    if (count === 0) return null;
                    const percentage = Math.round((count / totalStatusCount) * 100);
                    return (
                      <div key={status} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className={cn('size-2 rounded-full', cfg.dotColor)} />
                            <span className="text-muted-foreground">{cfg.label}</span>
                          </div>
                          <span className="font-medium">{count}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full transition-all', cfg.dotColor)}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Últimos Agendamentos */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Agendamentos Recentes</CardTitle>
              <CardDescription>Últimos agendamentos criados</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/admin/appointments')}
            >
              Ver todos
              <ArrowRight className="ml-1 size-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentAppointments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhum agendamento encontrado.
              </p>
            ) : (
              <div className="space-y-4">
                {recentAppointments.map((apt) => {
                  const statusCfg = STATUS_CONFIG[apt.status];
                  return (
                    <div
                      key={apt.id}
                      className="flex items-center gap-3"
                    >
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-xs text-primary">
                          {getInitials(apt.client.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {apt.client.name}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn('shrink-0 px-1.5 py-0 text-[10px]', statusCfg.color)}
                          >
                            {statusCfg.label}
                          </Badge>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {apt.product.name} · {apt.employee.name} · {formatDate(apt.date)}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-sm font-semibold text-primary">
                        {formatCurrency(apt.price)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rankings */}
        <div className="space-y-4">
          {/* Top Serviços */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="size-4 text-orange-400" />
                Top Serviços
              </CardTitle>
              <CardDescription className="text-xs">Mais agendados este mês</CardDescription>
            </CardHeader>
            <CardContent>
              {topProducts.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">Sem dados</p>
              ) : (
                <div className="space-y-2.5">
                  {topProducts.map((p, i) => (
                    <div key={p.productId} className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                          i === 0
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : i === 1
                              ? 'bg-gray-400/20 text-gray-400'
                              : i === 2
                                ? 'bg-orange-600/20 text-orange-500'
                                : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {i + 1}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {p.count}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Profissionais */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4 text-violet-400" />
                Top Profissionais
              </CardTitle>
              <CardDescription className="text-xs">Mais agendamentos este mês</CardDescription>
            </CardHeader>
            <CardContent>
              {topEmployees.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">Sem dados</p>
              ) : (
                <div className="space-y-2.5">
                  {topEmployees.map((e, i) => (
                    <div key={e.employeeId} className="flex items-center gap-2.5">
                      <Avatar className="size-6 shrink-0">
                        <AvatarFallback className="text-[9px]">
                          {getInitials(e.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate text-sm">{e.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {e.count}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
