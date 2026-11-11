// Pausas do expediente (UX-12): regras puras do formulário, espelhando o que a API valida. Sem
// imports com "@/": os testes de apps/web/test rodam com node:test via tsx, fora do Next.

export interface BreakRange {
  start: string;
  end: string;
}

export interface DayHoursDraft {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
  breaks?: BreakRange[];
}

export const MAX_BREAKS_PER_DAY = 4;

/** O dia como vai para a API. `keepBreaks: false` descarta as pausas (herdadas do estúdio). */
export function toHourPayload<T extends DayHoursDraft>(hour: T, keepBreaks = true): DayHoursDraft {
  return {
    dayOfWeek: hour.dayOfWeek,
    openTime: hour.openTime,
    closeTime: hour.closeTime,
    isClosed: hour.isClosed,
    breaks: keepBreaks && !hour.isClosed ? (hour.breaks ?? []).map((item) => ({ ...item })) : [],
  };
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function toTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * Pausa sugerida ao tocar em "Adicionar pausa": 12:00–13:00 quando cabe no expediente e está
 * livre; senão, uma hora (ou o que couber) logo depois da última pausa.
 */
export function suggestBreak(hour: DayHoursDraft): BreakRange | null {
  const breaks = hour.breaks ?? [];
  if (hour.isClosed || breaks.length >= MAX_BREAKS_PER_DAY) return null;
  const open = toMinutes(hour.openTime);
  const close = toMinutes(hour.closeTime);
  if (!(open < close)) return null;

  const lunch = { start: '12:00', end: '13:00' };
  const fits = (range: BreakRange) =>
    toMinutes(range.start) >= open &&
    toMinutes(range.end) <= close &&
    breaks.every((item) => range.end <= item.start || range.start >= item.end);
  if (fits(lunch)) return lunch;

  const lastEnd = breaks.reduce((latest, item) => Math.max(latest, toMinutes(item.end)), open);
  const start = Math.min(lastEnd + (breaks.length > 0 ? 60 : 0), close - 15);
  const end = Math.min(start + 60, close);
  const candidate = { start: toTime(Math.max(start, open)), end: toTime(end) };
  return candidate.start < candidate.end && fits(candidate) ? candidate : null;
}

/** O que está errado nas pausas do dia, na ordem em que a API recusaria; `null` se está tudo certo. */
export function breaksError(hour: DayHoursDraft): string | null {
  const breaks = hour.breaks ?? [];
  if (hour.isClosed || breaks.length === 0) return null;
  if (breaks.length > MAX_BREAKS_PER_DAY) return `No máximo ${MAX_BREAKS_PER_DAY} pausas por dia`;

  const sorted = [...breaks].sort((left, right) => left.start.localeCompare(right.start));
  let previousEnd = '';
  for (const range of sorted) {
    if (!range.start || !range.end) return 'Preencha o início e o fim da pausa';
    if (range.start >= range.end) return 'O início da pausa deve ser anterior ao fim';
    if (range.start < hour.openTime || range.end > hour.closeTime) {
      return 'A pausa precisa ficar dentro do horário de atendimento do dia';
    }
    if (previousEnd && range.start < previousEnd) return 'As pausas do dia não podem se sobrepor';
    previousEnd = range.end;
  }
  return null;
}

/** Primeiro problema de pausa na semana, com o índice do dia, para a tela apontar onde está. */
export function firstBreaksError(
  hours: DayHoursDraft[],
): { index: number; message: string } | null {
  for (let index = 0; index < hours.length; index += 1) {
    const message = breaksError(hours[index]);
    if (message) return { index, message };
  }
  return null;
}
