// Helpers puros dos dois assistentes de agendamento (cliente em /book e admin em
// /admin/appointments/new). Sem imports com "@/": os testes de apps/web/test rodam com
// node:test via tsx, fora do Next.

/** Fuso do estúdio: grade, resumo e reserva usam o mesmo relógio. */
export const BOOKING_TIME_ZONE = 'America/Sao_Paulo';

/** Mesmo teto da API para `notes` (schema de agendamento). */
export const NOTES_MAX_LENGTH = 500;

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BOOKING_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Dia (AAAA-MM-DD, no fuso do estúdio) em que o horário começa. */
export function slotDateKey(isoStart: string): string {
  const parts = dateKeyFormatter.formatToParts(new Date(isoStart));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** "09:30" no fuso do estúdio. */
export function formatSlotTime(isoStart: string): string {
  return new Date(isoStart).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: BOOKING_TIME_ZONE,
  });
}

/** "11/11/2026" a partir de uma data AAAA-MM-DD. */
export function formatDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
}

/** Data do próprio horário: o resumo nunca mostra um dia diferente do que vai ser reservado. */
export function formatSlotDate(isoStart: string): string {
  return formatDateKey(slotDateKey(isoStart));
}

/** Só os horários que começam no dia pedido: resposta de outro dia nunca entra na grade. */
export function slotsForDate<T extends { start: string }>(
  slots: readonly T[],
  dateKey: string,
): T[] {
  return slots.filter((slot) => slotDateKey(slot.start) === dateKey);
}

type EmployeeWithProducts = { products: ReadonlyArray<{ product: { id: string } }> };

export function offersProduct(employee: EmployeeWithProducts, productId: string): boolean {
  return employee.products.some((item) => item.product.id === productId);
}

/** Profissionais que fazem o serviço, derivados da lista já carregada. */
export function employeesForProduct<T extends EmployeeWithProducts>(
  employees: readonly T[],
  productId: string | null | undefined,
): T[] {
  if (!productId) return [];
  return employees.filter((employee) => offersProduct(employee, productId));
}
