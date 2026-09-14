import { weekdayFromDateKey } from './datetime';

export type HourLike = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
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
};

function specialDateKey(date: Date | string) {
  if (typeof date === 'string') return date.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function weeklyHoursForDate(hours: HourLike[], weekday: number): DayHours {
  const hour = hours.find((item) => item.dayOfWeek === weekday);
  if (!hour) {
    return { isClosed: false, openTime: '08:00', closeTime: '18:00' };
  }
  return {
    isClosed: hour.isClosed,
    openTime: hour.openTime,
    closeTime: hour.closeTime,
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
  };
}

export function intersectDayHours(studio: DayHours, employee: DayHours): DayHours {
  if (studio.isClosed || employee.isClosed) {
    return { isClosed: true, openTime: studio.openTime, closeTime: studio.closeTime };
  }

  const openTime = studio.openTime > employee.openTime ? studio.openTime : employee.openTime;
  const closeTime = studio.closeTime < employee.closeTime ? studio.closeTime : employee.closeTime;
  if (openTime >= closeTime) {
    return { isClosed: true, openTime, closeTime };
  }

  return { isClosed: false, openTime, closeTime };
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
