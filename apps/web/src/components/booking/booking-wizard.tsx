'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Loader2,
  Package,
  User,
} from 'lucide-react';
import {
  ApiError,
  apiErrorMessage,
  bookAppointment,
  createAppointment,
  getClient,
  type AvailabilitySlot,
  type Client,
  type Employee,
  type Product,
} from '@/lib/api';
import { accentForProduct, iconForProduct } from '@/lib/admin-accents';
import { lastBookableDateKey } from '@/lib/booking-rules';
import {
  readWizardParams,
  resolveWizardSelection,
  usableWizardDate,
  wizardQuery,
  type WizardParams,
  type WizardStep,
} from '@/lib/booking-url';
import {
  NOTES_MAX_LENGTH,
  employeesForProduct,
  formatDateKey,
  formatSlotDate,
  formatSlotTime,
  slotDateKey,
} from '@/lib/booking-wizard';
import { formatLongDate, isClosedDate, nextOpenDateKey, todayDateKey } from '@/lib/datetime';
import { formatCurrency, formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { BookingDatePicker } from '@/components/booking/date-picker';
import { ClientPicker } from '@/components/booking/client-picker';
import {
  bookingKeys,
  useBookingCatalog,
  useDaySlots,
  useEmployeeCalendar,
  useNextAvailable,
} from '@/components/booking/use-booking-data';
import { StaggerIn } from '@/components/motion/stagger-in';
import { FormSkeleton, LoadError } from '@/components/shell/page-states';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/user-avatar';
import { EmailVerificationNotice } from '@/components/user/email-verification-notice';

export type BookingWizardMode = 'client' | 'admin';

const STEPS: WizardStep[] = [1, 2, 3];
const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Serviço',
  2: 'Profissional',
  3: 'Horário',
};

const COPY: Record<
  BookingWizardMode,
  {
    title: string;
    description: string;
    productQuestion: string;
    done: string;
    after: string;
  }
> = {
  client: {
    title: 'Novo agendamento',
    description: 'Escolha o serviço, o profissional e o horário.',
    productQuestion: 'Qual serviço você deseja?',
    done: 'Agendamento realizado com sucesso',
    after: '/appointments',
  },
  admin: {
    title: 'Novo agendamento',
    description: 'Serviço, profissional, horário e cliente.',
    productQuestion: 'Qual é o serviço?',
    done: 'Agendamento criado com sucesso',
    after: '/admin/appointments',
  },
};

const EMPTY_STATE =
  'flex flex-col items-center justify-center rounded-[1.35rem] bg-[var(--admin-card-muted)] py-10 text-center';

/**
 * Assistente de agendamento único (ARQ-08): o cliente em `/book` e o admin em
 * `/admin/appointments/new` usam este componente. A diferença do admin é escolher (ou cadastrar)
 * o cliente e não ter o limite de 60 dias.
 *
 * - UX-07: as escolhas ficam na URL (`?step&productId&employeeId&date`), os passos são clicáveis,
 *   "Voltar" não apaga nada, um conflito (409) recarrega a grade e, sem vaga no dia, a tela
 *   oferece o próximo horário livre.
 * - UX-08: `/book?productId=…&employeeId=…` abre direto no passo que falta.
 * - Dados com TanStack Query: cache entre os passos e busca antiga descartada (ARQ-07).
 */
