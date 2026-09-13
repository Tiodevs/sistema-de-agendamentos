'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getProfessionalAppointments,
  updateProfessionalAppointmentStatus,
  type Appointment,
  type AppointmentStatus,
} from '@/lib/api';
import { formatCurrency, formatDateShort } from '@/lib/format';
import { STATUS_CONFIG, STATUS_OPTIONS } from '@/lib/appointment-status';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/user-avatar';
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
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Phone,
  PlayCircle,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaggerIn } from '@/components/motion/stagger-in';

const NEXT_ACTIONS: Partial<
  Record<AppointmentStatus, Array<{ status: AppointmentStatus; label: string; icon: LucideIcon }>>
> = {
  SCHEDULED: [{ status: 'CONFIRMED', label: 'Confirmar', icon: CheckCircle2 }],
  CONFIRMED: [{ status: 'IN_PROGRESS', label: 'Iniciar', icon: PlayCircle }],
  IN_PROGRESS: [{ status: 'COMPLETED', label: 'Concluir', icon: CheckCircle2 }],
};

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function formatDayMonth(isoString: string) {
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

function formatDayHeading(isoString: string) {
  const formatted = new Date(isoString).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Sao_Paulo',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function todayDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateKeyFromIso(isoString: string) {
  return new Date(isoString).toLocaleDateString('en-CA', {
    timeZone: 'America/Sao_Paulo',
  });
}

export default function ProfessionalAgendaPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState(todayDateKey);
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [updating, setUpdating] = useState(false);

  const loadAppointments = useCallback(async () => {
    try {
      const params: { from?: string; to?: string; status?: string } = {};
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const res = await getProfessionalAppointments(params);
      if (res.data?.appointments) {
        setAppointments(res.data.appointments);
      }
    } catch {
      toast.error('Erro ao carregar agendamentos');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, statusFilter]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  async function handleStatusUpdate(appointmentId: string, newStatus: AppointmentStatus) {
    try {
      setUpdating(true);
      await updateProfessionalAppointmentStatus(appointmentId, newStatus);
      toast.success(`Status atualizado para "${STATUS_CONFIG[newStatus].label}"`);
      setSelectedApt(null);
      await loadAppointments();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Erro ao atualizar status');
    } finally {
      setUpdating(false);
    }
  }

  const displayedAppointments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return appointments;
    return appointments.filter(
      (appointment) =>
        appointment.client?.name.toLowerCase().includes(query) ||
        appointment.product?.name.toLowerCase().includes(query),
    );
  }, [appointments, search]);

  const groupedByDate = useMemo(() => {
    const groups: Array<{ dateKey: string; items: Appointment[] }> = [];
    const indexByKey = new Map<string, number>();

    for (const appointment of displayedAppointments) {
      const dateKey = dateKeyFromIso(appointment.date);
      const existing = indexByKey.get(dateKey);
      if (existing === undefined) {
        indexByKey.set(dateKey, groups.length);
        groups.push({ dateKey, items: [appointment] });
      } else {
        groups[existing].items.push(appointment);
      }
    }

    return groups;
  }, [displayedAppointments]);

  const todayKey = todayDateKey();
  const selectedActions = selectedApt ? (NEXT_ACTIONS[selectedApt.status] ?? []) : [];

  if (loading) return null;

  return (
    <StaggerIn selector="[data-motion='enter']" className="space-y-5">
      <div data-motion="enter">
        <AdminPageHeader
          title="Minha agenda"
          description="Acompanhe e atualize os seus atendimentos."
        />
      </div>

      <section data-motion="enter" className="admin-surface p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente ou serviço..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="rounded-full pl-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:max-w-sm lg:w-[22rem]">
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                aria-label="Data início"
                className="rounded-full"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                aria-label="Data fim"
                className="rounded-full"
              />
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto text-sm">
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

      {groupedByDate.length === 0 ? (
        <section
          data-motion="enter"
          className="admin-surface flex flex-col items-center justify-center px-6 py-16"
        >
          <CalendarDays className="mb-4 size-12 text-muted-foreground/40" />
          <h2 className="text-lg font-semibold">Nenhum agendamento encontrado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || statusFilter !== 'ALL' || dateFrom || dateTo
              ? 'Tente alterar os filtros.'
              : 'Seus próximos atendimentos vão aparecer aqui.'}
          </p>
        </section>
      ) : (
        <section data-motion="enter" className="admin-surface overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-sm font-medium">
              {displayedAppointments.length}{' '}
              {displayedAppointments.length === 1 ? 'agendamento' : 'agendamentos'}
            </p>
          </div>
          <StaggerIn
            replayKey={`${statusFilter}-${dateFrom}-${dateTo}-${search}`}
            selector="[data-row]"
            className="divide-y divide-border"
          >
            {groupedByDate.map((group) => (
              <div key={group.dateKey} className="divide-y divide-border">
                <div className="flex items-center gap-2 bg-[var(--admin-card-muted)]/60 px-5 py-2.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {formatDayHeading(group.items[0].date)}
                  </p>
                  {group.dateKey === todayKey ? (
                    <span className="rounded-full bg-[var(--admin-chip)] px-2 py-0.5 text-[11px] font-medium">
                      Hoje
                    </span>
                  ) : null}
                </div>
                {group.items.map((appointment) => {
                  const actions = NEXT_ACTIONS[appointment.status] ?? [];
                  return (
                    <div
                      key={appointment.id}
                      data-row
                      data-motion="lift"
                      className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedApt(appointment)}
                        className="flex min-w-0 flex-1 items-start gap-3 text-left sm:items-center"
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
                          name={appointment.client?.name || ''}
                          src={appointment.client?.avatarUrl}
                          className="hidden size-10 shrink-0 sm:flex"
                          fallbackClassName="bg-[var(--admin-card-muted)] text-xs"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{appointment.client?.name}</p>
                            <StatusBadge status={appointment.status} />
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {appointment.product?.name}
                          </p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            <span className="tabular-nums">
                              {formatTime(appointment.date)} – {formatTime(appointment.endDate)}
                            </span>
                            <span className="mx-1.5">·</span>
                            <span className="font-medium text-foreground">
                              {formatCurrency(appointment.price)}
                            </span>
                          </p>
                        </div>
                      </button>
                      {actions.length > 0 ? (
                        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">
                          {actions.map((action) => {
                            const Icon = action.icon;
                            return (
                              <Button
                                key={action.status}
                                size="sm"
                                variant="outline"
                                className="rounded-full"
                                disabled={updating}
                                onClick={() => handleStatusUpdate(appointment.id, action.status)}
                              >
                                <Icon className="size-4" />
                                {action.label}
                              </Button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </StaggerIn>
        </section>
      )}

      <Dialog open={!!selectedApt} onOpenChange={(open) => !open && setSelectedApt(null)}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          {selectedApt ? (
            <>
              <DialogHeader>
                <DialogTitle>Detalhes do atendimento</DialogTitle>
                <DialogDescription>
                  {formatDateShort(selectedApt.date)} às {formatTime(selectedApt.date)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="rounded-[1.35rem] bg-[var(--admin-card-muted)] p-4">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Cliente
                  </p>
                  <p className="mt-1 font-medium">{selectedApt.client?.name}</p>
                  {selectedApt.client?.phone ? (
                    <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="size-3.5" />
                      {selectedApt.client.phone}
                    </p>
                  ) : null}
                  {selectedApt.client?.email ? (
                    <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="size-3.5" />
                      {selectedApt.client.email}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-[1.35rem] bg-[var(--admin-card-muted)] p-4">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Serviço
                  </p>
                  <p className="mt-1 font-medium">{selectedApt.product?.name}</p>
                  <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {selectedApt.product?.duration}min
                    </span>
                    <span className="font-medium text-foreground">
                      {formatCurrency(selectedApt.price)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-[1.35rem] bg-[var(--admin-card-muted)] p-4">
                  <div>
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      Horário
                    </p>
                    <p className="mt-1 text-sm tabular-nums">
                      {formatTime(selectedApt.date)} — {formatTime(selectedApt.endDate)}
                    </p>
                  </div>
                  <StatusBadge status={selectedApt.status} />
                </div>

                {selectedApt.notes ? (
                  <div className="rounded-[1.35rem] bg-[var(--admin-card-muted)] p-4">
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      Observações
                    </p>
                    <p className="mt-1 text-sm">{selectedApt.notes}</p>
                  </div>
                ) : null}
              </div>

              {selectedActions.length > 0 ? (
                <DialogFooter className="gap-2 sm:gap-0">
                  {selectedActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Button
                        key={action.status}
                        className="rounded-full"
                        onClick={() => handleStatusUpdate(selectedApt.id, action.status)}
                        disabled={updating}
                      >
                        {updating ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Icon className="size-4" />
                        )}
                        {action.label}
                      </Button>
                    );
                  })}
                </DialogFooter>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </StaggerIn>
  );
}
