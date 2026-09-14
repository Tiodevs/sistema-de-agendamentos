import { zonedDateFromKeyAndTime } from './datetime';

export const SLOT_INTERVAL_MINUTES = 15;

export function dayBounds(dateKey: string, openTime: string, closeTime: string) {
  return {
    dayStart: zonedDateFromKeyAndTime(dateKey, openTime),
    dayEnd: zonedDateFromKeyAndTime(dateKey, closeTime),
  };
}

export function enumerateSlots(dayStart: Date, dayEnd: Date, durationMinutes: number) {
  const durationMs = durationMinutes * 60 * 1000;
  const stepMs = SLOT_INTERVAL_MINUTES * 60 * 1000;
  const slots: { start: Date; end: Date }[] = [];
  let current = dayStart.getTime();

  while (current + durationMs <= dayEnd.getTime()) {
    slots.push({ start: new Date(current), end: new Date(current + durationMs) });
    current += stepMs;
  }

  return slots;
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
