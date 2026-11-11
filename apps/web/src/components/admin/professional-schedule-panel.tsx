'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  apiErrorMessage,
  createEmployeeSpecialDay,
  deleteEmployeeSpecialDay,
  getEmployeeSchedule,
  getEmployeeScheduleSummaries,
  getEmployees,
  resetEmployeeHours,
  updateEmployee,
  updateEmployeeHours,
  type BusinessHourPayload,
  type Employee,
  type EmployeeSchedule,
  type EmployeeScheduleSummary,
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
import { UserAvatar } from '@/components/user-avatar';
import { ScheduleHoursEditor, type HourFieldValue } from '@/components/admin/schedule-hours-editor';
import { firstBreaksError, toHourPayload } from '@/lib/schedule-breaks';
import { StaggerIn } from '@/components/motion/stagger-in';
import { LoadError, LoadingState } from '@/components/shell/page-states';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { impactMessage } from '@/lib/affected-appointments';
import { todayDateKey } from '@/lib/datetime';
import { splitSpecialDays } from '@/lib/special-days';
import {
  AffectedAppointmentsDialog,
  useAffectedAppointments,
} from '@/components/admin/affected-appointments-dialog';
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  CalendarOff,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Trash2,
  Users,
} from 'lucide-react';

function formatDateBR(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00`);
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/** "24/12" de um dia `YYYY-MM-DD`. */
function formatDayMonthKey(dateKey: string) {
  const [, month, day] = dateKey.slice(0, 10).split('-');
  return `${day}/${month}`;
}

/**
 * `ownBreaks: false` quando o profissional ainda segue o horário do estúdio: as pausas que a API
 * devolve são as do estúdio, que continuam valendo de qualquer forma e não são copiadas para o
 * horário próprio (UX-12).
 */
function toPayload(hours: Array<BusinessHourPayload>, ownBreaks = true): BusinessHourPayload[] {
  return hours.map((hour) => toHourPayload(hour, ownBreaks));
}

export function ProfessionalSchedulePanel() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [summaries, setSummaries] = useState<EmployeeScheduleSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<EmployeeSchedule | null>(null);
  const [editHours, setEditHours] = useState<BusinessHourPayload[]>([]);
  /** UX-12: respiro entre atendimentos, em minutos, como está no campo. */
  const [bufferDraft, setBufferDraft] = useState('0');
  const [savingBuffer, setSavingBuffer] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  // UX-10: falha da API tem tela própria. Antes a lista vazia dizia "nenhum profissional" e a
  // grade que não carregava ficava girando para sempre.
  const [listError, setListError] = useState(false);
  const [scheduleError, setScheduleError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [showNewDay, setShowNewDay] = useState(false);
  const [creatingDay, setCreatingDay] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [newDay, setNewDay] = useState({
    date: '',
    title: '',
    description: '',
    isClosed: true,
    openTime: '08:00',
    closeTime: '18:00',
  });

  const loadList = useCallback(async () => {
    try {
      const [employeesRes, summariesRes] = await Promise.all([
        getEmployees(true),
        getEmployeeScheduleSummaries(),
      ]);
      if (employeesRes.data?.employees) setEmployees(employeesRes.data.employees);
      if (summariesRes.data?.employees) setSummaries(summariesRes.data.employees);
      setListError(false);
    } catch {
      setListError(true);
      toast.error('Erro ao carregar profissionais');
    } finally {
      setLoadingList(false);
    }
  }, []);

  // ARQ-07: trocar de profissional rápido não pode mostrar (nem salvar) a grade de outro. Cada
  // pedido ganha um número; resposta de pedido antigo é descartada.
  const scheduleRequest = useRef(0);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;
  const affected = useAffectedAppointments();

  const applySchedule = useCallback((data: EmployeeSchedule) => {
    // Resposta de um profissional que não está mais na tela não muda a grade.
    if (data.employee.id !== selectedIdRef.current) return;
    setSchedule(data);
    setEditHours(toPayload(data.hours, data.usesCustomHours));
    setCustomizing(data.usesCustomHours);
    setBufferDraft(String(data.bufferMinutes ?? 0));
  }, []);

  const loadSchedule = useCallback(
    async (employeeId: string) => {
      const requestId = ++scheduleRequest.current;
      setLoadingSchedule(true);
      setScheduleError(false);
      try {
        const res = await getEmployeeSchedule(employeeId);
        if (requestId !== scheduleRequest.current) return;
        if (res.data) applySchedule(res.data);
      } catch {
        if (requestId === scheduleRequest.current) {
          setScheduleError(true);
          toast.error('Erro ao carregar horário do profissional');
        }
      } finally {
        if (requestId === scheduleRequest.current) setLoadingSchedule(false);
      }
    },
    [applySchedule],
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    // A grade do profissional anterior some na hora: nada dela pode ser salvo no novo.
    setSchedule(null);
    setEditHours([]);
    if (selectedId) void loadSchedule(selectedId);
  }, [selectedId, loadSchedule]);

  const selectedEmployee = employees.find((employee) => employee.id === selectedId) ?? null;
  const summaryById = new Map(summaries.map((item) => [item.id, item]));

  function updateHour(index: number, field: keyof BusinessHourPayload, value: HourFieldValue) {
    setEditHours((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  const savedPayload = schedule ? toPayload(schedule.hours, schedule.usesCustomHours) : [];
  const hasChanges = customizing && JSON.stringify(editHours) !== JSON.stringify(savedPayload);
  const specialDays: SpecialDay[] = schedule?.specialDays ?? [];
  // UX-05: "próximas" e "passadas" pelo dia de São Paulo, não pela data UTC.
  const { upcoming: upcomingDays, past: pastDays } = splitSpecialDays(specialDays, todayDateKey());
  /** O profissional cuja grade está na tela: é para ele que vão as mudanças. */
  const shownEmployeeId =
    schedule && schedule.employee.id === selectedId && !loadingSchedule
      ? schedule.employee.id
      : null;
  const shownName = schedule?.employee.name ?? 'o profissional';

  async function handleSaveHours() {
    const employeeId = shownEmployeeId;
    if (!employeeId) return;
    // UX-12: pausa fora do expediente ou sobreposta é apontada antes de ir para a API.
    const invalid = firstBreaksError(editHours);
    if (invalid) {
      toast.error(invalid.message);
      return;
    }
    const payload = toPayload(editHours);
    setSaving(true);
    try {
      await affected.run(`O novo horário de ${shownName}`, async (decision) => {
        const res = await updateEmployeeHours(employeeId, payload, decision);
        if (res.data) {
          applySchedule(res.data);
          await loadList();
          toast.success(impactMessage('Horário do profissional salvo.', res.data.impact));
        }
      });
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Erro ao salvar horário'));
    } finally {
      setSaving(false);
    }
  }

  const savedBuffer = schedule?.bufferMinutes ?? 0;
  const bufferValue = Number(bufferDraft);
  const bufferValid =
    bufferDraft.trim() !== '' &&
    Number.isInteger(bufferValue) &&
    bufferValue >= 0 &&
    bufferValue <= 120;

  async function handleSaveBuffer() {
    const employeeId = shownEmployeeId;
    if (!employeeId || !bufferValid) return;
    setSavingBuffer(true);
    try {
      await updateEmployee(employeeId, { bufferMinutes: bufferValue });
      setSchedule((current) =>
        current && current.employee.id === employeeId
          ? { ...current, bufferMinutes: bufferValue }
          : current,
      );
      toast.success(
        bufferValue === 0
          ? 'Respiro removido: os atendimentos podem ficar em sequência.'
          : `Respiro de ${bufferValue} min salvo. Vale para os próximos agendamentos.`,
      );
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Erro ao salvar o respiro'));
    } finally {
      setSavingBuffer(false);
    }
  }

  async function handleResetHours() {
    const employeeId = shownEmployeeId;
    if (!employeeId) return;
    setSaving(true);
    try {
      await affected.run(`Voltar ${shownName} ao horário do estúdio`, async (decision) => {
        const res = await resetEmployeeHours(employeeId, decision);
        if (res.data) {
          applySchedule(res.data);
          setResetOpen(false);
          await loadList();
          toast.success(impactMessage('Voltou ao horário do estabelecimento.', res.data.impact));
        }
      });
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Erro ao restaurar horário'));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateDay() {
    const employeeId = shownEmployeeId;
    if (!employeeId || !newDay.date || !newDay.title) {
      toast.error('Preencha a data e o título');
      return;
    }
    const body = {
      date: newDay.date,
      title: newDay.title,
      description: newDay.description || undefined,
      isClosed: newDay.isClosed,
      openTime: newDay.isClosed ? null : newDay.openTime,
      closeTime: newDay.isClosed ? null : newDay.closeTime,
    };
    const day = formatDayMonthKey(body.date);
    setCreatingDay(true);
    try {
      await affected.run(
        body.isClosed
          ? `A folga de ${shownName} em ${day}`
          : `O horário especial de ${shownName} em ${day}`,
        async (decision) => {
          const res = await createEmployeeSpecialDay(employeeId, body, decision);
          toast.success(
            impactMessage(
              'Exceção criada.',
              res.data?.impact,
              body.isClosed ? 'no dia da folga' : 'fora do horário especial',
            ),
          );
          setShowNewDay(false);
          setNewDay({
            date: '',
            title: '',
            description: '',
            isClosed: true,
            openTime: '08:00',
            closeTime: '18:00',
          });
          await Promise.all([loadSchedule(employeeId), loadList()]);
        },
      );
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Erro ao criar exceção'));
    } finally {
      setCreatingDay(false);
    }
  }

  async function handleDeleteDay() {
    const employeeId = shownEmployeeId;
    const id = deleteId;
    if (!employeeId || !id) return;
    const target = specialDays.find((day) => day.id === id);
    setDeleting(true);
    try {
      await affected.run(
        target
          ? `Excluir a exceção de ${shownName} em ${formatDayMonthKey(target.date)}`
          : 'Excluir a exceção',
        async (decision) => {
          const res = await deleteEmployeeSpecialDay(employeeId, id, decision);
          toast.success(impactMessage('Exceção excluída.', res.data?.impact));
          setDeleteId(null);
          await Promise.all([loadSchedule(employeeId), loadList()]);
        },
      );
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Erro ao excluir'));
    } finally {
      setDeleting(false);
    }
  }

  function handleCustomizeToggle(checked: boolean) {
    if (checked) {
      setCustomizing(true);
      return;
    }
    if (schedule?.usesCustomHours) {
      setResetOpen(true);
      return;
    }
    if (schedule) setEditHours(toPayload(schedule.hours, schedule.usesCustomHours));
    setCustomizing(false);
  }

  if (loadingList) {
    return (
      <LoadingState label="Carregando profissionais…" className="space-y-4">
        <Skeleton className="h-6 w-56" />
        <div className="flex gap-2">
          <Skeleton className="h-14 w-44 rounded-2xl" />
          <Skeleton className="h-14 w-44 rounded-2xl" />
        </div>
      </LoadingState>
    );
  }

  if (listError && employees.length === 0) {
    return (
      <LoadError
        title="Não foi possível carregar os profissionais"
        onRetry={() => {
          setLoadingList(true);
          void loadList();
        }}
      />
    );
  }

  return (
    <StaggerIn replayKey="professionals" selector="[data-motion='enter']" className="space-y-4">
      <div data-motion="enter" className="min-w-0">
        <h2 className="text-lg font-semibold">Agenda por profissional</h2>
        <p className="text-sm text-muted-foreground">
          O padrão é o horário do estabelecimento. Personalize só quem trabalha em dias ou horários
          diferentes. Feriados do estúdio continuam valendo para todos.
        </p>
      </div>

      {employees.length === 0 ? (
        <div
          data-motion="enter"
          className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16"
        >
          <Users className="mb-3 size-12 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">
            Nenhum profissional cadastrado
          </p>
        </div>
      ) : (
        <div data-motion="enter" className="admin-scroll-x flex gap-2">
          {employees.map((employee) => {
            const summary = summaryById.get(employee.id);
            const selected = employee.id === selectedId;
            return (
              <button
                key={employee.id}
                type="button"
                onClick={() => setSelectedId(employee.id)}
                aria-pressed={selected}
                className={cn(
                  'flex min-w-[11.5rem] items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors',
                  selected
                    ? 'border-foreground/20 bg-[var(--admin-card-muted)]'
                    : 'border-border hover:bg-[var(--admin-hover)]',
                )}
              >
                <UserAvatar
                  name={employee.name}
                  src={employee.avatar}
                  className="size-9 shrink-0"
                  fallbackClassName="bg-[var(--admin-card-muted)] text-[10px]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{employee.name}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1">
                    {summary?.usesCustomHours ? (
                      <Badge variant="secondary" className="rounded-full px-1.5 text-[10px]">
                        Personalizado
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Padrão do estúdio</span>
                    )}
                    {(summary?.specialDaysCount ?? 0) > 0 ? (
                      <Badge variant="outline" className="rounded-full px-1.5 text-[10px]">
                        {summary?.specialDaysCount}{' '}
                        {(summary?.specialDaysCount ?? 0) === 1 ? 'exceção' : 'exceções'}
                      </Badge>
                    ) : null}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!selectedEmployee ? (
        employees.length > 0 ? (
          <div
            data-motion="enter"
            className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16"
          >
            <Users className="mb-3 size-12 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
              Escolha um profissional para ver ou personalizar a agenda
            </p>
          </div>
        ) : null
      ) : scheduleError && !loadingSchedule ? (
        <LoadError
          title={`Não foi possível carregar a agenda de ${selectedEmployee.name}`}
          onRetry={() => void loadSchedule(selectedEmployee.id)}
        />
      ) : loadingSchedule || !schedule || schedule.employee.id !== selectedId ? (
        <div role="status" className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <span className="sr-only">Carregando a agenda de {selectedEmployee.name}…</span>
        </div>
      ) : (
        <>
          <Card data-motion="enter" className="overflow-hidden">
            <CardHeader className="px-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="text-base sm:text-lg">
                    Expediente de {selectedEmployee.name}
                  </CardTitle>
                  <CardDescription>
                    {customizing
                      ? 'Este profissional usa horário próprio. Se o estabelecimento estiver fechado, ele também não atende.'
                      : 'Usando o horário do estabelecimento. Ative a personalização para mudar dias ou horas.'}
                  </CardDescription>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 sm:justify-end">
                  <span className="text-sm font-medium">Personalizar</span>
                  <Switch
                    aria-label={`Personalizar o expediente de ${selectedEmployee.name}`}
                    checked={customizing}
                    onCheckedChange={handleCustomizeToggle}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-w-0 space-y-1 px-4 sm:px-6">
              <ScheduleHoursEditor
                hours={editHours}
                onChange={updateHour}
                disabled={!customizing}
                replayKey={`${selectedId}-${customizing ? 'custom' : 'studio'}`}
                breaksHint={
                  customizing
                    ? 'As pausas do estúdio continuam valendo; aqui entram as pausas só deste profissional.'
                    : undefined
                }
              />

              {/* UX-12: respiro entre dois atendimentos, independente do horário personalizado. */}
              <div className="mt-4 flex min-w-0 flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-end sm:justify-between md:px-4">
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="employee-buffer">Respiro entre atendimentos</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="employee-buffer"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={120}
                      step={5}
                      value={bufferDraft}
                      onChange={(event) => setBufferDraft(event.target.value)}
                      aria-describedby="employee-buffer-hint"
                      aria-invalid={!bufferValid}
                      className="h-9 w-24 text-sm"
                    />
                    <span className="text-sm text-muted-foreground">minutos</span>
                  </div>
                  <p id="employee-buffer-hint" className="text-xs text-muted-foreground">
                    {bufferValid
                      ? 'Tempo livre antes e depois de cada atendimento. Com 0, um horário pode começar quando o outro termina.'
                      : 'Use um número inteiro de 0 a 120.'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full rounded-full sm:w-auto"
                  onClick={handleSaveBuffer}
                  disabled={
                    savingBuffer || !shownEmployeeId || !bufferValid || bufferValue === savedBuffer
                  }
                >
                  {savingBuffer ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Salvar respiro
                </Button>
              </div>

              {customizing ? (
                <>
                  <Separator className="my-4" />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div
                      role="status"
                      className={cn(
                        'inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium',
                        hasChanges || !schedule.usesCustomHours
                          ? 'bg-tone-warning-bg text-tone-warning'
                          : 'bg-tone-success-bg text-tone-success',
                      )}
                    >
                      {hasChanges || !schedule.usesCustomHours ? (
                        <AlertCircle className="size-4 shrink-0" aria-hidden />
                      ) : (
                        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                      )}
                      <span>
                        {hasChanges || !schedule.usesCustomHours
                          ? 'Alterações pendentes'
                          : 'Horário personalizado salvo'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {schedule.usesCustomHours ? (
                        <Button
                          variant="outline"
                          className="w-full rounded-full sm:w-auto"
                          onClick={() => setResetOpen(true)}
                          disabled={saving || !shownEmployeeId}
                        >
                          Usar horário do estúdio
                        </Button>
                      ) : null}
                      <Button
                        onClick={handleSaveHours}
                        disabled={
                          saving || !shownEmployeeId || (schedule.usesCustomHours && !hasChanges)
                        }
                        className="w-full rounded-full sm:w-auto"
                      >
                        {saving ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Save className="size-4" />
                        )}
                        Salvar horário
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <div
            data-motion="enter"
            className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <h3 className="text-lg font-semibold">Folgas e horários especiais</h3>
              <p className="text-sm text-muted-foreground">
                Folga, congresso ou expediente diferente só deste profissional.
              </p>
            </div>
            <Button onClick={() => setShowNewDay(true)} className="w-full rounded-full sm:w-auto">
              <Plus className="size-4" />
              Nova exceção
            </Button>
          </div>

          {upcomingDays.length > 0 ? (
            <Card data-motion="enter">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Próximas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {upcomingDays.map((day) => (
                  <div
                    key={day.id}
                    data-motion="lift"
                    className={cn(
                      'flex min-w-0 flex-col gap-3 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4',
                      day.isClosed
                        ? 'border-tone-danger/20 bg-tone-danger/5'
                        : 'border-tone-warning/20 bg-tone-warning/5',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-card-muted)]">
                        {day.isClosed ? (
                          <CalendarOff className="size-5 text-tone-danger" />
                        ) : (
                          <CalendarDays className="size-5 text-tone-warning" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{day.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {formatDateBR(day.date.split('T')[0])}
                        </p>
                        {day.description ? (
                          <p className="mt-0.5 text-xs text-muted-foreground italic">
                            {day.description}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      {day.isClosed ? (
                        <Badge
                          variant="outline"
                          className="border-tone-danger-border text-tone-danger"
                        >
                          Folga
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-tone-warning-border text-tone-warning"
                        >
                          {day.openTime} – {day.closeTime}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-tone-danger hover:bg-tone-danger-bg hover:text-tone-danger"
                        onClick={() => setDeleteId(day.id)}
                        aria-label={`Excluir a exceção ${day.title}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {pastDays.length > 0 ? (
            <Card data-motion="enter">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-muted-foreground">Passadas</CardTitle>
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
                      className="size-8 text-muted-foreground hover:bg-tone-danger-bg hover:text-tone-danger"
                      onClick={() => setDeleteId(day.id)}
                      aria-label={`Excluir a exceção ${day.title}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {specialDays.length === 0 ? (
            <div
              data-motion="enter"
              className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12"
            >
              <CalendarOff className="mb-3 size-10 text-muted-foreground/30" />
              <p className="mb-1 text-sm font-medium text-muted-foreground">
                Nenhuma folga ou horário especial
              </p>
              <p className="text-xs text-muted-foreground">
                Este profissional segue o calendário do estabelecimento.
              </p>
            </div>
          ) : null}
        </>
      )}

      <Dialog open={showNewDay} onOpenChange={setShowNewDay}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova exceção</DialogTitle>
            <DialogDescription>
              Folga ou horário diferente só para {selectedEmployee?.name ?? 'o profissional'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="employee-special-date">Data</Label>
                <Input
                  id="employee-special-date"
                  type="date"
                  value={newDay.date}
                  onChange={(event) => setNewDay({ ...newDay, date: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee-special-title">Título</Label>
                <Input
                  id="employee-special-title"
                  placeholder="Ex: Folga"
                  value={newDay.title}
                  onChange={(event) => setNewDay({ ...newDay, title: event.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee-special-desc">Descrição (opcional)</Label>
              <Textarea
                id="employee-special-desc"
                placeholder="Informações adicionais..."
                value={newDay.description}
                onChange={(event) => setNewDay({ ...newDay, description: event.target.value })}
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3 sm:px-4">
              <div className="min-w-0">
                <p id="employee-special-closed-label" className="text-sm font-medium">
                  Profissional de folga
                </p>
                <p id="employee-special-closed-hint" className="text-xs text-muted-foreground">
                  {newDay.isClosed
                    ? 'Nenhum agendamento será aceito com este profissional'
                    : 'Atende com horário especial neste dia'}
                </p>
              </div>
              <Switch
                className="shrink-0"
                aria-labelledby="employee-special-closed-label"
                aria-describedby="employee-special-closed-hint"
                checked={newDay.isClosed}
                onCheckedChange={(checked) => setNewDay({ ...newDay, isClosed: checked })}
              />
            </div>
            {!newDay.isClosed ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="employee-special-open">Início</Label>
                  <Input
                    id="employee-special-open"
                    type="time"
                    value={newDay.openTime}
                    onChange={(event) => setNewDay({ ...newDay, openTime: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee-special-close">Fim</Label>
                  <Input
                    id="employee-special-close"
                    type="time"
                    value={newDay.closeTime}
                    onChange={(event) => setNewDay({ ...newDay, closeTime: event.target.value })}
                  />
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDay(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateDay} disabled={creatingDay || !shownEmployeeId}>
              {creatingDay ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Criar exceção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-tone-warning-bg">
              <AlertTriangle className="size-6 text-tone-warning" />
            </div>
            <DialogTitle className="text-center">Usar horário do estabelecimento?</DialogTitle>
            <DialogDescription className="text-center">
              O expediente personalizado deste profissional será removido. Folgas e exceções
              pontuais continuam.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={handleResetHours}
              disabled={saving || !shownEmployeeId}
              className="w-full"
            >
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Sim, voltar ao padrão
            </Button>
            <Button
              variant="outline"
              onClick={() => setResetOpen(false)}
              disabled={saving}
              className="w-full"
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AffectedAppointmentsDialog {...affected.dialogProps} />

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-tone-danger-bg">
              <AlertTriangle className="size-6 text-tone-danger" />
            </div>
            <DialogTitle className="text-center">Excluir esta exceção?</DialogTitle>
            <DialogDescription className="text-center">
              Nesta data o profissional volta a seguir o expediente da semana e os feriados do
              estúdio.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              onClick={handleDeleteDay}
              disabled={deleting}
              className="w-full"
            >
              {deleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
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