export function BookingWizard({ mode }: { mode: BookingWizardMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
  const copy = COPY[mode];
  const isAdmin = mode === 'admin';

  const params = useMemo(() => readWizardParams(searchParams), [searchParams]);
  const catalog = useBookingCatalog();
  const products = useMemo(() => catalog.products.data ?? [], [catalog.products.data]);
  const allEmployees = useMemo(() => catalog.employees.data ?? [], [catalog.employees.data]);
  const hours = useMemo(() => catalog.hours.data ?? [], [catalog.hours.data]);
  const specialDays = useMemo(() => catalog.specialDays.data ?? [], [catalog.specialDays.data]);

  const { product, employee, step, maxStep } = useMemo(
    () => resolveWizardSelection(params, products, allEmployees),
    [params, products, allEmployees],
  );
  const employees = useMemo(
    () => employeesForProduct(allEmployees, product?.id),
    [allEmployees, product],
  );

  const calendar = useEmployeeCalendar(employee?.id);
  const employeeHours = calendar.data?.hours ?? null;
  const employeeSpecialDays = useMemo(
    () => calendar.data?.specialDays ?? [],
    [calendar.data?.specialDays],
  );

  const todayKey = todayDateKey();
  // O cliente reserva com até 60 dias de antecedência; o admin não tem esse teto.
  const maxDateKey = isAdmin ? undefined : lastBookableDateKey();
  const date = usableWizardDate(params.date, todayKey, maxDateKey);

  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  /** Horário sugerido em outro dia: é marcado quando a grade desse dia chega. */
  const [suggestedSlot, setSuggestedSlot] = useState<string | null>(null);
  /** O cliente que veio na URL entra uma vez só; depois vale o que o admin escolher. */
  const preselectApplied = useRef(false);

  /** Atualiza a URL. `push` nos passos, para o "voltar" do navegador desfazer um passo por vez. */
  const navigate = useCallback(
    (next: WizardParams, method: 'push' | 'replace' = 'replace') => {
      const query = wizardQuery(next);
      router[method](query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const current: WizardParams = useMemo(
    () => ({
      step,
      productId: product?.id,
      employeeId: employee?.id,
      date: date ?? undefined,
      clientId: isAdmin ? (selectedClient?.id ?? params.clientId) : undefined,
    }),
    [step, product, employee, date, isAdmin, selectedClient, params.clientId],
  );

  const isDateClosed = useCallback(
    (dateKey: string) =>
      hours.length > 0 &&
      isClosedDate(dateKey, hours, specialDays, employeeHours, employeeSpecialDays),
    [hours, specialDays, employeeHours, employeeSpecialDays],
  );

  // No passo do horário, sem data válida na URL (ou com um dia fechado), cai no próximo dia aberto.
  const calendarReady = !employee || !calendar.isPending;
  useEffect(() => {
    if (step !== 3 || !calendarReady || catalog.hours.isPending) return;
    if (date && !isDateClosed(date)) return;
    const fallback = nextOpenDateKey(
      hours,
      specialDays,
      date ?? todayKey,
      employeeHours,
      employeeSpecialDays,
    );
    if (fallback !== date) navigate({ ...current, date: fallback });
  }, [
    step,
    calendarReady,
    catalog.hours.isPending,
    date,
    isDateClosed,
    hours,
    specialDays,
    todayKey,
    employeeHours,
    employeeSpecialDays,
    navigate,
    current,
  ]);

  const daySlots = useDaySlots(
    step === 3 ? employee?.id : undefined,
    product?.id,
    date ?? undefined,
  );
  const availableSlots = useMemo(
    () => (daySlots.data?.slots ?? []).filter((slot) => slot.available),
    [daySlots.data],
  );
  const dayClosed = Boolean(daySlots.data?.isClosed);

  // O horário escolhido só vale enquanto estiver na grade do dia: trocar de dia, de profissional
  // ou recarregar depois de um conflito limpa a escolha que deixou de existir.
  useEffect(() => {
    if (!selectedSlot) return;
    const stillThere =
      Boolean(date) &&
      slotDateKey(selectedSlot.start) === date &&
      availableSlots.some((slot) => slot.start === selectedSlot.start);
    if (!stillThere && !daySlots.isFetching) setSelectedSlot(null);
  }, [selectedSlot, date, availableSlots, daySlots.isFetching]);

  // "Próximo horário livre": quando a grade do dia sugerido chega, o horário já vem marcado.
  useEffect(() => {
    if (!suggestedSlot || !date || daySlots.isFetching || !daySlots.isSuccess) return;
    if (slotDateKey(suggestedSlot) !== date) return;
    const slot = availableSlots.find((item) => item.start === suggestedSlot);
    if (slot) setSelectedSlot(slot);
    setSuggestedSlot(null);
  }, [suggestedSlot, date, availableSlots, daySlots.isFetching, daySlots.isSuccess]);

  const noVacancy = step === 3 && daySlots.isSuccess && (dayClosed || availableSlots.length === 0);
  const nextAvailable = useNextAvailable(noVacancy, employee?.id, product?.id, date ?? undefined, {
    hours,
    specialDays,
    employeeHours,
    employeeSpecialDays,
    maxDateKey,
  });

  // Admin: cliente que veio na URL (ficha do cliente → "Novo agendamento").
  const preselected = useQuery({
    queryKey: ['clients', 'detail', params.clientId],
    enabled: isAdmin && Boolean(params.clientId) && !preselectApplied.current,
    staleTime: 60_000,
    queryFn: async ({ signal }) =>
      (await getClient(params.clientId as string, { signal })).data?.client ?? null,
  });
  useEffect(() => {
    if (!isAdmin || !preselected.data || preselectApplied.current) return;
    preselectApplied.current = true;
    setSelectedClient(preselected.data);
  }, [isAdmin, preselected.data]);

  function selectClient(client: Client | null) {
    preselectApplied.current = true;
    setSelectedClient(client);
    navigate({ ...current, clientId: client?.id });
  }

  function selectProduct(next: Product) {
    // Profissional que não faz o novo serviço deixa de valer; quem faz continua escolhido.
    navigate({ ...current, step: 1, productId: next.id });
  }

  function selectEmployee(next: Employee) {
    navigate({ ...current, step: 2, employeeId: next.id });
  }

  function goToStep(target: WizardStep) {
    if (target > maxStep || target === step) return;
    navigate({ ...current, step: target }, 'push');
  }

  async function handleSubmit() {
    if (!product || !employee || !selectedSlot || !date) {
      toast.error('Escolha o horário para continuar');
      return;
    }
    if (isAdmin && !selectedClient) {
      toast.error('Escolha o cliente');
      return;
    }
    if (slotDateKey(selectedSlot.start) !== date) {
      setSelectedSlot(null);
      toast.error('Esse horário não é do dia selecionado. Escolha o horário de novo.');
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        productId: product.id,
        employeeId: employee.id,
        date: selectedSlot.start,
        notes: notes.trim() || undefined,
      };
      if (isAdmin && selectedClient) {
        await createAppointment({ ...body, clientId: selectedClient.id });
      } else {
        await bookAppointment(body);
      }
      void queryClient.invalidateQueries({ queryKey: bookingKeys.slotsRoot });
      toast.success(copy.done);
      router.push(copy.after);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_NOT_VERIFIED') {
        // Atualiza a sessão para o aviso de confirmação aparecer no topo.
        void refreshUser();
      }
      if (error instanceof ApiError && error.statusCode === 409) {
        // UX-07: alguém pegou o horário (ou ele deixou de caber). A grade é recarregada para a
        // pessoa não tentar o mesmo horário de novo.
        setSelectedSlot(null);
        void queryClient.invalidateQueries({ queryKey: bookingKeys.slotsRoot });
        toast.error(
          error.code === 'BOOKING_LIMIT_REACHED' || error.code === 'BUFFER_CONFLICT'
            ? error.message
            : `${error.message}. Atualizamos os horários: escolha outro.`,
        );
      } else {
        toast.error(apiErrorMessage(error, 'Não foi possível criar o agendamento.'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (catalog.products.isPending || catalog.employees.isPending) {
    return <FormSkeleton label="Carregando serviços e profissionais…" />;
  }

  if (catalog.products.isError) {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <AdminPageHeader title={copy.title} description={copy.description} />
        <LoadError
          title="Não foi possível carregar os serviços"
          onRetry={() => void catalog.products.refetch()}
        />
      </div>
    );
  }

  const canSubmit = Boolean(product && employee && selectedSlot && (!isAdmin || selectedClient));

  return (
    <StaggerIn selector="[data-motion='enter']" className="mx-auto max-w-4xl space-y-5">
      <div data-motion="enter">
        <AdminPageHeader title={copy.title} description={copy.description} />
      </div>

      {isAdmin ? null : <EmailVerificationNotice />}

      <nav
        data-motion="enter"
        aria-label="Passos do agendamento"
        className="admin-surface px-3 py-2"
      >
        <ol className="flex items-center">
          {STEPS.map((item) => {
            const reachable = item <= maxStep;
            const done = item < step;
            return (
              <li
                key={item}
                className={cn('flex items-center gap-2', item < 3 && 'min-w-0 flex-1')}
              >
                <button
                  type="button"
                  onClick={() => goToStep(item)}
                  disabled={!reachable}
                  aria-current={item === step ? 'step' : undefined}
                  aria-label={`Passo ${item}: ${STEP_LABELS[item]}${done ? ' (concluído)' : ''}`}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-full pr-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    reachable ? 'cursor-pointer' : 'cursor-not-allowed',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors',
                      item <= step
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-[var(--admin-card-muted)] text-muted-foreground',
                    )}
                  >
                    {done ? <Check className="size-4" /> : item}
                  </span>
                  <span
                    className={cn(
                      'hidden text-sm font-medium sm:inline',
                      item === step ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {STEP_LABELS[item]}
                  </span>
                </button>
                {item < 3 ? <Separator className="flex-1" /> : null}
              </li>
            );
          })}
        </ol>
      </nav>

      {step === 1 ? (
        <div data-motion="enter">
          <StaggerIn key="step-1" selector="[data-motion='lift']">
            <section className="admin-surface p-4 sm:p-6" aria-labelledby="booking-step-1">
              <div className="mb-5 flex items-center gap-2">
                <Package className="size-5" aria-hidden />
                <div>
                  <h2 id="booking-step-1" className="font-semibold">
                    {copy.productQuestion}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Toque em um serviço para continuar.
                  </p>
                </div>
              </div>
              {products.length === 0 ? (
                <div className={EMPTY_STATE}>
                  <Package className="mb-3 size-10 text-muted-foreground/40" aria-hidden />
                  <p className="text-sm text-muted-foreground">
                    Nenhum serviço disponível no momento.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {products.map((item) => {
                    const accent = accentForProduct(item.name);
                    const Icon = iconForProduct(item.name);
                    const selected = product?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectProduct(item)}
                        aria-pressed={selected}
                        data-motion="lift"
                        className={cn(
                          'rounded-[1.35rem] bg-[var(--admin-card-muted)] p-4 text-left transition-colors hover:bg-[var(--admin-hover)]',
                          selected && 'ring-2 ring-[var(--admin-accent)]',
                        )}
                      >
                        <div className="mb-5 flex items-start justify-between gap-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-chip)] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                            {formatDuration(item.duration)}
                          </span>
                          <span className="text-sm font-semibold">
                            {formatCurrency(item.price)}
                          </span>
                        </div>
                        <div
                          className={cn(
                            'mb-5 flex size-16 items-center justify-center rounded-3xl',
                            accent.bg,
                          )}
                        >
                          <Icon className={cn('size-8', accent.fg)} aria-hidden />
                        </div>
                        <p className="font-semibold leading-snug">{item.name}</p>
                        {item.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {item.description}
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
            <section className="admin-surface p-4 sm:p-6" aria-labelledby="booking-step-2">
              <div className="mb-5 flex items-center gap-2">
                <User className="size-5" aria-hidden />
                <div>
                  <h2 id="booking-step-2" className="font-semibold">
                    Escolha o profissional
                  </h2>
                  <p className="text-sm text-muted-foreground">Disponíveis para {product?.name}.</p>
                </div>
              </div>
              {catalog.employees.isError ? (
                <LoadError
                  title="Não foi possível carregar os profissionais"
                  onRetry={() => void catalog.employees.refetch()}
                />
              ) : employees.length === 0 ? (
                <div className={EMPTY_STATE}>
                  <User className="mb-3 size-10 text-muted-foreground/40" aria-hidden />
                  <p className="text-sm text-muted-foreground">
                    Nenhum profissional disponível para este serviço.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {employees.map((item) => {
                    const selected = employee?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectEmployee(item)}
                        aria-pressed={selected}
                        data-motion="lift"
                        className={cn(
                          'flex items-center gap-3 rounded-[1.35rem] bg-[var(--admin-card-muted)] p-4 text-left transition-colors hover:bg-[var(--admin-hover)]',
                          selected && 'ring-2 ring-[var(--admin-accent)]',
                        )}
                      >
                        <UserAvatar
                          name={item.name}
                          src={item.avatar}
                          className="size-12"
                          fallbackClassName="bg-[var(--admin-chip)] text-sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{item.name}</p>
                        </div>
                        {selected ? (
                          <div className="flex size-7 items-center justify-center rounded-full bg-[var(--admin-accent)] text-[var(--admin-accent-foreground)]">
                            <Check className="size-3.5" aria-hidden />
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
            <section
              className="admin-surface min-w-0 p-4 sm:p-6 lg:col-span-2"
              aria-labelledby="booking-step-3"
            >
              <div className="mb-5 flex min-w-0 items-center gap-2">
                <CalendarDays className="size-5 shrink-0" aria-hidden />
                <div className="min-w-0">
                  <h2 id="booking-step-3" className="font-semibold">
                    Data e horário
                  </h2>
                  <p className="truncate text-sm text-muted-foreground">
                    {employee?.name} · {product?.name}
                  </p>
                </div>
              </div>

              <div className="mb-5">
                <BookingDatePicker
                  value={date ?? ''}
                  onChange={(dateKey) => navigate({ ...current, date: dateKey })}
                  maxDateKey={maxDateKey}
                  isDateDisabled={isDateClosed}
                />
              </div>

              <div aria-live="polite">
                {!date || daySlots.isPending ? (
                  <div className="flex items-center justify-center py-10" role="status">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    <span className="sr-only">Carregando horários…</span>
                  </div>
                ) : daySlots.isError ? (
                  <LoadError
                    title="Não foi possível carregar os horários"
                    onRetry={() => void daySlots.refetch()}
                  />
                ) : noVacancy ? (
                  <div className={EMPTY_STATE}>
                    {dayClosed ? (
                      <CalendarDays className="mb-2 size-8 text-muted-foreground/40" aria-hidden />
                    ) : (
                      <Clock className="mb-2 size-8 text-muted-foreground/40" aria-hidden />
                    )}
                    <p className="text-sm font-medium">
                      {dayClosed ? 'Fechado neste dia' : 'Nenhum horário disponível neste dia'}
                    </p>
                    {nextAvailable.isPending ? (
                      <p className="mt-1 text-xs text-muted-foreground" role="status">
                        Procurando o próximo horário livre…
                      </p>
                    ) : nextAvailable.data ? (
                      <>
                        <p className="mt-1 px-4 text-xs text-muted-foreground">
                          Próximo horário livre: {formatLongDate(nextAvailable.data.dateKey)} às{' '}
                          {formatSlotTime(nextAvailable.data.slot.start)}.
                        </p>
                        <Button
                          size="sm"
                          className="mt-3 rounded-full"
                          onClick={() => {
                            const next = nextAvailable.data;
                            if (!next) return;
                            setSuggestedSlot(next.slot.start);
                            navigate({ ...current, date: next.dateKey });
                          }}
                        >
                          Ver {formatDateKey(nextAvailable.data.dateKey).slice(0, 5)} às{' '}
                          {formatSlotTime(nextAvailable.data.slot.start)}
                        </Button>
                      </>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Escolha outra data para continuar.
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="mb-3 text-sm text-muted-foreground">
                      {availableSlots.length === 1
                        ? '1 horário disponível'
                        : `${availableSlots.length} horários disponíveis`}
                    </p>
                    <div
                      role="group"
                      aria-label="Horários disponíveis"
                      className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5"
                    >
                      {availableSlots.map((slot) => {
                        const selected = selectedSlot?.start === slot.start;
                        return (
                          <button
                            key={slot.start}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            aria-pressed={selected}
                            className={cn(
                              'rounded-2xl px-2 py-3 text-sm font-semibold transition-colors',
                              selected
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-[var(--admin-card-muted)] hover:bg-[var(--admin-hover)]',
                            )}
                          >
                            {formatSlotTime(slot.start)}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="mt-5 space-y-2">
                <Label htmlFor="booking-notes" className="text-sm text-muted-foreground">
                  Observações <span className="text-muted-foreground/60">(opcional)</span>
                </Label>
                <Textarea
                  id="booking-notes"
                  placeholder="Alguma informação adicional..."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={NOTES_MAX_LENGTH}
                  aria-describedby="booking-notes-count"
                  rows={2}
                  className="resize-none rounded-2xl text-sm"
                />
                <p
                  id="booking-notes-count"
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
            </section>

            <div className="min-w-0 space-y-4">
              {isAdmin ? (
                <section className="admin-surface min-w-0 p-4 sm:p-6">
                  {preselected.isFetching && !selectedClient ? (
                    <div className="flex items-center justify-center py-6" role="status">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                      <span className="sr-only">Carregando o cliente…</span>
                    </div>
                  ) : (
                    <ClientPicker selected={selectedClient} onSelect={selectClient} />
                  )}
                </section>
              ) : null}

              <section className="admin-surface p-4 sm:p-6" aria-labelledby="booking-summary">
                <h2 id="booking-summary" className="font-semibold">
                  Resumo
                </h2>
                <dl className="mt-4 space-y-3 text-sm">
                  {isAdmin ? (
                    <SummaryRow label="Cliente" value={selectedClient?.name ?? '—'} />
                  ) : null}
                  <SummaryRow label="Serviço" value={product?.name ?? '—'} />
                  <SummaryRow label="Profissional" value={employee?.name ?? '—'} />
                  <SummaryRow
                    label="Data"
                    value={
                      selectedSlot
                        ? formatSlotDate(selectedSlot.start)
                        : date
                          ? formatDateKey(date)
                          : '—'
                    }
                  />
                  <SummaryRow
                    label="Horário"
                    value={
                      selectedSlot
                        ? `${formatSlotTime(selectedSlot.start)} – ${formatSlotTime(selectedSlot.end)}`
                        : '—'
                    }
                  />
                  <SummaryRow
                    label="Duração"
                    value={product ? formatDuration(product.duration) : '—'}
                  />
                  <Separator />
                  <div className="flex justify-between text-base">
                    <dt className="font-semibold">Total</dt>
                    <dd className="font-semibold text-brand-ink">
                      {product ? formatCurrency(product.price) : '—'}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          </StaggerIn>
        </div>
      ) : null}

      <div data-motion="enter" className="flex items-center gap-3">
        {step > 1 ? (
          <Button
            variant="outline"
            onClick={() => goToStep((step - 1) as WizardStep)}
            className="flex-1 rounded-full"
          >
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
        ) : isAdmin ? (
          <Button
            variant="outline"
            onClick={() => router.push('/admin/appointments')}
            className="flex-1 rounded-full"
          >
            <ArrowLeft className="size-4" />
            Agenda
          </Button>
        ) : null}

        {step < 3 ? (
          <Button
            onClick={() => goToStep((step + 1) as WizardStep)}
            disabled={step >= maxStep}
            className="flex-1 rounded-full"
          >
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
