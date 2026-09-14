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

export function isClosedDate(
  dateKey: string,
  hours: Array<{ dayOfWeek: number; isClosed: boolean }>,
  specialDays: Array<{ date: string; isClosed: boolean }>,
) {
  const special = specialDays.find((day) => specialDayKey(day.date) === dateKey);
  if (special) return special.isClosed;
  const hour = hours.find((item) => item.dayOfWeek === weekdayFromDateKey(dateKey));
  return hour?.isClosed ?? false;
}

export function nextOpenDateKey(
  hours: Array<{ dayOfWeek: number; isClosed: boolean }>,
  specialDays: Array<{ date: string; isClosed: boolean }>,
  from = todayDateKey(),
) {
  if (hours.length === 0) return from;
  for (let offset = 0; offset < 60; offset += 1) {
    const key = addDateKey(from, offset);
    if (!isClosedDate(key, hours, specialDays)) return key;
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
