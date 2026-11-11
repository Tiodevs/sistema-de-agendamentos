import { weekdayFromDateKey } from './datetime';

/** Pausa dentro do expediente (UX-12), ex.: almoço das 12:00 às 13:00. */
export type TimeRange = { start: string; end: string };

export type HourLike = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
  /** Como vem do banco (JSON) ou do formulário; lido com `parseBreaks`. */
  breaks?: unknown;
};

export type SpecialLike = {
  date: Date | string;
  isClosed: boolean;
  openTime?: string | null;
  closeTime?: string | null;
};

export type DayHours = {
  isClosed: boolean;
  openTime: string;
  closeTime: string;
  /** Pausas do dia, em ordem. Vazio quando não há. */
  breaks: TimeRange[];
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Lê as pausas gravadas (JSON). Item fora do formato `{ start, end }` com início antes do fim é ignorado. */
export function parseBreaks(value: unknown): TimeRange[] {
  if (!Array.isArray(value)) return [];
  const ranges: TimeRange[] = [];
  for (const item of value) {
    const range = item as Partial<TimeRange> | null;
    if (
      range &&
      typeof range.start === 'string' &&
      typeof range.end === 'string' &&
      TIME.test(range.start) &&
      TIME.test(range.end) &&
      range.start < range.end
    ) {
      ranges.push({ start: range.start, end: range.end });
    }
  }
  return ranges.sort((left, right) => left.start.localeCompare(right.start));
}

/** Junta as pausas do estúdio e do profissional, fundindo as que se encostam ou se sobrepõem. */
export function mergeBreaks(...lists: TimeRange[][]): TimeRange[] {
  const sorted = lists.flat().sort((left, right) => left.start.localeCompare(right.start));
  const merged: TimeRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      if (range.end > last.end) last.end = range.end;
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

/**
 * Expediente padrão do estúdio. A migration `20261108120000_reliable_schedule` grava estes valores
 * quando a tabela está vazia; aqui eles só servem de fallback em memória (DOM-07: GET não grava).
 */
export const DEFAULT_STUDIO_HOURS: readonly HourLike[] = [
  { dayOfWeek: 0, openTime: '08:00', closeTime: '18:00', isClosed: true },
  { dayOfWeek: 1, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 2, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 3, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 4, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 5, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 6, openTime: '08:00', closeTime: '12:00', isClosed: false },
];

function specialDateKey(date: Date | string) {
  if (typeof date === 'string') return date.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function weeklyHoursForDate(hours: HourLike[], weekday: number): DayHours {
  const hour = hours.find((item) => item.dayOfWeek === weekday);
  if (!hour) {
    return { isClosed: false, openTime: '08:00', closeTime: '18:00', breaks: [] };
  }
  return {
    isClosed: hour.isClosed,
    openTime: hour.openTime,
    closeTime: hour.closeTime,
    breaks: hour.isClosed ? [] : parseBreaks(hour.breaks),
  };
}

export function specialHoursForDate(
  specials: SpecialLike[],
  dateKey: string,
): DayHours | undefined {
  const special = specials.find((item) => specialDateKey(item.date) === dateKey);
  if (!special) return undefined;
  return {
    isClosed: special.isClosed,
    openTime: special.openTime || '08:00',
    closeTime: special.closeTime || '18:00',
    // Dia especial tem horário próprio: as pausas da semana não valem nele.
    breaks: [],
  };
}

export function intersectDayHours(studio: DayHours, employee: DayHours): DayHours {
  if (studio.isClosed || employee.isClosed) {
    return { isClosed: true, openTime: studio.openTime, closeTime: studio.closeTime, breaks: [] };
  }

  const openTime = studio.openTime > employee.openTime ? studio.openTime : employee.openTime;
  const closeTime = studio.closeTime < employee.closeTime ? studio.closeTime : employee.closeTime;
  if (openTime >= closeTime) {
    return { isClosed: true, openTime, closeTime, breaks: [] };
  }

  // O profissional só atende quando o estúdio está aberto e fora das pausas dos dois.
  return {
    isClosed: false,
    openTime,
    closeTime,
    breaks: mergeBreaks(studio.breaks, employee.breaks),
  };
}

export function resolveHoursForDate(options: {
  dateKey: string;
  studioHours: HourLike[];
  studioSpecials: SpecialLike[];
  employeeHours?: HourLike[] | null;
  employeeSpecials?: SpecialLike[] | null;
}): DayHours {
  const weekday = weekdayFromDateKey(options.dateKey);
  const studioWeekly = weeklyHoursForDate(options.studioHours, weekday);
  const studio = specialHoursForDate(options.studioSpecials, options.dateKey) ?? studioWeekly;

  const customHours =
    options.employeeHours && options.employeeHours.length > 0 ? options.employeeHours : null;
  const employeeSpecial = specialHoursForDate(options.employeeSpecials ?? [], options.dateKey);

  if (!customHours && !employeeSpecial) return studio;

  const employeeWeekly = customHours ? weeklyHoursForDate(customHours, weekday) : studioWeekly;
  const employee = employeeSpecial ?? employeeWeekly;
  return intersectDayHours(studio, employee);
}
