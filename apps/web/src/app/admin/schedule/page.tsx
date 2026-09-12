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
  CalendarDays,
  PartyPopper,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

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
  const [activeTab, setActiveTab] = useState<'hours' | 'special'>('hours');
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

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const upcomingDays = specialDays.filter(
    (d) => new Date(d.date) >= new Date(new Date().toISOString().split('T')[0]),
  );
  const pastDays = specialDays.filter(
    (d) => new Date(d.date) < new Date(new Date().toISOString().split('T')[0]),
  );

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Horários e feriados"
        description="Expediente da semana e dias com regra especial."
      />

      <div className="admin-surface flex gap-1 p-1.5">
        <button
          onClick={() => setActiveTab('hours')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'hours'
              ? 'bg-[var(--admin-card-muted)] text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Clock className="size-4" />
          Funcionamento
        </button>
        <button
          onClick={() => setActiveTab('special')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'special'
              ? 'bg-[var(--admin-card-muted)] text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <PartyPopper className="size-4" />
          Dias especiais
          {specialDays.length > 0 && (
            <Badge variant="secondary" className="rounded-full text-xs">
              {specialDays.length}
            </Badge>
          )}
        </button>
      </div>

      {/* ─── Business Hours Tab ─── */}
      {activeTab === 'hours' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-5" />
              Horários de Funcionamento
            </CardTitle>
            <CardDescription>
              Defina o horário de abertura e fechamento para cada dia da semana. Os clientes só
              poderão agendar dentro desses horários.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {editHours.map((hour, i) => {
              const dayNames = [
                'Domingo',
                'Segunda-feira',
                'Terça-feira',
                'Quarta-feira',
                'Quinta-feira',
                'Sexta-feira',
                'Sábado',
              ];
              const dayAbbr = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
              return (
                <div
                  key={hour.dayOfWeek}
                  className={cn(
                    'flex items-center gap-4 rounded-2xl border px-4 py-3 transition-colors',
                    hour.isClosed ? 'bg-muted/30 border-dashed' : 'border-border',
                  )}
                >
                  {/* Day label */}
                  <div className="w-10 shrink-0">
                    <Badge
                      variant={hour.isClosed ? 'outline' : 'default'}
                      className="w-full justify-center text-[10px]"
                    >
                      {dayAbbr[hour.dayOfWeek]}
                    </Badge>
                  </div>
                  <span className="hidden w-32 text-sm font-medium sm:inline">
                    {dayNames[hour.dayOfWeek]}
                  </span>

                  {/* Closed toggle */}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!hour.isClosed}
                      onCheckedChange={(checked) => updateHour(i, 'isClosed', !checked)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {hour.isClosed ? 'Fechado' : 'Aberto'}
                    </span>
                  </div>

                  {/* Time inputs */}
                  {!hour.isClosed && (
                    <div className="flex flex-1 items-center gap-2">
                      <Input
                        type="time"
                        value={hour.openTime}
                        onChange={(e) => updateHour(i, 'openTime', e.target.value)}
                        className="h-9 w-28 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">até</span>
                      <Input
                        type="time"
                        value={hour.closeTime}
                        onChange={(e) => updateHour(i, 'closeTime', e.target.value)}
                        className="h-9 w-28 text-sm"
                      />
                    </div>
                  )}

                  {hour.isClosed && (
                    <div className="flex flex-1 items-center gap-2 text-sm text-muted-foreground">
                      <CalendarOff className="size-4" />
                      Não aceita agendamentos
                    </div>
                  )}
                </div>
              );
            })}

            <Separator className="my-4" />

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {hasChanges ? '⚠️ Alterações não salvas' : '✅ Tudo salvo'}
              </p>
              <Button
                onClick={handleSaveHours}
                disabled={!hasChanges || saving}
                className="rounded-full"
              >
                {saving ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Save className="mr-2 size-4" />
                )}
                Salvar Horários
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Special Days Tab ─── */}
      {activeTab === 'special' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Feriados e Dias Especiais</h2>
              <p className="text-sm text-muted-foreground">
                Cadastre feriados nacionais, recesso, ou dias com horário diferenciado.
              </p>
            </div>
            <Button onClick={() => setShowNewDay(true)} className="rounded-full">
              <Plus className="size-4" />
              Novo Dia
            </Button>
          </div>

          {/* Upcoming special days */}
          {upcomingDays.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Próximos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {upcomingDays.map((day) => (
                  <div
                    key={day.id}
                    className={cn(
                      'flex items-center gap-4 rounded-lg border px-4 py-3',
                      day.isClosed
                        ? 'border-red-500/20 bg-red-500/5'
                        : 'border-yellow-500/20 bg-yellow-500/5',
                    )}
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background">
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
                    <div className="flex items-center gap-2">
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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-muted-foreground">Passados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pastDays.map((day) => (
                  <div
                    key={day.id}
                    className="flex items-center gap-4 rounded-lg border border-dashed px-4 py-3 opacity-60"
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
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
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
        </div>
      )}

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
            <div className="grid grid-cols-2 gap-4">
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

            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Estabelecimento fechado</p>
                <p className="text-xs text-muted-foreground">
                  {newDay.isClosed
                    ? 'Nenhum agendamento será aceito neste dia'
                    : 'O estabelecimento abre com horário especial'}
                </p>
              </div>
              <Switch
                checked={newDay.isClosed}
                onCheckedChange={(checked) => setNewDay({ ...newDay, isClosed: checked })}
              />
            </div>

            {!newDay.isClosed && (
              <div className="grid grid-cols-2 gap-4">
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
    </div>
  );
}
