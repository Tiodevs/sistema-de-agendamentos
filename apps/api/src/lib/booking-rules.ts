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

/**
 * Antecedência mínima para o cliente cancelar sozinho (DOM-09) e para o profissional cancelar
 * pelo painel (DOM-03). Depois do prazo, só o estúdio cancela, ou o horário vira falta.
 * Configurável por `CANCELLATION_NOTICE_HOURS` (de 0 a 168, aceita fração: 0.5 = 30 min).
 */
export const DEFAULT_CANCELLATION_NOTICE_HOURS = 2;
const MAX_CANCELLATION_NOTICE_HOURS = 168;

export function cancellationNoticeMinutes(raw = process.env.CANCELLATION_NOTICE_HOURS) {
  const value = raw === undefined || raw.trim() === '' ? NaN : Number(raw);
  const hours =
    Number.isFinite(value) && value >= 0 && value <= MAX_CANCELLATION_NOTICE_HOURS
      ? value
      : DEFAULT_CANCELLATION_NOTICE_HOURS;
  return Math.round(hours * 60);
}
