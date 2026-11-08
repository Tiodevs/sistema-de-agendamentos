'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getProducts,
  getEmployees,
  getClients,
  getClient,
  getAvailableSlots,
  createAppointment,
  getBusinessHours,
  getSpecialDays,
  getEmployeeSchedule,
  type Product,
  type Employee,
  type Client,
  type AvailabilitySlot,
  type BusinessHour,
  type SpecialDay,
} from '@/lib/api';
import { formatCurrency, formatDuration } from '@/lib/format';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/user-avatar';
import { Separator } from '@/components/ui/separator';
import { BookingDatePicker } from '@/components/booking/date-picker';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Loader2,
  Package,
  Search,
  User,
  CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaggerIn } from '@/components/motion/stagger-in';
import {
  NOTES_MAX_LENGTH,
  employeesForProduct,
  formatSlotDate,
  formatSlotTime,
  offersProduct,
  slotDateKey,
  slotsForDate,
} from '@/lib/booking-wizard';
import { isClosedDate, nextOpenDateKey, todayDateKey } from '@/lib/datetime';

type Step = 1 | 2 | 3;
type LoadStatus = 'loading' | 'ready' | 'error';

const STEP_LABELS: Record<Step, string> = {
  1: 'Produto',
  2: 'Profissional',
  3: 'Data e Horário',
};

