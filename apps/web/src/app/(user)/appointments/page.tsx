'use client';

import { useEffect, useState, useCallback } from 'react';
import { getMyAppointments, cancelMyAppointment, type Appointment } from '@/lib/api';
import { formatCurrency, formatDate, getInitials } from '@/lib/format';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { CalendarDays, CalendarPlus, Loader2, Search, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function isUpcoming(appointment: Appointment, now: Date) {
  return (
    new Date(appointment.date) >= now &&
    !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status)
  );
}

export default function MyAppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [search, setSearch] = useState('');

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
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    if (query) setSearch(query);
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
  const upcoming = appointments.filter((appointment) => isUpcoming(appointment, now));
  const past = appointments.filter((appointment) => !isUpcoming(appointment, now));
  const tabAppointments = activeTab === 'upcoming' ? upcoming : past;

  const displayedAppointments = tabAppointments.filter((appointment) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      appointment.product.name.toLowerCase().includes(query) ||
      appointment.employee.name.toLowerCase().includes(query)
    );
  });

  const cancellingAppointment = appointments.find((appointment) => appointment.id === cancelId);

  function canCancel(appointment: Appointment): boolean {
    return (
      ['SCHEDULED', 'CONFIRMED'].includes(appointment.status) && new Date(appointment.date) > now
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Meus agendamentos"
        description={`${upcoming.length} ${upcoming.length === 1 ? 'horário próximo' : 'horários próximos'}.`}
        action={
          <Button onClick={() => router.push('/book')} className="rounded-full">
            <CalendarPlus className="size-4" />
            Agendar
          </Button>
        }
      />

      <section className="admin-surface p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por serviço ou profissional..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="rounded-full pl-10"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto text-sm">
            <button
              type="button"
              onClick={() => setActiveTab('upcoming')}
              className={cn(
                'rounded-full px-3 py-1.5 font-medium whitespace-nowrap transition-colors',
                activeTab === 'upcoming'
                  ? 'bg-[var(--admin-card-muted)] text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Próximos ({upcoming.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('past')}
              className={cn(
                'rounded-full px-3 py-1.5 font-medium whitespace-nowrap transition-colors',
                activeTab === 'past'
                  ? 'bg-[var(--admin-card-muted)] text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Histórico ({past.length})
            </button>
          </div>
        </div>
      </section>

      {displayedAppointments.length === 0 ? (
        <section className="admin-surface flex flex-col items-center justify-center px-6 py-16">
          <CalendarDays className="mb-4 size-12 text-muted-foreground/40" />
          <h2 className="text-lg font-semibold">
            {activeTab === 'upcoming'
              ? 'Nenhum agendamento próximo'
              : 'Nenhum agendamento no histórico'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {search
              ? 'Tente alterar a busca.'
              : activeTab === 'upcoming'
                ? 'Reserve um horário para aparecer aqui.'
                : 'Seus horários anteriores vão aparecer nesta lista.'}
          </p>
          {activeTab === 'upcoming' && !search ? (
            <Button onClick={() => router.push('/book')} className="mt-5 rounded-full">
              <CalendarPlus className="size-4" />
              Fazer um agendamento
            </Button>
          ) : null}
        </section>
      ) : (
        <section className="admin-surface overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-sm font-medium">
              {displayedAppointments.length}{' '}
              {displayedAppointments.length === 1 ? 'agendamento' : 'agendamentos'}
            </p>
          </div>
          <div className="divide-y divide-border">
            {displayedAppointments.map((appointment) => (
              <div key={appointment.id} className="flex items-center gap-3 px-5 py-4">
                <div className="hidden size-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-[var(--admin-card-muted)] sm:flex">
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(appointment.date).split(' ')[0]}
                  </span>
                  <span className="text-sm font-semibold">{formatTime(appointment.date)}</span>
                </div>
                <Avatar className="size-10 shrink-0">
                  <AvatarFallback className="bg-[var(--admin-card-muted)] text-xs">
                    {getInitials(appointment.employee.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{appointment.product.name}</p>
                    <StatusBadge status={appointment.status} />
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {appointment.employee.name}
                    <span className="sm:hidden">
                      {' '}
                      · {formatTime(appointment.date)}–{formatTime(appointment.endDate)}
                    </span>
                    {appointment.notes ? ` · ${appointment.notes}` : ''}
                  </p>
                </div>
                <p className="hidden shrink-0 font-semibold sm:block">
                  {formatCurrency(appointment.price)}
                </p>
                {canCancel(appointment) ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setCancelId(appointment.id)}
                  >
                    Cancelar
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <DialogContent className="rounded-3xl sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-5 text-destructive" />
              </div>
              <div>
                <DialogTitle>Cancelar agendamento</DialogTitle>
                <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja cancelar{' '}
            <strong className="text-foreground">{cancellingAppointment?.product.name}</strong>
            {cancellingAppointment ? (
              <>
                {' '}
                em{' '}
                <strong className="text-foreground">
                  {formatDate(cancellingAppointment.date)}
                </strong>
              </>
            ) : null}
            ? O horário ficará disponível para outros clientes.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setCancelId(null)}
              disabled={cancelling}
            >
              Manter
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? <Loader2 className="size-4 animate-spin" /> : null}
              Cancelar horário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
