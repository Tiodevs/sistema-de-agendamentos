'use client';

import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  getAvailableSlots,
  getBusinessHours,
  getEmployeeSchedule,
  getEmployees,
  getProducts,
  getSpecialDays,
  type AvailabilitySlot,
  type BusinessHour,
  type SpecialDay,
} from '@/lib/api';
import { slotsForDate } from '@/lib/booking-wizard';
import { addDateKey, isClosedDate } from '@/lib/datetime';

/**
 * Dados do assistente de agendamento com TanStack Query (ARQ-08): cache entre os passos, busca
 * cancelada quando a escolha muda (ARQ-07) e recarga da grade depois de um conflito (UX-07).
 */

const CATALOG_STALE_MS = 60_000;
/** Quantos dias abertos o "próximo horário livre" olha para a frente. */
const NEXT_AVAILABLE_DAYS = 14;

export const bookingKeys = {
  products: ['booking', 'products'] as const,
  employees: ['booking', 'employees'] as const,
  hours: ['booking', 'hours'] as const,
  specialDays: ['booking', 'special-days'] as const,
  employeeSchedule: (employeeId: string) => ['booking', 'employee-schedule', employeeId] as const,
  slotsRoot: ['booking', 'slots'] as const,
  slots: (employeeId: string, productId: string, date: string) =>
    ['booking', 'slots', employeeId, productId, date] as const,
};

export interface DaySlots {
  isClosed: boolean;
  slots: AvailabilitySlot[];
}

async function fetchDaySlots(
  employeeId: string,
  productId: string,
  date: string,
  signal?: AbortSignal,
): Promise<DaySlots> {
  const res = await getAvailableSlots(employeeId, productId, date, { signal });
  return {
    isClosed: Boolean(res.data?.isClosed),
    // Só horários do dia pedido: resposta de outro dia nunca entra na grade (ARQ-07).
    slots: slotsForDate(res.data?.slots ?? [], date),
  };
}

export function useBookingCatalog() {
  const products = useQuery({
    queryKey: bookingKeys.products,
    queryFn: async () => (await getProducts(false)).data?.products ?? [],
    staleTime: CATALOG_STALE_MS,
  });
  const employees = useQuery({
    queryKey: bookingKeys.employees,
    queryFn: async () => (await getEmployees(false)).data?.employees ?? [],
    staleTime: CATALOG_STALE_MS,
  });
  // Expediente e feriados só servem para desabilitar dias no calendário: se falharem, a grade
  // de horários (que vem da API) continua sendo a verdade.
  const hours = useQuery({
    queryKey: bookingKeys.hours,
    queryFn: async ({ signal }) => (await getBusinessHours({ signal })).data?.hours ?? [],
    staleTime: CATALOG_STALE_MS,
  });
  const specialDays = useQuery({
    queryKey: bookingKeys.specialDays,
    queryFn: async () => (await getSpecialDays()).data?.days ?? [],
    staleTime: CATALOG_STALE_MS,
  });
  return { products, employees, hours, specialDays };
}

export function useEmployeeCalendar(employeeId: string | undefined) {
  return useQuery({
    queryKey: bookingKeys.employeeSchedule(employeeId ?? ''),
    enabled: Boolean(employeeId),
    staleTime: CATALOG_STALE_MS,
    queryFn: async ({ signal }) => {
      const res = await getEmployeeSchedule(employeeId as string, { signal });
      return {
        hours: res.data?.usesCustomHours ? res.data.hours : null,
        specialDays: res.data?.specialDays ?? [],
      };
    },
  });
}

export function useDaySlots(
  employeeId: string | undefined,
  productId: string | undefined,
  date: string | undefined,
) {
  return useQuery({
    queryKey: bookingKeys.slots(employeeId ?? '', productId ?? '', date ?? ''),
    enabled: Boolean(employeeId && productId && date),
    // A grade muda a qualquer momento (outra pessoa reserva): sempre conferida de novo ao voltar.
    staleTime: 0,
    queryFn: ({ signal }) =>
      fetchDaySlots(employeeId as string, productId as string, date as string, signal),
  });
}

export interface NextAvailable {
  dateKey: string;
  slot: AvailabilitySlot;
}

interface CalendarRules {
  hours: BusinessHour[];
  specialDays: SpecialDay[];
  employeeHours: BusinessHour[] | null;
  employeeSpecialDays: SpecialDay[];
  /** Último dia que pode ser reservado (cliente). Sem limite para o admin. */
  maxDateKey?: string;
}

async function findNextAvailable(
  queryClient: QueryClient,
  employeeId: string,
  productId: string,
  afterDate: string,
  rules: CalendarRules,
  signal: AbortSignal,
): Promise<NextAvailable | null> {
  let checked = 0;
  for (let offset = 1; offset <= 60 && checked < NEXT_AVAILABLE_DAYS; offset += 1) {
    const dateKey = addDateKey(afterDate, offset);
    if (rules.maxDateKey && dateKey > rules.maxDateKey) return null;
    if (
      rules.hours.length > 0 &&
      isClosedDate(
        dateKey,
        rules.hours,
        rules.specialDays,
        rules.employeeHours,
        rules.employeeSpecialDays,
      )
    ) {
      continue;
    }
    if (signal.aborted) return null;
    checked += 1;
    // Passa pelo mesmo cache da grade: se a pessoa aceitar a sugestão, o dia já está carregado.
    const day = await queryClient.fetchQuery({
      queryKey: bookingKeys.slots(employeeId, productId, dateKey),
      queryFn: () => fetchDaySlots(employeeId, productId, dateKey, signal),
      staleTime: 30_000,
    });
    const slot = day.slots.find((item) => item.available);
    if (slot) return { dateKey, slot };
  }
  return null;
}

/**
 * UX-07: quando o dia escolhido não tem vaga (ou está fechado), procura o próximo dia com
 * horário livre para a tela oferecer um atalho, em vez de deixar a pessoa clicando dia a dia.
 */
export function useNextAvailable(
  enabled: boolean,
  employeeId: string | undefined,
  productId: string | undefined,
  afterDate: string | undefined,
  rules: CalendarRules,
) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['booking', 'next-available', employeeId, productId, afterDate, rules.maxDateKey],
    enabled: enabled && Boolean(employeeId && productId && afterDate),
    staleTime: 30_000,
    retry: false,
    queryFn: ({ signal }) =>
      findNextAvailable(
        queryClient,
        employeeId as string,
        productId as string,
        afterDate as string,
        rules,
        signal,
      ),
  });
}
