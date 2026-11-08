import { zonedDateFromKeyAndTime } from './datetime';
import {
  resolveHoursForDate,
  type DayHours,
  type HourLike,
  type SpecialLike,
} from './schedule-hours';

/**
 * Regras puras do DOM-02: dado o expediente antes e depois de uma mudança, quais agendamentos
 * marcados deixam de caber. O acesso ao banco fica no `ScheduleImpactService`.
 */

export type SpecialOverride = { dateKey: string; special: Omit<SpecialLike, 'date'> | null };

export interface ScheduleConfig {
  studioHours: HourLike[];
  studioSpecials: SpecialLike[];
  employeeHours: HourLike[];
  employeeSpecials: SpecialLike[];
}

/** Mudança pendente de expediente. Campos ausentes ficam como estão no banco. */
export interface ScheduleChange {
  /** Mudança de um profissional só: os outros não são afetados. */
  employeeId?: string;
  /** Mudança que só mexe nestas datas (dias especiais). */
  dateKeys?: string[];
  /** Novo expediente semanal do estúdio. */
  studioHours?: HourLike[];
  /** Dias especiais do estúdio criados, alterados (`special`) ou removidos (`null`). */
  studioSpecials?: SpecialOverride[];
  /** Novo expediente semanal do profissional; `[]` volta a seguir o do estúdio. */
  employeeHours?: HourLike[];
  /** Exceções do profissional criadas, alteradas ou removidas. */
  employeeSpecials?: SpecialOverride[];
}

function specialKey(date: Date | string) {
  return typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10);
}

export function applySpecialOverrides(
  specials: SpecialLike[],
  overrides: SpecialOverride[] = [],
): SpecialLike[] {
  if (overrides.length === 0) return specials;
  const touched = new Set(overrides.map((item) => item.dateKey));
  const kept = specials.filter((item) => !touched.has(specialKey(item.date)));
  const added = overrides
    .filter((item): item is SpecialOverride & { special: Omit<SpecialLike, 'date'> } =>
      Boolean(item.special),
    )
    .map((item) => ({ ...item.special, date: item.dateKey }));
  return [...kept, ...added];
}

/** O expediente que valeria para `employeeId` depois de `change`. */
export function applyScheduleChange(
  config: ScheduleConfig,
  change: ScheduleChange,
  employeeId: string,
): ScheduleConfig {
  const targetsEmployee = change.employeeId === employeeId;
  return {
    studioHours: change.studioHours ?? config.studioHours,
    studioSpecials: applySpecialOverrides(config.studioSpecials, change.studioSpecials),
    employeeHours:
      targetsEmployee && change.employeeHours !== undefined
        ? change.employeeHours
        : config.employeeHours,
    employeeSpecials: targetsEmployee
      ? applySpecialOverrides(config.employeeSpecials, change.employeeSpecials)
      : config.employeeSpecials,
  };
}

export function hoursFor(config: ScheduleConfig, dateKey: string): DayHours {
  return resolveHoursForDate({
    dateKey,
    studioHours: config.studioHours,
    studioSpecials: config.studioSpecials,
    employeeHours: config.employeeHours,
    employeeSpecials: config.employeeSpecials,
  });
}

/** O atendimento inteiro cabe no expediente do dia (aberto, começa depois e termina antes). */
export function appointmentFitsHours(
  appointment: { date: Date; endDate: Date },
  hours: DayHours,
  dateKey: string,
) {
  if (hours.isClosed) return false;
  const open = zonedDateFromKeyAndTime(dateKey, hours.openTime);
  const close = zonedDateFromKeyAndTime(dateKey, hours.closeTime);
  return appointment.date >= open && appointment.endDate <= close;
}

/**
 * Afetado = cabia no expediente de antes e não cabe no de depois. Quem já estava fora (porque o
 * admin escolheu manter numa mudança anterior) não volta a ser listado a cada alteração.
 */
export function isAffectedByChange(
  appointment: { date: Date; endDate: Date },
  dateKey: string,
  before: ScheduleConfig,
  after: ScheduleConfig,
) {
  return (
    appointmentFitsHours(appointment, hoursFor(before, dateKey), dateKey) &&
    !appointmentFitsHours(appointment, hoursFor(after, dateKey), dateKey)
  );
}
