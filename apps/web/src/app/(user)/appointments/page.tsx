'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  getMyAppointments,
  cancelMyAppointment,
  type Appointment,
  type AppointmentStatus,
} from '@/lib/api';
import { formatCurrency, formatDuration, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CalendarDays,
  CalendarPlus,
  Clock,
  Loader2,
  MapPin,
  User,
  Package,
  X,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; color: string; bg: string }
> = {
  SCHEDULED: { label: 'Agendado', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  CONFIRMED: { label: 'Confirmado', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  IN_PROGRESS: { label: 'Em andamento', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  COMPLETED: { label: 'Concluído', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  CANCELLED: { label: 'Cancelado', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  NO_SHOW: { label: 'Não compareceu', color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' },
};

function formatSlotTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function formatDateLong(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  });
}

export default function MyAppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  const loadAppointments = useCallback(async () => {
    try {
      const res = await getMyAppointments();
      if (res.data?.appointments) {
        setAppointments(res.data.appointments);
      }
    } catch {
      toast.error('Erro ao carregar agendamentos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  async function handleCancel() {
    if (!cancelId) return;
    setCancelling(true);
    try {
      await cancelMyAppointment(cancelId);
      toast.success('Agendamento cancelado com sucesso');
      setCancelId(null);
      loadAppointments();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Erro ao cancelar agendamento');
    } finally {
      setCancelling(false);
    }
  }

  const now = new Date();
  const upcoming = appointments.filter(
    (a) => new Date(a.date) >= now && !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(a.status),
  );
  const past = appointments.filter(
    (a) => new Date(a.date) < now || ['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(a.status),
  );

  const displayedAppointments = activeTab === 'upcoming' ? upcoming : past;

  function canCancel(appointment: Appointment): boolean {
    return (
      ['SCHEDULED', 'CONFIRMED'].includes(appointment.status) &&
      new Date(appointment.date) > now
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meus Agendamentos</h1>
          <p className="text-sm text-muted-foreground">
            {upcoming.length} agendamento{upcoming.length !== 1 && 's'} próximo{upcoming.length !== 1 && 's'}
          </p>
        </div>
        <Button size="sm" onClick={() => router.push('/book')}>
          <CalendarPlus className="mr-1.5 size-4" />
          Agendar
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg border bg-muted/30 p-1">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={cn(
            'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            activeTab === 'upcoming'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Próximos ({upcoming.length})
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={cn(
            'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            activeTab === 'past'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Histórico ({past.length})
        </button>
      </div>

      {/* Appointments List */}
      {displayedAppointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
          <CalendarDays className="mb-3 size-12 text-muted-foreground/30" />
          <p className="mb-1 text-sm font-medium text-muted-foreground">
            {activeTab === 'upcoming'
              ? 'Nenhum agendamento próximo'
              : 'Nenhum agendamento no histórico'}
          </p>
          {activeTab === 'upcoming' && (
            <Button
              variant="link"
              size="sm"
              className="mt-2"
              onClick={() => router.push('/book')}
            >
              Fazer um agendamento
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayedAppointments.map((appointment) => {
            const statusConfig = STATUS_CONFIG[appointment.status];
            return (
              <Card
                key={appointment.id}
                className="overflow-hidden transition-shadow hover:shadow-md"
              >
                <CardContent className="p-0">
                  {/* Status bar */}
                  <div
                    className={cn(
                      'flex items-center justify-between border-b px-4 py-2',
                      statusConfig.bg,
                    )}
                  >
                    <span className={cn('text-xs font-semibold', statusConfig.color)}>
                      {statusConfig.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(appointment.createdAt)}
                    </span>
                  </div>

                  <div className="space-y-3 p-4">
                    {/* Service info */}
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Package className="size-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{appointment.product.name}</p>
                        <p className="font-mono text-sm text-primary">
                          {formatCurrency(appointment.price)}
                        </p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
                        <CalendarDays className="size-3.5 text-muted-foreground" />
                        <span className="text-xs">
                          {formatDateLong(appointment.date)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
                        <Clock className="size-3.5 text-muted-foreground" />
                        <span className="text-xs">
                          {formatSlotTime(appointment.date)} – {formatSlotTime(appointment.endDate)}
                        </span>
                      </div>
                    </div>

                    {/* Professional */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="size-3.5" />
                      <span>{appointment.employee.name}</span>
                    </div>

                    {/* Notes */}
                    {appointment.notes && (
                      <p className="text-xs text-muted-foreground italic">
                        &ldquo;{appointment.notes}&rdquo;
                      </p>
                    )}

                    {/* Cancel button */}
                    {canCancel(appointment) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-400"
                        onClick={() => setCancelId(appointment.id)}
                      >
                        <X className="mr-1.5 size-3.5" />
                        Cancelar agendamento
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Cancel Dialog */}
      <Dialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-red-500/10">
              <AlertTriangle className="size-6 text-red-400" />
            </div>
            <DialogTitle className="text-center">Cancelar agendamento?</DialogTitle>
            <DialogDescription className="text-center">
              Esta ação não pode ser desfeita. O horário ficará disponível para outros clientes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelling}
              className="w-full"
            >
              {cancelling && <Loader2 className="mr-2 size-4 animate-spin" />}
              Sim, cancelar
            </Button>
            <Button
              variant="outline"
              onClick={() => setCancelId(null)}
              disabled={cancelling}
              className="w-full"
            >
              Manter agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
