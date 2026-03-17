'use client';

import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getMyAppointments,
  type Appointment,
  type AppointmentStatus,
} from '@/lib/api';
import { formatCurrency, formatDuration } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CalendarDays,
  CalendarPlus,
  Clock,
  Loader2,
  Package,
  Sparkles,
  ArrowRight,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; color: string }
> = {
  SCHEDULED: { label: 'Agendado', color: 'text-blue-400' },
  CONFIRMED: { label: 'Confirmado', color: 'text-emerald-400' },
  IN_PROGRESS: { label: 'Em andamento', color: 'text-yellow-400' },
  COMPLETED: { label: 'Concluído', color: 'text-green-400' },
  CANCELLED: { label: 'Cancelado', color: 'text-red-400' },
  NO_SHOW: { label: 'Não compareceu', color: 'text-gray-400' },
};

function formatSlotTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function formatDateCompact(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Sao_Paulo',
  });
}

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [nextAppointments, setNextAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);

  useEffect(() => {
    async function loadUpcoming() {
      try {
        const res = await getMyAppointments();
        if (res.data?.appointments) {
          const now = new Date();
          const upcoming = res.data.appointments
            .filter(
              (a) => new Date(a.date) >= now && !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(a.status),
            )
            .slice(0, 3);
          setNextAppointments(upcoming);
        }
      } catch {
        // silently fail
      } finally {
        setLoadingAppointments(false);
      }
    }
    loadUpcoming();
  }, []);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{greeting} 👋</p>
        <h1 className="text-2xl font-bold tracking-tight">{user?.name}</h1>
      </div>

      {/* Quick Action */}
      <button
        onClick={() => router.push('/book')}
        className="flex w-full items-center gap-4 rounded-2xl bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/20 p-4 text-left transition-all active:scale-[0.98]"
      >
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <CalendarPlus className="size-6" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Novo Agendamento</p>
          <p className="text-sm text-muted-foreground">
            Agende um horário em poucos passos
          </p>
        </div>
        <ArrowRight className="size-5 text-primary" />
      </button>

      {/* Next Appointments */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Próximos agendamentos</h2>
          {nextAppointments.length > 0 && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => router.push('/appointments')}
            >
              Ver todos
              <ArrowRight className="ml-1 size-3" />
            </Button>
          )}
        </div>

        {loadingAppointments ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : nextAppointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10">
            <CalendarDays className="mb-3 size-10 text-muted-foreground/30" />
            <p className="mb-1 text-sm text-muted-foreground">
              Nenhum agendamento próximo
            </p>
            <Button
              variant="link"
              size="sm"
              className="mt-1"
              onClick={() => router.push('/book')}
            >
              Agendar agora
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {nextAppointments.map((appointment) => {
              const statusConfig = STATUS_CONFIG[appointment.status];
              return (
                <Card
                  key={appointment.id}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => router.push('/appointments')}
                >
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Package className="size-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {appointment.product.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="size-3" />
                        {formatDateCompact(appointment.date)}
                        <span className="text-muted-foreground/50">·</span>
                        <Clock className="size-3" />
                        {formatSlotTime(appointment.date)}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <User className="size-3" />
                        {appointment.employee.name}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn('shrink-0 text-[10px]', statusConfig.color)}
                    >
                      {statusConfig.label}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
