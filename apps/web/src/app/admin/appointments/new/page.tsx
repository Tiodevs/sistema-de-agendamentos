'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getProducts,
  getEmployees,
  getClients,
  getAvailableSlots,
  createAppointment,
  type Product,
  type Employee,
  type Client,
  type AvailabilitySlot,
} from '@/lib/api';
import { formatCurrency, formatDuration, getInitials } from '@/lib/format';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: 'Produto',
  2: 'Profissional',
  3: 'Data e Horário',
};

function formatSlotTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function getDayName(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('pt-BR', { weekday: 'long' });
}

function getNextDays(count: number, startOffset = 0): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = startOffset; i < startOffset + count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    days.push(`${yyyy}-${mm}-${dd}`);
  }
  return days;
}

export default function NewAppointmentPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [dayClosed, setDayClosed] = useState(false);

  // Selections
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [notes, setNotes] = useState('');

  // Calendar offset
  const [dayOffset, setDayOffset] = useState(0);
  const visibleDays = getNextDays(7, dayOffset);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        const [prodRes, clientRes] = await Promise.all([getProducts(false), getClients()]);
        if (prodRes.data?.products) setProducts(prodRes.data.products);
        if (clientRes.data?.clients) setClients(clientRes.data.clients);
      } catch {
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Load employees when product is selected
  useEffect(() => {
    if (!selectedProduct) return;
    async function loadEmployees() {
      try {
        const res = await getEmployees(false);
        if (res.data?.employees) {
          // Filtrar apenas funcionários vinculados ao produto selecionado
          const filtered = res.data.employees.filter((emp) =>
            emp.products.some((ep) => ep.product.id === selectedProduct!.id),
          );
          setEmployees(filtered);
        }
      } catch {
        toast.error('Erro ao carregar profissionais');
      }
    }
    loadEmployees();
  }, [selectedProduct]);

  // Load slots when employee + date are selected
  const fetchSlots = useCallback(async (employeeId: string, productId: string, date: string) => {
    setSlotsLoading(true);
    setSelectedSlot(null);
    setDayClosed(false);
    try {
      const res = await getAvailableSlots(employeeId, productId, date);
      if (res.data?.isClosed) {
        setDayClosed(true);
        setSlots([]);
      } else if (res.data?.slots) {
        setSlots(res.data.slots);
      }
    } catch {
      toast.error('Erro ao carregar horários');
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedEmployee && selectedProduct && selectedDate) {
      fetchSlots(selectedEmployee.id, selectedProduct.id, selectedDate);
    }
  }, [selectedEmployee, selectedProduct, selectedDate, fetchSlots]);

  // Set first available date when entering step 3
  useEffect(() => {
    if (step === 3 && !selectedDate) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setSelectedDate(`${yyyy}-${mm}-${dd}`);
    }
  }, [step, selectedDate]);

  // Client search
  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(clientSearch.toLowerCase()),
  );

  function goNext() {
    if (step < 3) setStep((s) => (s + 1) as Step);
  }

  function goBack() {
    if (step > 1) {
      if (step === 2) {
        setSelectedEmployee(null);
        setEmployees([]);
      }
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

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const availableSlots = slots.filter((s) => s.available);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center gap-4">
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

      <div className="admin-surface flex items-center gap-2 p-2 sm:p-3">
        {([1, 2, 3] as Step[]).map((s) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                'flex size-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                s <= step
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-[var(--admin-card-muted)] text-muted-foreground',
              )}
            >
              {s < step ? <Check className="size-4" /> : s}
            </div>
            <span
              className={cn(
                'hidden text-sm font-medium sm:inline',
                s === step ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {STEP_LABELS[s]}
            </span>
            {s < 3 ? <Separator className="hidden flex-1 sm:block" /> : null}
          </div>
        ))}
      </div>

      {/* Step 1: Select Product */}
      {step === 1 && (
        <div className="space-y-4">
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
                    onClick={() => setSelectedProduct(product)}
                    className={cn(
                      'flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors',
                      selectedProduct?.id === product.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:bg-muted/50',
                    )}
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
        <div className="space-y-4">
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
              {employees.length === 0 ? (
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
                    >
                      <Avatar className="size-10">
                        <AvatarFallback className="text-xs">
                          {getInitials(employee.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{employee.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{employee.email}</p>
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
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Date Picker */}
          <Card className="lg:col-span-2">
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
              {/* Day selector */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setDayOffset(Math.max(0, dayOffset - 7))}
                  disabled={dayOffset === 0}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <ScrollArea className="flex-1">
                  <div className="flex gap-2">
                    {visibleDays.map((day) => {
                      const isSelected = selectedDate === day;
                      const isToday = day === getNextDays(1, 0)[0];
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setSelectedDate(day)}
                          className={cn(
                            'flex min-w-[80px] flex-col items-center gap-0.5 rounded-2xl border px-3 py-2 text-center transition-colors',
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:bg-muted/50',
                          )}
                        >
                          <span className="text-xs capitalize text-muted-foreground">
                            {getDayName(day).slice(0, 3)}
                          </span>
                          <span className="text-sm font-medium">
                            {formatDateBR(day).slice(0, 5)}
                          </span>
                          {isToday && <span className="text-[10px] text-primary">Hoje</span>}
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setDayOffset(dayOffset + 7)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              {/* Time slots */}
              {slotsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cliente e Observações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Client search */}
              <div className="space-y-2">
                <Label>Cliente</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
                <ScrollArea className="max-h-[180px]">
                  <div className="space-y-1">
                    {filteredClients.slice(0, 20).map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => setSelectedClient(client)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                          selectedClient?.id === client.id
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted/50',
                        )}
                      >
                        <Avatar className="size-6">
                          <AvatarFallback className="text-[10px]">
                            {getInitials(client.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{client.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {client.email}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
                {selectedClient && (
                  <Badge variant="secondary" className="text-xs">
                    Selecionado: {selectedClient.name}
                  </Badge>
                )}
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
                  rows={3}
                  className="text-sm"
                />
              </div>

              {/* Summary */}
              {selectedSlot && selectedClient && (
                <>
                  <Separator />
                  <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Resumo</p>
                    <div className="space-y-1 text-sm">
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
                        {formatDateBR(selectedDate)} {formatSlotTime(selectedSlot.start)} –{' '}
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
      <div className="flex items-center justify-between">
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
    </div>
  );
}