export default function NewAppointmentPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [employeesStatus, setEmployeesStatus] = useState<LoadStatus>('loading');
  const [clients, setClients] = useState<Client[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(false);
  const [slotsReloadKey, setSlotsReloadKey] = useState(0);
  const [dayClosed, setDayClosed] = useState(false);

  // Selections
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [specialDays, setSpecialDays] = useState<SpecialDay[]>([]);
  const [employeeHours, setEmployeeHours] = useState<BusinessHour[] | null>(null);
  const [employeeSpecialDays, setEmployeeSpecialDays] = useState<SpecialDay[]>([]);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        const [prodRes, clientRes, hoursRes, specialRes] = await Promise.all([
          getProducts(false),
          getClients(),
          getBusinessHours().catch(() => null),
          getSpecialDays().catch(() => null),
        ]);
        if (prodRes.data?.products) setProducts(prodRes.data.products);
        if (clientRes.data?.clients) setClients(clientRes.data.clients);
        if (hoursRes?.data?.hours) setHours(hoursRes.data.hours);
        if (specialRes?.data?.days) setSpecialDays(specialRes.data.days);

        const preselectedId = new URLSearchParams(window.location.search).get('clientId');
        if (preselectedId) {
          const listed = clientRes.data?.clients.find((client) => client.id === preselectedId);
          if (listed) {
            setSelectedClient(listed);
          } else {
            const detail = await getClient(preselectedId).catch(() => null);
            if (detail?.data?.client) setSelectedClient(detail.data.client);
          }
        }
      } catch {
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Profissionais carregados uma vez e filtrados pelo produto: ir e voltar entre os passos
  // nunca esvazia a lista (UX-01).
  const loadEmployees = useCallback(async () => {
    setEmployeesStatus('loading');
    try {
      const res = await getEmployees(false);
      setAllEmployees(res.data?.employees ?? []);
      setEmployeesStatus('ready');
    } catch {
      setEmployeesStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const employees = useMemo(
    () => employeesForProduct(allEmployees, selectedProduct?.id),
    [allEmployees, selectedProduct],
  );

  useEffect(() => {
    if (!selectedEmployee) {
      setEmployeeHours(null);
      setEmployeeSpecialDays([]);
      return;
    }

    let cancelled = false;
    const employeeId = selectedEmployee.id;
    async function loadEmployeeSchedule() {
      try {
        const res = await getEmployeeSchedule(employeeId);
        if (cancelled || !res.data) return;
        setEmployeeHours(res.data.usesCustomHours ? res.data.hours : null);
        setEmployeeSpecialDays(res.data.specialDays);
      } catch {
        if (!cancelled) {
          setEmployeeHours(null);
          setEmployeeSpecialDays([]);
        }
      }
    }
    loadEmployeeSchedule();
    return () => {
      cancelled = true;
    };
  }, [selectedEmployee]);

  // ARQ-07: só a resposta da busca mais recente vale. Trocar de dia, profissional ou produto
  // descarta a anterior, e a grade nunca mostra (nem agenda) horários de outro dia.
  useEffect(() => {
    if (!selectedEmployee || !selectedProduct || !selectedDate) {
      setSlotsLoading(false);
      return;
    }

    let cancelled = false;
    const date = selectedDate;
    setSlotsLoading(true);
    setSlotsError(false);
    setSelectedSlot(null);
    setDayClosed(false);
    setSlots([]);

    getAvailableSlots(selectedEmployee.id, selectedProduct.id, date)
      .then((res) => {
        if (cancelled) return;
        if (res.data?.isClosed) {
          setDayClosed(true);
          return;
        }
        setSlots(slotsForDate(res.data?.slots ?? [], date));
      })
      .catch(() => {
        if (!cancelled) setSlotsError(true);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedEmployee, selectedProduct, selectedDate, slotsReloadKey]);

  // Set first available date when entering step 3
  useEffect(() => {
    if (step !== 3) return;
    const fallback = nextOpenDateKey(
      hours,
      specialDays,
      todayDateKey(),
      employeeHours,
      employeeSpecialDays,
    );
    if (!selectedDate) {
      setSelectedDate(fallback);
      return;
    }
    if (
      hours.length &&
      isClosedDate(selectedDate, hours, specialDays, employeeHours, employeeSpecialDays)
    ) {
      setSelectedDate(fallback);
    }
  }, [step, selectedDate, hours, specialDays, employeeHours, employeeSpecialDays]);

  // Client search
  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(clientSearch.toLowerCase()),
  );

  function selectProduct(product: Product) {
    setSelectedProduct(product);
    // Profissional que não faz o novo produto deixa de valer; quem faz continua escolhido.
    if (selectedEmployee && !offersProduct(selectedEmployee, product.id)) {
      setSelectedEmployee(null);
    }
  }

  function goNext() {
    if (step < 3) setStep((s) => (s + 1) as Step);
  }

  function goBack() {
    if (step > 1) {
      if (step === 3) {
        setSelectedDate('');
        setSelectedSlot(null);
        setSlots([]);
      }
      setStep((s) => (s - 1) as Step);
    }
  }

  async function handleSubmit() {
    if (!selectedProduct || !selectedEmployee || !selectedSlot || !selectedClient) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (slotDateKey(selectedSlot.start) !== selectedDate) {
      setSelectedSlot(null);
      toast.error('Esse horário não é do dia selecionado. Escolha o horário de novo.');
      return;
    }

    setSubmitting(true);
    try {
      await createAppointment({
        productId: selectedProduct.id,
        employeeId: selectedEmployee.id,
        clientId: selectedClient.id,
        date: selectedSlot.start,
        notes: notes.trim() || undefined,
      });
      toast.success('Agendamento criado com sucesso!');
      router.push('/admin/appointments');
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Erro ao criar agendamento');
    } finally {
      setSubmitting(false);
    }
  }

  const canGoNext = (step === 1 && selectedProduct) || (step === 2 && selectedEmployee) || false;

  const canSubmit = selectedProduct && selectedEmployee && selectedSlot && selectedClient;
  if (loading) return null;

  const availableSlots = slots.filter((s) => s.available);

  return (
    <StaggerIn selector="[data-motion='enter']" className="mx-auto max-w-4xl space-y-5">
      <div data-motion="enter" className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-2xl"
          onClick={() => router.push('/admin/appointments')}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
            Novo agendamento
          </h1>
          <p className="text-sm text-muted-foreground">Siga as etapas para criar um horário.</p>
        </div>
      </div>

      <div data-motion="enter" className="admin-surface flex items-center px-3 py-2">
        {([1, 2, 3] as Step[]).map((s) => (
          <div key={s} className={cn('flex items-center gap-2', s < 3 && 'min-w-0 flex-1')}>
            <div
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors',
                s <= step
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-[var(--admin-card-muted)] text-muted-foreground',
              )}
            >
              {s < step ? <Check className="size-4" /> : s}
            </div>
            <span
              className={cn(
                'hidden shrink-0 text-sm font-medium sm:inline',
                s === step ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {STEP_LABELS[s]}
            </span>
            {s < 3 ? <Separator className="flex-1" /> : null}
          </div>
        ))}
      </div>

      {/* Step 1: Select Product */}
      {step === 1 && (
        <div data-motion="enter" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="size-5" />
                Selecione o Produto
              </CardTitle>
              <CardDescription>Escolha o serviço que será agendado.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {products.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => selectProduct(product)}
                    className={cn(
                      'flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors',
                      selectedProduct?.id === product.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:bg-muted/50',
                    )}
                    data-motion="lift"
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-medium">{product.name}</span>
                      <span className="font-mono text-sm text-primary">
                        {formatCurrency(product.price)}
                      </span>
                    </div>
                    {product.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {product.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      {formatDuration(product.duration)}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 2: Select Employee */}
      {step === 2 && (
        <div data-motion="enter" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="size-5" />
                Selecione o Profissional
              </CardTitle>
              <CardDescription>
                Profissionais disponíveis para <strong>{selectedProduct?.name}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {employeesStatus === 'loading' ? (
                <div className="flex items-center justify-center py-8" role="status">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  <span className="sr-only">Carregando profissionais…</span>
                </div>
              ) : employeesStatus === 'error' ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <User className="mb-3 size-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    Não foi possível carregar os profissionais.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 rounded-full"
                    onClick={() => void loadEmployees()}
                  >
                    Tentar de novo
                  </Button>
                </div>
              ) : employees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <User className="mb-3 size-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum profissional disponível para este produto.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {employees.map((employee) => (
                    <button
                      key={employee.id}
                      type="button"
                      onClick={() => setSelectedEmployee(employee)}
                      className={cn(
                        'flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors',
                        selectedEmployee?.id === employee.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:bg-muted/50',
                      )}
                      data-motion="lift"
                    >
                      <UserAvatar
                        name={employee.name}
                        src={employee.avatar}
                        className="size-10"
                        fallbackClassName="text-xs"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{employee.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {employee.email || 'Profissional'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Select Date & Time + Client */}
      {step === 3 && (
        <div data-motion="enter" className="grid min-w-0 gap-4 lg:grid-cols-3">
          {/* Date Picker */}
          <Card className="min-w-0 overflow-hidden lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="size-5" />
                Data e Horário
              </CardTitle>
              <CardDescription>
                {selectedEmployee?.name} — {selectedProduct?.name} (
                {formatDuration(selectedProduct!.duration)})
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <BookingDatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                isDateDisabled={(dateKey) =>
                  isClosedDate(dateKey, hours, specialDays, employeeHours, employeeSpecialDays)
                }
              />

              {/* Time slots */}
              {slotsLoading ? (
                <div className="flex items-center justify-center py-8" role="status">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  <span className="sr-only">Carregando horários…</span>
                </div>
              ) : slotsError ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="mb-3 size-8 text-muted-foreground/50" />
                  <p className="text-sm font-medium">Não foi possível carregar os horários</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 rounded-full"
                    onClick={() => setSlotsReloadKey((key) => key + 1)}
                  >
                    Tentar de novo
                  </Button>
                </div>
              ) : dayClosed ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-red-500/30 bg-red-500/5 py-8">
                  <CalendarDays className="mb-3 size-8 text-red-400/50" />
                  <p className="text-sm font-medium text-red-400">Fechado neste dia</p>
                  <p className="text-xs text-muted-foreground">Feriado ou dia sem funcionamento.</p>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Clock className="mb-3 size-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum horário disponível neste dia.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">
                    {availableSlots.length} horário{availableSlots.length !== 1 && 's'} disponíve
                    {availableSlots.length !== 1 ? 'is' : 'l'}
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={cn(
                          'rounded-2xl border px-3 py-2.5 text-sm font-medium transition-colors',
                          selectedSlot?.start === slot.start
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:bg-muted/50',
                        )}
                      >
                        {formatSlotTime(slot.start)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Client + Notes */}
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Cliente e Observações</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4">
              {/* Client search */}
              <div className="min-w-0 space-y-2">
                <Label>Cliente</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="h-9 pl-9 text-sm"
                  />
                </div>
                <div className="max-h-48 overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl bg-[var(--admin-card-muted)] p-1">
                  {filteredClients.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      Nenhum cliente encontrado.
                    </p>
                  ) : (
                    <div className="space-y-0.5">
                      {filteredClients.slice(0, 20).map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => setSelectedClient(client)}
                          className={cn(
                            'flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-xl px-2 py-1.5 text-left text-sm transition-colors',
                            selectedClient?.id === client.id
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-background/60',
                          )}
                        >
                          <UserAvatar
                            name={client.name}
                            src={client.avatarUrl}
                            className="size-6 shrink-0"
                            fallbackClassName="text-[10px]"
                          />
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <p className="truncate text-sm font-medium">{client.name}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {client.email}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedClient ? (
                  <Badge variant="secondary" className="max-w-full truncate text-xs">
                    Selecionado: {selectedClient.name}
                  </Badge>
                ) : null}
              </div>

              <Separator />

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">
                  Observações <span className="text-muted-foreground">(opcional)</span>
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Informações adicionais..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={NOTES_MAX_LENGTH}
                  aria-describedby="notes-count"
                  rows={3}
                  className="text-sm"
                />
                <p
                  id="notes-count"
                  className={cn(
                    'text-right text-xs tabular-nums',
                    notes.length >= NOTES_MAX_LENGTH
                      ? 'text-destructive'
                      : 'text-muted-foreground/70',
                  )}
                >
                  {notes.length}/{NOTES_MAX_LENGTH} caracteres
                </p>
              </div>

              {/* Summary */}
              {selectedSlot && selectedClient && (
                <>
                  <Separator />
                  <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Resumo</p>
                    <div className="space-y-1 break-words text-sm">
                      <p>
                        <span className="text-muted-foreground">Produto:</span>{' '}
                        {selectedProduct?.name}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Profissional:</span>{' '}
                        {selectedEmployee?.name}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Cliente:</span>{' '}
                        {selectedClient.name}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Data:</span>{' '}
                        {formatSlotDate(selectedSlot.start)} {formatSlotTime(selectedSlot.start)} –{' '}
                        {formatSlotTime(selectedSlot.end)}
                      </p>
                      <p className="font-mono font-semibold text-primary">
                        {formatCurrency(selectedProduct!.price)}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div data-motion="enter" className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" className="rounded-full" onClick={goBack} disabled={step === 1}>
          <ArrowLeft className="size-4" />
          Voltar
        </Button>

        {step < 3 ? (
          <Button className="rounded-full" onClick={goNext} disabled={!canGoNext}>
            Próximo
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            className="rounded-full"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Confirmar Agendamento
          </Button>
        )}
      </div>
    </StaggerIn>
  );
}
