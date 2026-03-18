'use client';

import { useEffect, useState } from 'react';
import {
  getProfessionalDashboard,
  type ProfessionalDashboardData,
  type AppointmentStatus,
} from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CalendarDays,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  CalendarCheck,
  Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; color: string; bg: string }> = {
  SCHEDULED: { label: 'Agendado', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  CONFIRMED: { label: 'Confirmado', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  IN_PROGRESS: { label: 'Em andamento', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  COMPLETED: { label: 'Concluído', color: 'text-green-400', bg: 'bg-green-500/20' },
  CANCELLED: { label: 'Cancelado', color: 'text-red-400', bg: 'bg-red-500/20' },
  NO_SHOW: { label: 'Não compareceu', color: 'text-gray-400', bg: 'bg-gray-500/20' },
};

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

export default function ProfessionalDashboardPage() {
  const [data, setData] = useState<ProfessionalDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await getProfessionalDashboard();
        if (res.data) setData(res.data);
      } catch {
        setError('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2">
        <p className="text-muted-foreground">{error || 'Sem dados'}</p>
      </div>
    );
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  const { overview } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground">{greeting} 👋</p>
        <h1 className="text-2xl font-bold tracking-tight">
          {data.employee?.name || 'Profissional'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Aqui está o resumo da sua atividade
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Agendamentos do mês */}
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-blue-500/10">
              <CalendarDays className="size-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Mês atual</p>
              <p className="text-2xl font-bold">{overview.monthAppointments}</p>
              <div className="flex items-center gap-1 text-xs">
                {overview.appointmentChange >= 0 ? (
                  <TrendingUp className="size-3 text-emerald-400" />
                ) : (
                  <TrendingDown className="size-3 text-red-400" />
                )}
                <span className={overview.appointmentChange >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {overview.appointmentChange > 0 ? '+' : ''}{overview.appointmentChange}%
                </span>
                <span className="text-muted-foreground">vs mês anterior</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Receita do mês */}
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/10">
              <DollarSign className="size-6 text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Receita do mês</p>
              <p className="text-2xl font-bold">{formatCurrency(overview.monthRevenue)}</p>
              <div className="flex items-center gap-1 text-xs">
                {overview.revenueChange >= 0 ? (
                  <TrendingUp className="size-3 text-emerald-400" />
                ) : (
                  <TrendingDown className="size-3 text-red-400" />
                )}
                <span className={overview.revenueChange >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {overview.revenueChange > 0 ? '+' : ''}{overview.revenueChange}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Semana */}
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-purple-500/10">
              <CalendarCheck className="size-6 text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Esta semana</p>
              <p className="text-2xl font-bold">{overview.weekAppointments}</p>
              <p className="text-xs text-muted-foreground">agendamentos</p>
            </div>
          </CardContent>
        </Card>

        {/* Clientes atendidos */}
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-orange-500/10">
              <Users className="size-6 text-orange-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Clientes</p>
              <p className="text-2xl font-bold">{overview.totalClients}</p>
              <p className="text-xs text-muted-foreground">clientes atendidos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Agenda de hoje */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-5 text-primary" />
              Agenda de Hoje
              <Badge variant="secondary" className="ml-auto">
                {data.todayAppointments.length} atendimentos
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.todayAppointments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum atendimento hoje 🎉
              </p>
            ) : (
              <div className="space-y-3">
                {data.todayAppointments.map((apt) => {
                  const config = STATUS_CONFIG[apt.status];
                  return (
                    <div
                      key={apt.id}
                      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="text-center">
                        <p className="text-sm font-bold">{formatTime(apt.date)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(apt.endDate)}
                        </p>
                      </div>
                      <div className="h-10 w-px bg-border" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{apt.client.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {apt.product.name} · {apt.product.duration}min
                        </p>
                      </div>
                      <Badge variant="outline" className={cn('text-xs', config.color)}>
                        {config.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumo mensal + top serviços */}
        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resumo do Mês</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-green-400" />
                  <span className="text-sm">Concluídos</span>
                </div>
                <span className="text-sm font-bold">{overview.completedMonth}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="size-4 text-red-400" />
                  <span className="text-sm">Cancelados</span>
                </div>
                <span className="text-sm font-bold">{overview.cancelledMonth}</span>
              </div>
              {Object.entries(data.statusBreakdown).map(([status, count]) => {
                const config = STATUS_CONFIG[status as AppointmentStatus];
                if (!config) return null;
                return (
                  <div key={status} className="flex items-center justify-between">
                    <span className={cn('text-sm', config.color)}>{config.label}</span>
                    <span className="text-sm font-bold">{count}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Top Serviços */}
          {data.topProducts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="size-4 text-yellow-400" />
                  Top Serviços
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.topProducts.map((p, i) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <div key={p.productId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-center text-sm">
                          {i < 3 ? medals[i] : `${i + 1}.`}
                        </span>
                        <span className="text-sm">{p.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {p.count}x
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
