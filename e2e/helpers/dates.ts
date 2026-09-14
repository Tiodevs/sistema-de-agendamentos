const TIME_ZONE = 'America/Sao_Paulo';
const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export function todayKey(timeZone = TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return { year, month, day };
}

export function addDays(dateKey: string, days: number) {
  const instant = new Date(`${dateKey}T12:00:00-03:00`);
  instant.setUTCDate(instant.getUTCDate() + days);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** 0 = domingo … 6 = sábado, no calendário de São Paulo. */
export function weekdayOf(dateKey: string) {
  return new Date(`${dateKey}T12:00:00-03:00`).getUTCDay();
}

export function isSunday(dateKey: string) {
  return weekdayOf(dateKey) === 0;
}

export function nextSundayKey(from = todayKey()) {
  const weekday = weekdayOf(from);
  return weekday === 0 ? from : addDays(from, 7 - weekday);
}

export function christmasKey(from = todayKey()) {
  const year = Number(from.slice(0, 4));
  const thisYear = `${year}-12-25`;
  return thisYear >= from ? thisYear : `${year + 1}-12-25`;
}

export function yesterdayKey(from = todayKey()) {
  return addDays(from, -1);
}

export function saoPauloIso(dateKey: string, timeHHmm: string) {
  return new Date(`${dateKey}T${timeHHmm}:00-03:00`).toISOString();
}

export function formatSlotTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  });
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

export function monthName(dateKey: string) {
  return MONTHS[parseDateKey(dateKey).month - 1];
}
