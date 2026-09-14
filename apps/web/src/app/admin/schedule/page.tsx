'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getBusinessHours,
  updateAllBusinessHours,
  getSpecialDays,
  createSpecialDay,
  deleteSpecialDay,
  type BusinessHour,
  type BusinessHourPayload,
  type SpecialDay,
} from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Clock,
  Loader2,
  Save,
  CalendarOff,
  Plus,
  Trash2,
  AlertTriangle,
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  PartyPopper,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ScheduleHoursEditor } from '@/components/admin/schedule-hours-editor';
import { ProfessionalSchedulePanel } from '@/components/admin/professional-schedule-panel';
import { StaggerIn } from '@/components/motion/stagger-in';

function formatDateBR(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function SchedulePage() {
  const [activeTab, setActiveTab] = useState<'hours' | 'special' | 'professionals'>('hours');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Business Hours
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [editHours, setEditHours] = useState<BusinessHourPayload[]>([]);

  // Special Days
  const [specialDays, setSpecialDays] = useState<SpecialDay[]>([]);
  const [showNewDay, setShowNewDay] = useState(false);
  const [newDay, setNewDay] = useState({
    date: '',
    title: '',
    description: '',
    isClosed: true,
    openTime: '08:00',
    closeTime: '18:00',
  });
  const [creatingDay, setCreatingDay] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [hoursRes, daysRes] = await Promise.all([getBusinessHours(), getSpecialDays()]);
      if (hoursRes.data?.hours) {
        setHours(hoursRes.data.hours);
        setEditHours(
          hoursRes.data.hours.map((h) => ({
            dayOfWeek: h.dayOfWeek,
            openTime: h.openTime,
            closeTime: h.closeTime,
            isClosed: h.isClosed,
          })),
        );
      }
      if (daysRes.data?.days) {
        setSpecialDays(daysRes.data.days);
      }
    } catch {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function updateHour(index: number, field: keyof BusinessHourPayload, value: string | boolean) {
    setEditHours((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  async function handleSaveHours() {
    setSaving(true);
    try {
      const res = await updateAllBusinessHours(editHours);
      if (res.data?.hours) {
        setHours(res.data.hours);
        toast.success('Horários salvos com sucesso!');
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Erro ao salvar horários');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateDay() {
    if (!newDay.date || !newDay.title) {
      toast.error('Preencha a data e o título');
      return;
    }
    setCreatingDay(true);
    try {
      await createSpecialDay({
        date: newDay.date,
        title: newDay.title,
        description: newDay.description || undefined,
        isClosed: newDay.isClosed,
        openTime: newDay.isClosed ? null : newDay.openTime,
        closeTime: newDay.isClosed ? null : newDay.closeTime,
      });
      toast.success('Dia especial criado com sucesso!');
      setShowNewDay(false);
      setNewDay({
        date: '',
        title: '',
        description: '',
        isClosed: true,
        openTime: '08:00',
        closeTime: '18:00',
      });
      loadData();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Erro ao criar dia especial');
    } finally {
      setCreatingDay(false);
    }
  }

  async function handleDeleteDay() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteSpecialDay(deleteId);
      toast.success('Dia especial excluído');
      setDeleteId(null);
      loadData();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Erro ao excluir');
    } finally {
      setDeleting(false);
    }
  }

  const hasChanges =
    JSON.stringify(editHours) !==
    JSON.stringify(
      hours.map((h) => ({
        dayOfWeek: h.dayOfWeek,
        openTime: h.openTime,
        closeTime: h.closeTime,
        isClosed: h.isClosed,
      })),
    );

  if (loading) return null;

  const upcomingDays = specialDays.filter(
    (d) => new Date(d.date) >= new Date(new Date().toISOString().split('T')[0]),
  );
  const pastDays = specialDays.filter(
    (d) => new Date(d.date) < new Date(new Date().toISOString().split('T')[0]),
  );

  return (
    <StaggerIn selector="[data-motion='enter']" className="space-y-5">
      <div data-motion="enter">
        <AdminPageHeader
          title="Horários e feriados"
          description="Expediente do estabelecimento, dias especiais e agenda por profissional."
        />
      </div>

      <div data-motion="enter" className="admin-surface flex min-w-0 gap-1 p-1.5">
        <button
          onClick={() => setActiveTab('hours')}
          className={cn(
            'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2.5 text-xs font-medium transition-colors sm:gap-2 sm:px-4 sm:text-sm',
            activeTab === 'hours'
              ? 'bg-[var(--admin-card-muted)] text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Clock className="size-3.5 shrink-0 sm:size-4" />
          <span className="truncate">Funcionamento</span>
        </button>
        <button
          onClick={() => setActiveTab('special')}
          className={cn(
            'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2.5 text-xs font-medium transition-colors sm:gap-2 sm:px-4 sm:text-sm',
            activeTab === 'special'
              ? 'bg-[var(--admin-card-muted)] text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <PartyPopper className="size-3.5 shrink-0 sm:size-4" />
          <span className="truncate">Dias especiais</span>
          {specialDays.length > 0 && (
            <Badge variant="secondary" className="rounded-full px-1.5 text-[10px] sm:text-xs">
              {specialDays.length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab('professionals')}
          className={cn(
            'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2.5 text-xs font-medium transition-colors sm:gap-2 sm:px-4 sm:text-sm',
            activeTab === 'professionals'
              ? 'bg-[var(--admin-card-muted)] text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Users className="size-3.5 shrink-0 sm:size-4" />
          <span className="truncate">Por profissional</span>
        </button>
      </div>

      {/* ─── Business Hours Tab ─── */}
      {activeTab === 'hours' && (
        <Card data-motion="enter" className="overflow-hidden">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="flex min-w-0 items-center gap-2 text-base sm:text-lg">
              <Clock className="size-5 shrink-0" />
              <span className="leading-snug">Horários de Funcionamento</span>
            </CardTitle>
            <CardDescription>
              Defina o horário de abertura e fechamento para cada dia da semana. Os clientes só
              poderão agendar dentro desses horários.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 space-y-1 px-4 sm:px-6">
            <ScheduleHoursEditor hours={editHours} onChange={updateHour} />

            <Separator className="my-4" />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div
                role="status"
                className={cn(
                  'inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium',
                  hasChanges
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-emerald-500/10 text-emerald-500',
                )}
              >
                {hasChanges ? (
                  <AlertCircle className="size-4 shrink-0" aria-hidden />
                ) : (
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                )}
                <span>{hasChanges ? 'Alterações pendentes' : 'Horários salvos'}</span>
              </div>
              <Button
                onClick={handleSaveHours}
                disabled={!hasChanges || saving}
                className="w-full rounded-full sm:w-auto"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Salvar Horários
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Special Days Tab ─── */}
      {activeTab === 'special' && (
        <StaggerIn replayKey="special" selector="[data-motion='enter']" className="space-y-4">
          <div
            data-motion="enter"
            className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Feriados e Dias Especiais</h2>
              <p className="text-sm text-muted-foreground">
                Cadastre feriados nacionais, recesso, ou dias com horário diferenciado.
              </p>
            </div>
            <Button onClick={() => setShowNewDay(true)} className="w-full rounded-full sm:w-auto">
              <Plus className="size-4" />
              Novo Dia
            </Button>
          </div>

          {/* Upcoming special days */}
          {upcomingDays.length > 0 && (
            <Card data-motion="enter">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Próximos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {upcomingDays.map((day) => (
                  <div
                    key={day.id}
                    data-motion="lift"
                    className={cn(
                      'flex min-w-0 flex-col gap-3 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4',
                      day.isClosed
                        ? 'border-red-500/20 bg-red-500/5'
                        : 'border-yellow-500/20 bg-yellow-500/5',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-card-muted)]">
                        {day.isClosed ? (
                          <CalendarOff className="size-5 text-red-400" />
                        ) : (
                          <CalendarDays className="size-5 text-yellow-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{day.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {formatDateBR(day.date.split('T')[0])}
                        </p>
                        {day.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground italic">
                            {day.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      {day.isClosed ? (
                        <Badge variant="outline" className="text-red-400 border-red-500/30">
                          Fechado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-400 border-yellow-500/30">
                          {day.openTime} – {day.closeTime}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-red-400 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => setDeleteId(day.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Past special days */}
          {pastDays.length > 0 && (
            <Card data-motion="enter">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-muted-foreground">Passados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pastDays.map((day) => (
                  <div
                    key={day.id}
                    data-motion="lift"
                    className="flex min-w-0 items-center gap-3 rounded-lg border border-dashed px-3 py-3 opacity-60 sm:gap-4 sm:px-4"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <CalendarOff className="size-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{day.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {formatDateBR(day.date.split('T')[0])}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                      onClick={() => setDeleteId(day.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {specialDays.length === 0 && (
            <div
              data-motion="enter"
              className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16"
            >
              <PartyPopper className="mb-3 size-12 text-muted-foreground/30" />
              <p className="mb-1 text-sm font-medium text-muted-foreground">
                Nenhum dia especial cadastrado
              </p>
              <p className="text-xs text-muted-foreground">
                Clique em &quot;Novo Dia&quot; para adicionar feriados ou dias com horário
                diferenciado.
              </p>
            </div>
          )}
        </StaggerIn>
      )}

      {activeTab === 'professionals' ? <ProfessionalSchedulePanel /> : null}

      {/* ─── New Special Day Dialog ─── */}
      <Dialog open={showNewDay} onOpenChange={setShowNewDay}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Dia Especial</DialogTitle>
            <DialogDescription>
              Cadastre um feriado ou dia com horário diferenciado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="special-date">Data</Label>
                <Input
                  id="special-date"
                  type="date"
                  value={newDay.date}
                  onChange={(e) => setNewDay({ ...newDay, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="special-title">Título</Label>
                <Input
                  id="special-title"
                  placeholder="Ex: Natal"
                  value={newDay.title}
                  onChange={(e) => setNewDay({ ...newDay, title: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="special-desc">Descrição (opcional)</Label>
              <Textarea
                id="special-desc"
                placeholder="Informações adicionais..."
                value={newDay.description}
                onChange={(e) => setNewDay({ ...newDay, description: e.target.value })}
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3 sm:px-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Estabelecimento fechado</p>
                <p className="text-xs text-muted-foreground">
                  {newDay.isClosed
                    ? 'Nenhum agendamento será aceito neste dia'
                    : 'O estabelecimento abre com horário especial'}
                </p>
              </div>
              <Switch
                className="shrink-0"
                checked={newDay.isClosed}
                onCheckedChange={(checked) => setNewDay({ ...newDay, isClosed: checked })}
              />
            </div>

            {!newDay.isClosed && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Abertura</Label>
                  <Input
                    type="time"
                    value={newDay.openTime}
                    onChange={(e) => setNewDay({ ...newDay, openTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fechamento</Label>
                  <Input
                    type="time"
                    value={newDay.closeTime}
                    onChange={(e) => setNewDay({ ...newDay, closeTime: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDay(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateDay} disabled={creatingDay}>
              {creatingDay && <Loader2 className="mr-2 size-4 animate-spin" />}
              Criar Dia Especial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirm Dialog ─── */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-red-500/10">
              <AlertTriangle className="size-6 text-red-400" />
            </div>
            <DialogTitle className="text-center">Excluir dia especial?</DialogTitle>
            <DialogDescription className="text-center">
              O dia será removido e os horários normais de funcionamento serão usados nessa data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              onClick={handleDeleteDay}
              disabled={deleting}
              className="w-full"
            >
              {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Sim, excluir
            </Button>
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              disabled={deleting}
              className="w-full"
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaggerIn>
  );
}
