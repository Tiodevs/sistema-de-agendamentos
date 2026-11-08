import { addCalendarDays, dateKeyFromInstant } from './datetime';

/**
 * Regras da reserva feita pelo próprio cliente em `/appointments/book` (SEC-02). O admin, ao
 * marcar pelo painel, não passa por elas. O front repete os números em `apps/web/src/lib/booking-rules.ts`.
 */

/** Agendamentos futuros ativos (marcado ou confirmado) que um cliente pode ter ao mesmo tempo. */
export const MAX_UPCOMING_BOOKINGS_PER_CLIENT = 3;

/** Antecedência máxima, em dias de calendário de São Paulo (hoje + 60). */
export const MAX_BOOKING_DAYS_AHEAD = 60;

export const UPCOMING_BOOKING_STATUSES = ['SCHEDULED', 'CONFIRMED'] as const;

/** Último dia (`YYYY-MM-DD`) em que o cliente pode reservar. */
export function lastBookableDateKey(now = new Date()) {
  return dateKeyFromInstant(addCalendarDays(now, MAX_BOOKING_DAYS_AHEAD));
}

export function isBeyondBookingWindow(start: Date, now = new Date()) {
  return dateKeyFromInstant(start) > lastBookableDateKey(now);
}
