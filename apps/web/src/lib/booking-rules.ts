import { addDateKey, todayDateKey } from './datetime';

/** Espelha `apps/api/src/lib/booking-rules.ts`: a API é quem garante, o front só evita o erro. */
export const MAX_BOOKING_DAYS_AHEAD = 60;

/** Último dia (`YYYY-MM-DD`, São Paulo) em que o cliente pode reservar. */
export function lastBookableDateKey() {
  return addDateKey(todayDateKey(), MAX_BOOKING_DAYS_AHEAD);
}
