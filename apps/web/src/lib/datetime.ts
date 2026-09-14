export const TIME_ZONE = 'America/Sao_Paulo';

export function todayDateKey(timeZone = TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function addDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function weekdayFromDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function specialDayKey(date: string) {
  return date.slice(0, 10);
}

type WeeklyHour = { dayOfWeek: number; isClosed: boolean; openTime?: string; closeTime?: string };
type SpecialLike = {
  date: string;
  isClosed: boolean;
  openTime?: string | null;
  closeTime?: string | null;
};

export type DayHours = {
  isClosed: boolean;
  openTime: string;
  closeTime: string;
};

function weeklyHoursForDate(hours: WeeklyHour[], weekday: number): DayHours {
  const hour = hours.find((item) => item.dayOfWeek === weekday);
  if (!hour) return { isClosed: false, openTime: '08:00', closeTime: '18:00' };
  return {
    isClosed: hour.isClosed,
    openTime: hour.openTime || '08:00',
    closeTime: hour.closeTime || '18:00',
  };
}

function specialHoursForDate(specials: SpecialLike[], dateKey: string): DayHours | undefined {
  const special = specials.find((day) => specialDayKey(day.date) === dateKey);
  if (!special) return undefined;
  return {
    isClosed: special.isClosed,
    openTime: special.openTime || '08:00',
    closeTime: special.closeTime || '18:00',
  };
}

function intersectDayHours(studio: DayHours, employee: DayHours): DayHours {
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

export function resolveHoursForDate(
  dateKey: string,
  hours: WeeklyHour[],
  specialDays: SpecialLike[],
  employeeHours?: WeeklyHour[] | null,
  employeeSpecialDays?: SpecialLike[] | null,
): DayHours {
  const weekday = weekdayFromDateKey(dateKey);
  const studioWeekly = weeklyHoursForDate(hours, weekday);
  const studio = specialHoursForDate(specialDays, dateKey) ?? studioWeekly;
  const customHours = employeeHours && employeeHours.length > 0 ? employeeHours : null;
  const employeeSpecial = specialHoursForDate(employeeSpecialDays ?? [], dateKey);

  if (!customHours && !employeeSpecial) return studio;

  const employeeWeekly = customHours ? weeklyHoursForDate(customHours, weekday) : studioWeekly;
  const employee = employeeSpecial ?? employeeWeekly;
  return intersectDayHours(studio, employee);
}

export function isClosedDate(
  dateKey: string,
  hours: WeeklyHour[],
  specialDays: SpecialLike[],
  employeeHours?: WeeklyHour[] | null,
  employeeSpecialDays?: SpecialLike[] | null,
) {
  return resolveHoursForDate(dateKey, hours, specialDays, employeeHours, employeeSpecialDays)
    .isClosed;
}

export function nextOpenDateKey(
  hours: WeeklyHour[],
  specialDays: SpecialLike[],
  from = todayDateKey(),
  employeeHours?: WeeklyHour[] | null,
  employeeSpecialDays?: SpecialLike[] | null,
) {
  if (hours.length === 0) return from;
  for (let offset = 0; offset < 60; offset += 1) {
    const key = addDateKey(from, offset);
    if (!isClosedDate(key, hours, specialDays, employeeHours, employeeSpecialDays)) return key;
  }
  return from;
}

export function formatLongDate(dateKey: string) {
  const formatted = new Date(`${dateKey}T12:00:00-03:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIME_ZONE,
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
