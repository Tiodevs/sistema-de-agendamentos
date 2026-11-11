import { zonedDateFromKeyAndTime } from './datetime';
import type { TimeRange } from './schedule-hours';

export const SLOT_INTERVAL_MINUTES = 15;

export function dayBounds(dateKey: string, openTime: string, closeTime: string) {
  return {
    dayStart: zonedDateFromKeyAndTime(dateKey, openTime),
    dayEnd: zonedDateFromKeyAndTime(dateKey, closeTime),
  };
}

export type Interval = { start: Date; end: Date };

/** As pausas do dia (`HH:mm`) como instantes, no fuso de São Paulo. */
export function breakIntervals(dateKey: string, breaks: TimeRange[] = []): Interval[] {
  return breaks.map((range) => ({
    start: zonedDateFromKeyAndTime(dateKey, range.start),
    end: zonedDateFromKeyAndTime(dateKey, range.end),
  }));
}

export function overlaps(left: Interval, right: Interval) {
  return left.start < right.end && left.end > right.start;
}

/**
 * Horários possíveis do dia, de 15 em 15 minutos. Um atendimento que encostaria numa pausa
 * (UX-12) não entra: o almoço cadastrado some da grade.
 */
export function enumerateSlots(
  dayStart: Date,
  dayEnd: Date,
  durationMinutes: number,
  blocked: Interval[] = [],
) {
  const durationMs = durationMinutes * 60 * 1000;
  const stepMs = SLOT_INTERVAL_MINUTES * 60 * 1000;
  const slots: Interval[] = [];
  let current = dayStart.getTime();

  while (current + durationMs <= dayEnd.getTime()) {
    const slot = { start: new Date(current), end: new Date(current + durationMs) };
    if (!blocked.some((interval) => overlaps(slot, interval))) slots.push(slot);
    current += stepMs;
  }

  return slots;
}

/**
 * O horário esbarra num atendimento já marcado, contando o respiro do profissional (UX-12): com
 * `bufferMinutes`, é preciso esse intervalo livre antes e depois de cada atendimento.
 */
export function conflictsWithBuffer(slot: Interval, appointment: Interval, bufferMinutes = 0) {
  const bufferMs = Math.max(0, bufferMinutes) * 60 * 1000;
  return (
    slot.start.getTime() < appointment.end.getTime() + bufferMs &&
    slot.end.getTime() + bufferMs > appointment.start.getTime()
  );
}

export function findMatchingSlot(slots: { start: Date; end: Date }[], start: Date) {
  const startMs = start.getTime();
  return slots.find((slot) => slot.start.getTime() === startMs);
}

export function isEmployeeOverlapError(error: unknown): boolean {
  const messages: string[] = [];
  let current: unknown = error;

  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (typeof current !== 'object') break;
    const record = current as {
      code?: string;
      message?: string;
      cause?: unknown;
      meta?: { code?: string };
    };
    if (record.code === '23P01' || record.meta?.code === '23P01') return true;
    if (record.message) messages.push(record.message);
    current = record.cause;
  }

  return messages.some((message) =>
    /23P01|exclusion|appointments_employee_no_overlap/i.test(message),
  );
}
