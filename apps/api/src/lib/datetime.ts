export const TIME_ZONE = 'America/Sao_Paulo';

/** Civil date `YYYY-MM-DD` in the given IANA time zone. */
export function dateKeyFromInstant(date: Date, timeZone = TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** UTC midnight for a `DATE` column lookup (`special_days.date`). */
export function calendarDateUtc(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/** 0 = Sunday … 6 = Saturday for a civil date key, independent of server TZ. */
export function weekdayFromDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function zonedParts(date: Date, timeZone = TIME_ZONE): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

/** Instant whose wall clock in America/Sao_Paulo is the given civil date/time. */
export function zonedDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
) {
  const normalized = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  const y = normalized.getUTCFullYear();
  const mo = normalized.getUTCMonth() + 1;
  const d = normalized.getUTCDate();
  const h = normalized.getUTCHours();
  const mi = normalized.getUTCMinutes();
  const s = normalized.getUTCSeconds();
  const ms = normalized.getUTCMilliseconds();
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi, s);
  const shown = zonedParts(new Date(utcGuess));
  const asIfLocal = Date.UTC(
    shown.year,
    shown.month - 1,
    shown.day,
    shown.hour,
    shown.minute,
    shown.second,
  );
  return new Date(utcGuess - (asIfLocal - utcGuess) + ms);
}

export function zonedDateFromKeyAndTime(dateKey: string, timeHHmm: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = timeHHmm.split(':').map(Number);
  return zonedDate(year, month, day, hour, minute, 0, 0);
}

export function startOfZonedDay(date: Date) {
  const parts = zonedParts(date);
  return zonedDate(parts.year, parts.month, parts.day, 0, 0, 0, 0);
}

export function endOfZonedDay(date: Date) {
  const parts = zonedParts(date);
  return zonedDate(parts.year, parts.month, parts.day, 23, 59, 59, 999);
}

export function addCalendarDays(date: Date, days: number) {
  const parts = zonedParts(date);
  return zonedDate(parts.year, parts.month, parts.day + days, 0, 0, 0, 0);
}

export function startOfMonday(date: Date) {
  const parts = zonedParts(date);
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day);
  const dayOfWeek = new Date(utc).getUTCDay();
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return zonedDate(parts.year, parts.month, parts.day - offset, 0, 0, 0, 0);
}

export function enumerateCalendarDays(start: Date, end: Date) {
  const startParts = zonedParts(start);
  const endParts = zonedParts(end);
  const days: Array<{ year: number; month: number; day: number; dayOfWeek: number }> = [];
  let cursor = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
  const last = Date.UTC(endParts.year, endParts.month - 1, endParts.day);

  while (cursor <= last) {
    const date = new Date(cursor);
    days.push({
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      dayOfWeek: date.getUTCDay(),
    });
    cursor += 24 * 60 * 60 * 1000;
  }

  return days;
}

export function formatDayLabel(date: Date) {
  const weekday = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    timeZone: TIME_ZONE,
  })
    .format(date)
    .replace('.', '')
    .slice(0, 3);

  const day = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    timeZone: TIME_ZONE,
  }).format(date);

  return `${weekday} ${day}`;
}

export function formatDayTooltip(date: Date) {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: TIME_ZONE,
  }).format(date);

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatWeekLabel(start: Date, end: Date) {
  const startDay = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    timeZone: TIME_ZONE,
  }).format(start);
  const endDay = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    timeZone: TIME_ZONE,
  }).format(end);

  return `${startDay}–${endDay}`;
}

export function formatWeekTooltip(start: Date, end: Date) {
  const startLabel = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    timeZone: TIME_ZONE,
  }).format(start);
  const endLabel = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    timeZone: TIME_ZONE,
  }).format(end);

  return `${startLabel} – ${endLabel}`;
}

export function formatHourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}h`;
}

export function formatRangeLabel(start: Date, end: Date) {
  const startParts = zonedParts(start);
  const endParts = zonedParts(end);
  const sameDay =
    startParts.year === endParts.year &&
    startParts.month === endParts.month &&
    startParts.day === endParts.day;

  if (sameDay) {
    const formatted = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: TIME_ZONE,
    }).format(start);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  const startLabel = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    timeZone: TIME_ZONE,
  }).format(start);
  const endLabel = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(end);

  return `${startLabel} – ${endLabel}`;
}
