'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getProducts,
  getEmployees,
  getAvailableSlots,
  bookAppointment,
  getBusinessHours,
  getSpecialDays,
  getEmployeeSchedule,
  type Product,
  type Employee,
  type AvailabilitySlot,
  type BusinessHour,
  type SpecialDay,
} from '@/lib/api';
import { formatCurrency, formatDuration } from '@/lib/format';
import { accentForProduct, iconForProduct } from '@/lib/admin-accents';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/user-avatar';
import { Separator } from '@/components/ui/separator';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { BookingDatePicker } from '@/components/booking/date-picker';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Loader2,
  Package,
  User,
  CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaggerIn } from '@/components/motion/stagger-in';
import { isClosedDate, nextOpenDateKey, todayDateKey } from '@/lib/datetime';

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: 'Serviço',
  2: 'Profissional',
  3: 'Horário',
};

function formatSlotTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

export default function BookPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [dayClosed, setDayClosed] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [notes, setNotes] = useState('');
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [specialDays, setSpecialDays] = useState<SpecialDay[]>([]);
  const [employeeHours, setEmployeeHours] = useState<BusinessHour[] | null>(null);
  const [employeeSpecialDays, setEmployeeSpecialDays] = useState<SpecialDay[]>([]);

  useEffect(() => {
    async function loadCatalog() {
      try {
        const [productsRes, hoursRes, specialRes] = await Promise.all([
          getProducts(false),
          getBusinessHours().catch(() => null),
          getSpecialDays().catch(() => null),
        ]);
        if (productsRes.data?.products) setProducts(productsRes.data.products);
        if (hoursRes?.data?.hours) setHours(hoursRes.data.hours);
        if (specialRes?.data?.days) setSpecialDays(specialRes.data.days);
      } catch {
        toast.error('Erro ao carregar serviços');
      } finally {
        setLoading(false);
      }
    }
    loadCatalog();
  }, []);

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
      toast.success('Agendamento realizado com sucesso');
      router.push('/appointments');
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Erro ao criar agendamento');
    } finally {
      setSubmitting(false);
    }
  }

  const canGoNext = (step === 1 && selectedProduct) || (step === 2 && selectedEmployee) || false;
  const canSubmit = selectedProduct && selectedEmployee && selectedSlot;
  if (loading) return null;

  const availableSlots = slots.filter((slot) => slot.available);

  return (
    <StaggerIn selector="[data-motion='enter']" className="mx-auto max-w-4xl space-y-5">
      <div data-motion="enter">
        <AdminPageHeader
          title="Novo agendamento"
          description="Escolha o serviço, o profissional e o horário."
        />
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

      {step === 1 ? (
        <div data-motion="enter">
          <StaggerIn key="step-1" selector="[data-motion='lift']">
            <section className="admin-surface p-4 sm:p-6">
              <div className="mb-5 flex items-center gap-2">
                <Package className="size-5" />
                <div>
                  <h2 className="font-semibold">Qual serviço você deseja?</h2>
                  <p className="text-sm text-muted-foreground">
                    Toque em um serviço para continuar.
                  </p>
                </div>
              </div>
              {products.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-[1.35rem] bg-[var(--admin-card-muted)] py-12">
                  <Package className="mb-3 size-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum serviço disponível no momento.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {products.map((product) => {
                    const accent = accentForProduct(product.name);
                    const Icon = iconForProduct(product.name);
                    const selected = selectedProduct?.id === product.id;
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => setSelectedProduct(product)}
                        data-motion="lift"
                        className={cn(
                          'rounded-[1.35rem] bg-[var(--admin-card-muted)] p-4 text-left transition-colors hover:bg-[var(--admin-hover)]',
                          selected && 'ring-2 ring-[var(--admin-accent)]',
                        )}
                      >
                        <div className="mb-5 flex items-start justify-between gap-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-chip)] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                            {formatDuration(product.duration)}
                          </span>
                          <span className="text-sm font-semibold">
                            {formatCurrency(product.price)}
                          </span>
                        </div>
                        <div
                          className={cn(
                            'mb-5 flex size-16 items-center justify-center rounded-3xl',
                            accent.bg,
                          )}
                        >
                          <Icon className={cn('size-8', accent.fg)} />
                        </div>
                        <p className="font-semibold leading-snug">{product.name}</p>
                        {product.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {product.description}
                          </p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </StaggerIn>
        </div>
      ) : null}

      {step === 2 ? (
        <div data-motion="enter">
          <StaggerIn key="step-2" selector="[data-motion='lift']">
            <section className="admin-surface p-4 sm:p-6">
              <div className="mb-5 flex items-center gap-2">
                <User className="size-5" />
                <div>
                  <h2 className="font-semibold">Escolha o profissional</h2>
                  <p className="text-sm text-muted-foreground">
                    Disponíveis para {selectedProduct?.name}.
                  </p>
                </div>
              </div>
              {employees.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-[1.35rem] bg-[var(--admin-card-muted)] py-12">
                  <User className="mb-3 size-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum profissional disponível para este serviço.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {employees.map((employee) => {
                    const selected = selectedEmployee?.id === employee.id;
                    return (
                      <button
                        key={employee.id}
                        type="button"
                        onClick={() => setSelectedEmployee(employee)}
                        data-motion="lift"
                        className={cn(
                          'flex items-center gap-3 rounded-[1.35rem] bg-[var(--admin-card-muted)] p-4 text-left transition-colors hover:bg-[var(--admin-hover)]',
                          selected && 'ring-2 ring-[var(--admin-accent)]',
                        )}
                      >
                        <UserAvatar
                          name={employee.name}
                          src={employee.avatar}
                          className="size-12"
                          fallbackClassName="bg-[var(--admin-chip)] text-sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{employee.name}</p>
                        </div>
                        {selected ? (
                          <div className="flex size-7 items-center justify-center rounded-full bg-[var(--admin-accent)] text-[var(--admin-accent-foreground)]">
                            <Check className="size-3.5" />
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </StaggerIn>
        </div>
      ) : null}

      {step === 3 ? (
        <div data-motion="enter">
          <StaggerIn key="step-3" className="grid gap-4 lg:grid-cols-3">
            <section className="admin-surface p-4 sm:p-6 lg:col-span-2">
              <div className="mb-5 flex min-w-0 items-center gap-2">
                <CalendarDays className="size-5 shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-semibold">Data e horário</h2>
                  <p className="truncate text-sm text-muted-foreground">
                    {selectedEmployee?.name} · {selectedProduct?.name}
                  </p>
                </div>
              </div>

              <div className="mb-5">
                <BookingDatePicker
                  value={selectedDate}
                  onChange={setSelectedDate}
                  isDateDisabled={(dateKey) =>
                    isClosedDate(dateKey, hours, specialDays, employeeHours, employeeSpecialDays)
                  }
                />
              </div>

              {slotsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : dayClosed ? (
                <div className="flex flex-col items-center justify-center rounded-[1.35rem] bg-[var(--admin-card-muted)] py-10">
                  <CalendarDays className="mb-2 size-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium">Fechado neste dia</p>
                  <p className="text-xs text-muted-foreground">
                    Escolha outra data para continuar.
                  </p>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-[1.35rem] bg-[var(--admin-card-muted)] py-10">
                  <Clock className="mb-2 size-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum horário disponível neste dia.
                  </p>
                </div>
              ) : (
                <>
                  <p className="mb-3 text-sm text-muted-foreground">
                    {availableSlots.length} horário{availableSlots.length !== 1 ? 's' : ''}{' '}
                    disponível
                    {availableSlots.length !== 1 ? 'is' : ''}
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={cn(
                          'rounded-2xl px-2 py-3 text-sm font-semibold transition-colors',
                          selectedSlot?.start === slot.start
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-[var(--admin-card-muted)] hover:bg-[var(--admin-hover)]',
                        )}
                      >
                        {formatSlotTime(slot.start)}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="mt-5 space-y-2">
                <Label htmlFor="notes" className="text-sm text-muted-foreground">
                  Observações <span className="text-muted-foreground/60">(opcional)</span>
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Alguma informação adicional..."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  className="resize-none rounded-2xl text-sm"
                />
              </div>
            </section>

            <section className="admin-surface p-4 sm:p-6">
              <h2 className="font-semibold">Resumo</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Serviço</span>
                  <span className="text-right font-medium">{selectedProduct?.name}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Profissional</span>
                  <span className="text-right font-medium">{selectedEmployee?.name}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Data</span>
                  <span className="text-right font-medium">
                    {selectedDate ? formatDateBR(selectedDate) : '—'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Horário</span>
                  <span className="text-right font-medium">
                    {selectedSlot
                      ? `${formatSlotTime(selectedSlot.start)} – ${formatSlotTime(selectedSlot.end)}`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Duração</span>
                  <span className="text-right font-medium">
                    {selectedProduct ? formatDuration(selectedProduct.duration) : '—'}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between text-base">
                  <span className="font-semibold">Total</span>
                  <span className="font-semibold text-[var(--admin-accent)]">
                    {selectedProduct ? formatCurrency(selectedProduct.price) : '—'}
                  </span>
                </div>
              </div>
            </section>
          </StaggerIn>
        </div>
      ) : null}

      <div data-motion="enter" className="flex items-center gap-3">
        {step > 1 ? (
          <Button variant="outline" onClick={goBack} className="flex-1 rounded-full">
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
        ) : null}

        {step < 3 ? (
          <Button onClick={goNext} disabled={!canGoNext} className="flex-1 rounded-full">
            Próximo
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="flex-1 rounded-full"
            size="lg"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Confirmar agendamento
          </Button>
        )}
      </div>
    </StaggerIn>
  );
}
