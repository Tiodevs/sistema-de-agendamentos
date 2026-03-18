'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  getProfessionalAppointments,
  updateProfessionalAppointmentStatus,
  type Appointment,
  type AppointmentStatus,
} from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Loader2,
  Filter,
  CheckCircle2,
  PlayCircle,
  Clock,
  Phone,
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; color: string; bg: string }> = {
  SCHEDULED: { label: 'Agendado', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  CONFIRMED: { label: 'Confirmado', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  IN_PROGRESS: { label: 'Em andamento', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  COMPLETED: { label: 'Concluído', color: 'text-green-400', bg: 'bg-green-500/20' },
  CANCELLED: { label: 'Cancelado', color: 'text-red-400', bg: 'bg-red-500/20' },
  NO_SHOW: { label: 'Não compareceu', color: 'text-gray-400', bg: 'bg-gray-500/20' },
};

// Próximas ações permitidas por status
const NEXT_ACTIONS: Partial<Record<AppointmentStatus, Array<{ status: AppointmentStatus; label: string; icon: React.ReactNode }>>> = {
  SCHEDULED: [
    { status: 'CONFIRMED', label: 'Confirmar', icon: <CheckCircle2 className="size-4" /> },
  ],
  CONFIRMED: [
    { status: 'IN_PROGRESS', label: 'Iniciar', icon: <PlayCircle className="size-4" /> },
  ],
  IN_PROGRESS: [
    { status: 'COMPLETED', label: 'Concluir', icon: <CheckCircle2 className="size-4" /> },
  ],
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function getTodayISO() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

export default function ProfessionalAgendaPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState(getTodayISO());
  const [dateTo, setDateTo] = useState('');
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [updating, setUpdating] = useState(false);

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const params: { from?: string; to?: string; status?: string } = {};
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter;

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

  async function handleStatusUpdate(appointmentId: string, newStatus: string) {
    try {
      setUpdating(true);
      await updateProfessionalAppointmentStatus(appointmentId, newStatus);
      toast.success('Status atualizado com sucesso');
      setSelectedApt(null);
      await loadAppointments();
    } catch {
      toast.error('Erro ao atualizar status');
    } finally {
      setUpdating(false);
    }
  }

  // Agrupar por data
  const groupedByDate: Record<string, Appointment[]> = {};
  for (const apt of appointments) {
    const dateKey = new Date(apt.date).toISOString().split('T')[0];
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(apt);
  }

  const sortedDates = Object.keys(groupedByDate).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Minha Agenda</h1>
        <p className="text-sm text-muted-foreground">
          Visualize e gerencie seus atendimentos
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Data início</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Data fim</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : sortedDates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CalendarDays className="mb-3 size-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">Nenhum agendamento encontrado</p>
            <p className="text-xs text-muted-foreground">Ajuste os filtros para ver mais resultados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateKey) => {
            const dayApts = groupedByDate[dateKey];
            const isToday = dateKey === getTodayISO();

            return (
              <div key={dateKey}>
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="text-sm font-semibold capitalize">
                    {formatDate(dayApts[0].date)}
                  </h3>
                  {isToday && (
                    <Badge variant="default" className="text-xs">Hoje</Badge>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {dayApts.length} atendimento{dayApts.length > 1 ? 's' : ''}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {dayApts.map((apt) => {
                    const config = STATUS_CONFIG[apt.status];
                    const actions = NEXT_ACTIONS[apt.status] || [];

                    return (
                      <Card
                        key={apt.id}
                        className="cursor-pointer transition-colors hover:bg-muted/30"
                        onClick={() => setSelectedApt(apt)}
                      >
                        <CardContent className="flex items-center gap-4 p-4">
                          {/* Horário */}
                          <div className="min-w-[60px] text-center">
                            <p className="text-base font-bold">{formatTime(apt.date)}</p>
                            <p className="text-xs text-muted-foreground">{formatTime(apt.endDate)}</p>
                          </div>

                          <div className="h-10 w-px bg-border" />

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium">{apt.client?.name}</p>
                            <p className="truncate text-sm text-muted-foreground">
                              {apt.product?.name} · {apt.product?.duration}min · {formatCurrency(apt.price)}
                            </p>
                          </div>

                          {/* Status + Actions */}
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn('text-xs', config.color)}>
                              {config.label}
                            </Badge>
                            {actions.map((action) => (
                              <Button
                                key={action.status}
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusUpdate(apt.id, action.status);
                                }}
                                disabled={updating}
                              >
                                {action.icon}
                                {action.label}
                              </Button>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog detalhes */}
      <Dialog open={!!selectedApt} onOpenChange={(open) => !open && setSelectedApt(null)}>
        <DialogContent className="max-w-md">
          {selectedApt && (() => {
            const config = STATUS_CONFIG[selectedApt.status];
            const actions = NEXT_ACTIONS[selectedApt.status] || [];
            return (
              <>
                <DialogHeader>
                  <DialogTitle>Detalhes do Atendimento</DialogTitle>
                  <DialogDescription>
                    {formatDate(selectedApt.date)} às {formatTime(selectedApt.date)}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Cliente */}
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Cliente</p>
                    <p className="font-medium">{selectedApt.client?.name}</p>
                    {selectedApt.client?.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="size-3" />
                        {selectedApt.client.phone}
                      </div>
                    )}
                    {selectedApt.client?.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="size-3" />
                        {selectedApt.client.email}
                      </div>
                    )}
                  </div>

                  {/* Serviço */}
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Serviço</p>
                    <p className="font-medium">{selectedApt.product?.name}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {selectedApt.product?.duration}min
                      </div>
                      <span>{formatCurrency(selectedApt.price)}</span>
                    </div>
                  </div>

                  {/* Horário */}
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase">Horário</p>
                      <p className="text-sm">
                        {formatTime(selectedApt.date)} — {formatTime(selectedApt.endDate)}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn('text-xs', config.color)}>
                      {config.label}
                    </Badge>
                  </div>

                  {/* Observações */}
                  {selectedApt.notes && (
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Observações</p>
                      <p className="text-sm">{selectedApt.notes}</p>
                    </div>
                  )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  {actions.map((action) => (
                    <Button
                      key={action.status}
                      onClick={() => handleStatusUpdate(selectedApt.id, action.status)}
                      disabled={updating}
                      className="gap-2"
                    >
                      {updating ? <Loader2 className="size-4 animate-spin" /> : action.icon}
                      {action.label}
                    </Button>
                  ))}
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
