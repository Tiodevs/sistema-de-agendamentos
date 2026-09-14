'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getAppointments,
  updateAppointmentStatus,
  deleteAppointment,
  type Appointment,
  type AppointmentStatus,
} from '@/lib/api';
import { formatCurrency, formatDate, formatShortName } from '@/lib/format';
import { STATUS_CONFIG, STATUS_OPTIONS } from '@/lib/appointment-status';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserAvatar } from '@/components/user-avatar';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import {
  Plus,
  Search,
  MoreHorizontal,
  Loader2,
  CalendarDays,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaggerIn } from '@/components/motion/stagger-in';

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

export default function AppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAppointment, setDeletingAppointment] = useState<Appointment | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchAppointments = useCallback(async () => {
    try {
      const filters: { status?: string } = {};
      if (statusFilter !== 'ALL') filters.status = statusFilter;
      const res = await getAppointments(filters);
      if (res.data?.appointments) setAppointments(res.data.appointments);
    } catch {
      toast.error('Erro ao carregar agendamentos');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    if (query) setSearch(query);
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const filteredAppointments = appointments.filter(
    (appointment) =>
      appointment.client.name.toLowerCase().includes(search.toLowerCase()) ||
      appointment.product.name.toLowerCase().includes(search.toLowerCase()) ||
      appointment.employee.name.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleStatusChange(id: string, status: AppointmentStatus) {
    try {
      await updateAppointmentStatus(id, status);
      toast.success(`Status atualizado para "${STATUS_CONFIG[status].label}"`);
      await fetchAppointments();
    } catch {
      toast.error('Erro ao atualizar status');
    }
  }

  async function handleDelete() {
    if (!deletingAppointment) return;
    setDeleteLoading(true);
    try {
      await deleteAppointment(deletingAppointment.id);
      toast.success('Agendamento excluído com sucesso!');
      setDeleteDialogOpen(false);
      await fetchAppointments();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Erro ao excluir agendamento');
    } finally {
      setDeleteLoading(false);
    }
  }

  if (loading) return null;

  return (
    <StaggerIn selector="[data-motion='enter']" className="space-y-5">
      <div data-motion="enter">
        <AdminPageHeader
          title="Agendamentos"
          description="Acompanhe e atualize os horários da agenda."
          action={
            <Button onClick={() => router.push('/admin/appointments/new')} className="rounded-full">
              <Plus className="size-4" />
              Novo Agendamento
            </Button>
          }
        />
      </div>

      <section data-motion="enter" className="admin-surface p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, serviço ou profissional..."
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
          <h2 className="text-lg font-semibold">Nenhum agendamento encontrado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || statusFilter !== 'ALL'
              ? 'Tente alterar os filtros.'
              : 'Crie o primeiro agendamento da agenda.'}
          </p>
          {!search && statusFilter === 'ALL' ? (
            <Button
              onClick={() => router.push('/admin/appointments/new')}
              className="mt-5 rounded-full"
            >
              <Plus className="size-4" />
              Novo Agendamento
            </Button>
          ) : null}
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
                <UserAvatar
                  name={appointment.client.name}
                  src={appointment.client.avatarUrl}
                  className="hidden size-10 shrink-0 md:flex"
                  fallbackClassName="bg-[var(--admin-card-muted)] text-xs"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                    <Link
                      href={`/admin/clients/${appointment.client.id}`}
                      className="min-w-0 truncate font-medium hover:underline"
                      title={appointment.client.name}
                    >
                      {formatShortName(appointment.client.name)}
                    </Link>
                    <StatusBadge status={appointment.status} />
                  </div>
                  <p
                    className="mt-1 truncate text-sm text-muted-foreground"
                    title={appointment.product.name}
                  >
                    {appointment.product.name}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground">
                    <span className="truncate" title={appointment.employee.name}>
                      {formatShortName(appointment.employee.name)}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="whitespace-nowrap tabular-nums">
                      {formatTime(appointment.date)} – {formatTime(appointment.endDate)}
                    </span>
                    <span className="sm:hidden" aria-hidden>
                      ·
                    </span>
                    <span className="whitespace-nowrap font-medium text-foreground sm:hidden">
                      {formatCurrency(appointment.price)}
                    </span>
                  </p>
                </div>
                <p className="hidden shrink-0 font-semibold tabular-nums sm:block">
                  {formatCurrency(appointment.price)}
                </p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-9 shrink-0 rounded-2xl">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-2xl">
                    {STATUS_OPTIONS.filter((status) => status !== appointment.status).map(
                      (status) => (
                        <DropdownMenuItem
                          key={status}
                          onClick={() => handleStatusChange(appointment.id, status)}
                        >
                          Marcar como {STATUS_CONFIG[status].label}
                        </DropdownMenuItem>
                      ),
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => {
                        setDeletingAppointment(appointment);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="size-4" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </StaggerIn>
        </section>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-5 text-destructive" />
              </div>
              <div>
                <DialogTitle>Excluir agendamento</DialogTitle>
                <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir o agendamento de{' '}
            <strong className="text-foreground">{deletingAppointment?.client.name}</strong> em{' '}
            <strong className="text-foreground">
              {deletingAppointment ? formatDate(deletingAppointment.date) : ''}
            </strong>
            ?
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteLoading}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? <Loader2 className="size-4 animate-spin" /> : null}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaggerIn>
  );
}
