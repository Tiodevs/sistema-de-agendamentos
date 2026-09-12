'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getAppointments,
  updateAppointmentStatus,
  deleteAppointment,
  type Appointment,
  type AppointmentStatus,
} from '@/lib/api';
import { formatCurrency, formatDate, getInitials } from '@/lib/format';
import { STATUS_CONFIG, STATUS_OPTIONS } from '@/lib/appointment-status';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
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
        title="Agendamentos"
        description="Acompanhe e atualize os horários da agenda."
        action={
          <Button onClick={() => router.push('/admin/appointments/new')} className="rounded-full">
            <Plus className="size-4" />
            Novo Agendamento
          </Button>
        }
      />

      <section className="admin-surface p-4 sm:p-5">
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

      {filteredAppointments.length === 0 ? (
        <section className="admin-surface flex flex-col items-center justify-center px-6 py-16">
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
        <section className="admin-surface overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-sm font-medium">
              {filteredAppointments.length}{' '}
              {filteredAppointments.length === 1 ? 'agendamento' : 'agendamentos'}
            </p>
          </div>
          <div className="divide-y divide-border">
            {filteredAppointments.map((appointment) => (
              <div key={appointment.id} className="flex items-center gap-3 px-5 py-4">
                <div className="hidden size-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-[var(--admin-card-muted)] sm:flex">
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(appointment.date).split(' ')[0]}
                  </span>
                  <span className="text-sm font-semibold">{formatTime(appointment.date)}</span>
                </div>
                <Avatar className="size-10 shrink-0">
                  <AvatarFallback className="bg-[var(--admin-card-muted)] text-xs">
                    {getInitials(appointment.client.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{appointment.client.name}</p>
                    <StatusBadge status={appointment.status} />
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {appointment.product.name} · {appointment.employee.name}
                    <span className="sm:hidden">
                      {' '}
                      · {formatTime(appointment.date)}–{formatTime(appointment.endDate)}
                    </span>
                  </p>
                </div>
                <p className="hidden shrink-0 font-semibold sm:block">
                  {formatCurrency(appointment.price)}
                </p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-9 rounded-2xl">
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
          </div>
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
    </div>
  );
}
