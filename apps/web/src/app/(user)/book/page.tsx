'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getProducts,
  getEmployees,
  getAvailableSlots,
  bookAppointment,
  type Product,
  type Employee,
  type AvailabilitySlot,
} from '@/lib/api';
import { formatCurrency, formatDuration } from '@/lib/format';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  User,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: 'Serviço',
  2: 'Profissional',
  3: 'Horário',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

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
  return date.toLocaleDateString('pt-BR', { weekday: 'short' });
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

export default function BookPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [dayClosed, setDayClosed] = useState(false);

  // Selections
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [notes, setNotes] = useState('');

  // Calendar offset
  const [dayOffset, setDayOffset] = useState(0);
  const visibleDays = getNextDays(5, dayOffset);

  // Load products
  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await getProducts(false);
        if (res.data?.products) setProducts(res.data.products);
      } catch {
        toast.error('Erro ao carregar serviços');
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  // Load employees when product is selected
  useEffect(() => {
    if (!selectedProduct) return;
    async function loadEmployees() {
      try {
        const res = await getEmployees(false);
        if (res.data?.employees) {
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
    if (!selectedProduct || !selectedEmployee || !selectedSlot) {
      toast.error('Preencha todos os campos');
      return;
    }

    setSubmitting(true);
    try {
      await bookAppointment({
        productId: selectedProduct.id,
        employeeId: selectedEmployee.id,
        date: selectedSlot.start,
        notes: notes.trim() || undefined,
      });
      toast.success('Agendamento realizado com sucesso! 🎉');
      router.push('/appointments');
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Erro ao criar agendamento');
    } finally {
      setSubmitting(false);
    }
  }

  const canGoNext =
    (step === 1 && selectedProduct) ||
    (step === 2 && selectedEmployee) ||
    false;

  const canSubmit = selectedProduct && selectedEmployee && selectedSlot;

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const availableSlots = slots.filter((s) => s.available);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Novo Agendamento</h1>
        <p className="text-sm text-muted-foreground">
          Escolha o serviço, profissional e horário.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1.5">
        {([1, 2, 3] as Step[]).map((s) => (
          <div key={s} className="flex flex-1 items-center gap-1.5">
            <div className="flex flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  'flex size-8 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  s < step
                    ? 'bg-primary text-primary-foreground'
                    : s === step
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {s < step ? <Check className="size-4" /> : s}
              </div>
              <span
                className={cn(
                  'text-[11px] font-medium',
                  s === step ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {STEP_LABELS[s]}
              </span>
            </div>
            {s < 3 && (
              <div
                className={cn(
                  'mb-5 h-0.5 flex-1 rounded-full transition-colors',
                  s < step ? 'bg-primary' : 'bg-muted',
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select Product */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Package className="size-4" />
            Qual serviço você deseja?
          </div>
          <div className="grid gap-3">
            {products.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setSelectedProduct(product)}
                className={cn(
                  'flex w-full flex-col gap-2 rounded-xl border p-4 text-left transition-all active:scale-[0.98]',
                  selectedProduct?.id === product.id
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                    : 'border-border hover:bg-muted/50',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{product.name}</span>
                  <Badge variant="secondary" className="font-mono text-primary">
                    {formatCurrency(product.price)}
                  </Badge>
                </div>
                {product.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {product.description}
                  </p>
                )}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  {formatDuration(product.duration)}
                </div>
              </button>
            ))}
            {products.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <Package className="mb-3 size-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Nenhum serviço disponível no momento.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Select Employee */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <User className="size-4" />
            Escolha o profissional
          </div>
          {selectedProduct && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <Package className="size-3.5 text-primary" />
              <span className="text-sm">{selectedProduct.name}</span>
              <span className="text-xs text-muted-foreground">
                · {formatDuration(selectedProduct.duration)}
              </span>
            </div>
          )}
          {employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <User className="mb-3 size-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Nenhum profissional disponível para este serviço.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {employees.map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => setSelectedEmployee(employee)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all active:scale-[0.98]',
                    selectedEmployee?.id === employee.id
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                      : 'border-border hover:bg-muted/50',
                  )}
                >
                  <Avatar className="size-12">
                    <AvatarFallback className="text-sm">
                      {getInitials(employee.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{employee.name}</p>
                    {employee.phone && (
                      <p className="text-sm text-muted-foreground">{employee.phone}</p>
                    )}
                  </div>
                  {selectedEmployee?.id === employee.id && (
                    <div className="flex size-6 items-center justify-center rounded-full bg-primary">
                      <Check className="size-3.5 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Select Date & Time */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Selected info */}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <CalendarDays className="size-3.5 text-primary" />
            <span className="text-sm">
              {selectedProduct?.name} · {selectedEmployee?.name}
            </span>
          </div>

          {/* Day selector */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Escolha o dia</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setDayOffset(Math.max(0, dayOffset - 5))}
                  disabled={dayOffset === 0}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setDayOffset(dayOffset + 5)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
            <ScrollArea className="w-full">
              <div className="flex gap-2">
                {visibleDays.map((day) => {
                  const isSelected = selectedDate === day;
                  const isToday = day === getNextDays(1, 0)[0];
                  const dayNum = day.split('-')[2];
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        'flex min-w-[60px] flex-1 flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 transition-all active:scale-95',
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:bg-muted/50',
                      )}
                    >
                      <span className={cn('text-[10px] uppercase', isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                        {getDayName(day).replace('.', '')}
                      </span>
                      <span className="text-lg font-bold">{dayNum}</span>
                      {isToday && (
                        <span className={cn('text-[9px] font-medium', isSelected ? 'text-primary-foreground/80' : 'text-primary')}>
                          HOJE
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Time slots */}
          <div>
            <span className="mb-2 block text-sm font-medium text-muted-foreground">
              {selectedDate ? 'Horários disponíveis' : 'Selecione um dia acima'}
            </span>

            {slotsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : !selectedDate ? null : dayClosed ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-red-500/30 bg-red-500/5 py-8">
                <CalendarDays className="mb-2 size-8 text-red-400/60" />
                <p className="text-sm font-medium text-red-400">
                  Fechado neste dia
                </p>
                <p className="text-xs text-muted-foreground">
                  Feriado ou dia sem funcionamento. Escolha outra data.
                </p>
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-8">
                <Clock className="mb-2 size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Nenhum horário disponível neste dia.
                </p>
              </div>
            ) : (
              <>
                <p className="mb-2 text-xs text-muted-foreground">
                  {availableSlots.length} horário{availableSlots.length !== 1 && 's'} disponíve{availableSlots.length !== 1 ? 'is' : 'l'}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.start}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={cn(
                        'rounded-xl border px-2 py-3 text-sm font-semibold transition-all active:scale-95',
                        selectedSlot?.start === slot.start
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:bg-muted/50',
                      )}
                    >
                      {formatSlotTime(slot.start)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm text-muted-foreground">
              Observações <span className="text-muted-foreground/60">(opcional)</span>
            </Label>
            <Textarea
              id="notes"
              placeholder="Alguma informação adicional..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {/* Summary */}
          {selectedSlot && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                  <Sparkles className="size-4" />
                  Resumo do agendamento
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Serviço</span>
                    <span className="font-medium">{selectedProduct?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profissional</span>
                    <span className="font-medium">{selectedEmployee?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data</span>
                    <span className="font-medium">{formatDateBR(selectedDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Horário</span>
                    <span className="font-medium">
                      {formatSlotTime(selectedSlot.start)} – {formatSlotTime(selectedSlot.end)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duração</span>
                    <span className="font-medium">{formatDuration(selectedProduct!.duration)}</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between text-base">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-primary">
                      {formatCurrency(selectedProduct!.price)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3">
        {step > 1 && (
          <Button variant="outline" onClick={goBack} className="flex-1">
            <ArrowLeft className="mr-2 size-4" />
            Voltar
          </Button>
        )}

        {step < 3 ? (
          <Button onClick={goNext} disabled={!canGoNext} className="flex-1">
            Próximo
            <ArrowRight className="ml-2 size-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="flex-1"
            size="lg"
          >
            {submitting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Check className="mr-2 size-4" />
            )}
            Confirmar Agendamento
          </Button>
        )}
      </div>
    </div>
  );
}
