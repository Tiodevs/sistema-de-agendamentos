'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getAppointments,
  updateAppointmentStatus,
  deleteAppointment,
  type Appointment,
  type AppointmentStatus,
} from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Search,
  MoreHorizontal,
  Loader2,
  CalendarDays,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

const STATUS_MAP: Record<AppointmentStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  SCHEDULED: { label: 'Agendado', variant: 'outline' },
  CONFIRMED: { label: 'Confirmado', variant: 'default' },
  IN_PROGRESS: { label: 'Em andamento', variant: 'default' },
  COMPLETED: { label: 'Concluído', variant: 'secondary' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
  NO_SHOW: { label: 'Não compareceu', variant: 'destructive' },
};

const STATUS_OPTIONS: AppointmentStatus[] = [
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

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

  // Delete dialog
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
    fetchAppointments();
  }, [fetchAppointments]);

  const filteredAppointments = appointments.filter((a) =>
    a.client.name.toLowerCase().includes(search.toLowerCase()) ||
    a.product.name.toLowerCase().includes(search.toLowerCase()) ||
    a.employee.name.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleStatusChange(id: string, status: AppointmentStatus) {
    try {
      await updateAppointmentStatus(id, status);
      toast.success(`Status atualizado para "${STATUS_MAP[status].label}"`);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agendamentos</h1>
          <p className="text-muted-foreground">
            Gerencie todos os agendamentos do sistema.
          </p>
        </div>
        <Button onClick={() => router.push('/admin/appointments/new')}>
          <Plus className="mr-2 size-4" />
          Novo Agendamento
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, produto ou profissional..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os status</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_MAP[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {filteredAppointments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarDays className="mb-4 size-12 text-muted-foreground/50" />
            <CardTitle className="mb-1 text-lg">Nenhum agendamento encontrado</CardTitle>
            <CardDescription>
              {search || statusFilter !== 'ALL'
                ? 'Tente alterar os filtros.'
                : 'Crie seu primeiro agendamento.'}
            </CardDescription>
            {!search && statusFilter === 'ALL' && (
              <Button onClick={() => router.push('/admin/appointments/new')} className="mt-4">
                <Plus className="mr-2 size-4" />
                Novo Agendamento
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filteredAppointments.length}{' '}
              {filteredAppointments.length === 1 ? 'agendamento' : 'agendamentos'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data / Horário</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Produto</TableHead>
                  <TableHead className="hidden sm:table-cell">Profissional</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">
                          {formatDate(appointment.date).split(' ')[0]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(appointment.date)} – {formatTime(appointment.endDate)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{appointment.client.name}</p>
                        <p className="text-xs text-muted-foreground hidden md:block">
                          {appointment.client.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm">{appointment.product.name}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-sm">{appointment.employee.name}</span>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatCurrency(appointment.price)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_MAP[appointment.status].variant}>
                        {STATUS_MAP[appointment.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {STATUS_OPTIONS.filter((s) => s !== appointment.status).map((s) => (
                            <DropdownMenuItem
                              key={s}
                              onClick={() => handleStatusChange(appointment.id, s)}
                            >
                              Marcar como {STATUS_MAP[s].label}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              setDeletingAppointment(appointment);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-5 text-destructive" />
              </div>
              <div>
                <DialogTitle>Excluir agendamento</DialogTitle>
                <DialogDescription>
                  Esta ação não pode ser desfeita.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir o agendamento de{' '}
            <strong className="text-foreground">
              {deletingAppointment?.client.name}
            </strong>{' '}
            em{' '}
            <strong className="text-foreground">
              {deletingAppointment ? formatDate(deletingAppointment.date) : ''}
            </strong>
            ?
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteLoading}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
