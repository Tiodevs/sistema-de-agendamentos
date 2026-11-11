import { prisma } from '../config/database';
import { calendarDateUtc, formatDateKeyShort } from '../lib/datetime';
import { httpError } from '../lib/http-error';
import type { Prisma } from '@prisma/client';
import {
  DEFAULT_STUDIO_HOURS,
  parseBreaks,
  resolveHoursForDate,
  type HourLike,
  type TimeRange,
} from '../lib/schedule-hours';
import type { ScheduleChange, SpecialOverride } from '../lib/schedule-impact';
import {
  UpsertBusinessHourInput,
  CreateSpecialDayInput,
  UpdateSpecialDayInput,
  CreateEmployeeSpecialDayInput,
  UpdateEmployeeSpecialDayInput,
} from '../schemas/schedule.schema';
import type { StatusActorContext } from './appointment-status.service';
import { scheduleImpactService, type AffectedDecision } from './schedule-impact.service';

const DAY_NAMES = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

/** Quem salva e o que fazer com os agendamentos que ficariam fora do expediente (DOM-02). */
export interface ScheduleMutationOptions {
  actor: StatusActorContext;
  onAffected?: AffectedDecision;
}

type SpecialValues = { isClosed: boolean; openTime: string | null; closeTime: string | null };

function withDayName<T extends { dayOfWeek: number; breaks?: unknown }>(hour: T) {
  return { ...hour, breaks: parseBreaks(hour.breaks), dayName: DAY_NAMES[hour.dayOfWeek] };
}

/** Cada pausa precisa ficar dentro do expediente do dia e não se sobrepor a outra (UX-12). */
function assertBreaksInside(
  hour: { isClosed: boolean; openTime: string; closeTime: string },
  breaks: TimeRange[],
) {
  if (hour.isClosed) return;
  let previousEnd = hour.openTime;
  for (const range of breaks) {
    if (range.start < hour.openTime || range.end > hour.closeTime) {
      throw httpError('A pausa precisa ficar dentro do horário de atendimento do dia', 400);
    }
    if (range.start < previousEnd) {
      throw httpError('As pausas do dia não podem se sobrepor', 400);
    }
    previousEnd = range.end;
  }
}

function assertOpenBeforeClose(
  isClosed: boolean,
  openTime?: string | null,
  closeTime?: string | null,
) {
  if (isClosed) return;
  if (!openTime || !closeTime || openTime >= closeTime) {
    throw httpError('O horário de abertura deve ser anterior ao de fechamento', 400);
  }
}

/**
 * `previousBreaks`: as pausas já gravadas no dia, mantidas quando o formulário não manda `breaks`
 * (clientes antigos da API). Dia fechado não guarda pausa.
 */
function toHour(data: UpsertBusinessHourInput, previousBreaks: unknown = []) {
  const breaks = data.isClosed ? [] : parseBreaks(data.breaks ?? previousBreaks);
  assertBreaksInside(data, breaks);
  return {
    dayOfWeek: data.dayOfWeek,
    openTime: data.openTime,
    closeTime: data.closeTime,
    isClosed: data.isClosed,
    breaks: breaks as unknown as Prisma.InputJsonValue,
  } satisfies HourLike;
}

/** Valores do dia especial como ficam gravados (fechado não guarda horário). */
function specialValues(isClosed: boolean, openTime?: string | null, closeTime?: string | null) {
  return {
    isClosed,
    openTime: isClosed ? null : openTime || null,
    closeTime: isClosed ? null : closeTime || null,
  } satisfies SpecialValues;
}

function specialOverride(dateKey: string, values: SpecialValues | null): SpecialOverride {
  return { dateKey, special: values };
}

function studioSpecialReason(dateKey: string, title: string, values: SpecialValues | null) {
  const day = formatDateKeyShort(dateKey);
  const label = title.trim() ? ` (${title.trim()})` : '';
  if (!values) return `Mudança no horário do estúdio em ${day}.`;
  if (values.isClosed) return `O estúdio estará fechado em ${day}${label}.`;
  return `O estúdio terá horário especial em ${day}${label}, das ${values.openTime} às ${values.closeTime}.`;
}

function employeeSpecialReason(
  employeeName: string,
  dateKey: string,
  values: SpecialValues | null,
) {
  const day = formatDateKeyShort(dateKey);
  if (values && !values.isClosed) {
    return `${employeeName} terá um horário diferente em ${day}, das ${values.openTime} às ${values.closeTime}.`;
  }
  // O título da exceção do profissional (folga, médico…) não vai para o cliente.
  return values
    ? `${employeeName} não vai atender em ${day}.`
    : `Mudança na agenda de ${employeeName} em ${day}.`;
}

function specialDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export class ScheduleService {
  /** DOM-07: só leitura. O padrão é gravado pela migration; aqui ele é só um fallback. */
  async getBusinessHours() {
    const hours = await prisma.businessHour.findMany({
      orderBy: { dayOfWeek: 'asc' },
    });

    if (hours.length === 0) {
      return DEFAULT_STUDIO_HOURS.map((hour) =>
        withDayName({ id: `default-${hour.dayOfWeek}`, ...hour, createdAt: null, updatedAt: null }),
      );
    }

    return hours.map(withDayName);
  }

  async upsertBusinessHour(data: UpsertBusinessHourInput, options: ScheduleMutationOptions) {
    const saved = await this.saveBusinessHours([data], options);
    const hour = saved.hours.find((item) => item.dayOfWeek === data.dayOfWeek);
    return { hour, impact: saved.impact };
  }

  /** Grava o expediente da semana: valida tudo antes e salva numa transação só (tudo ou nada). */
  async upsertAllBusinessHours(hours: UpsertBusinessHourInput[], options: ScheduleMutationOptions) {
    return this.saveBusinessHours(hours, options);
  }

  private async saveBusinessHours(
    hours: UpsertBusinessHourInput[],
    options: ScheduleMutationOptions,
  ) {
    for (const hour of hours) {
      assertOpenBeforeClose(hour.isClosed, hour.openTime, hour.closeTime);
    }

    const current = await prisma.businessHour.findMany();
    const byDay = new Map<number, HourLike>(
      (current.length > 0 ? current : DEFAULT_STUDIO_HOURS).map((hour) => [hour.dayOfWeek, hour]),
    );
    const next = hours.map((hour) => toHour(hour, byDay.get(hour.dayOfWeek)?.breaks));
    for (const hour of next) byDay.set(hour.dayOfWeek, hour);
    const change: ScheduleChange = { studioHours: [...byDay.values()] };

    const affected = await scheduleImpactService.findAffected(change);
    scheduleImpactService.requireDecision(affected, options.onAffected, 'fora do novo horário');

    const reason = 'Mudança no horário de funcionamento do estúdio.';
    const { result, impact } = await scheduleImpactService.commit(
      affected,
      options.onAffected,
      options.actor,
      reason,
      async (tx) => {
        const saved = [];
        for (const hour of next) {
          const { dayOfWeek, ...values } = hour;
          saved.push(
            await tx.businessHour.upsert({
              where: { dayOfWeek },
              create: hour,
              update: values,
            }),
          );
        }
        return saved;
      },
    );

    return {
      hours: result.sort((left, right) => left.dayOfWeek - right.dayOfWeek).map(withDayName),
      impact,
    };
  }

  async getHoursForDate(dateStr: string, employeeId?: string) {
    const dateObj = calendarDateUtc(dateStr);

    const [studioHours, studioSpecials, employeeHours, employeeSpecials] = await Promise.all([
      prisma.businessHour.findMany({ orderBy: { dayOfWeek: 'asc' } }),
      prisma.specialDay.findMany({ where: { date: dateObj } }),
      employeeId
        ? prisma.employeeBusinessHour.findMany({
            where: { employeeId },
            orderBy: { dayOfWeek: 'asc' },
          })
        : Promise.resolve([]),
      employeeId
        ? prisma.employeeSpecialDay.findMany({
            where: { employeeId, date: dateObj },
          })
        : Promise.resolve([]),
    ]);

    return resolveHoursForDate({
      dateKey: dateStr,
      studioHours: studioHours.length > 0 ? studioHours : [...DEFAULT_STUDIO_HOURS],
      studioSpecials,
      employeeHours,
      employeeSpecials,
    });
  }

  async getSpecialDays() {
    const days = await prisma.specialDay.findMany({
      orderBy: { date: 'asc' },
    });

    return days.map(mapSpecialDay);
  }

  async createSpecialDay(data: CreateSpecialDayInput, options: ScheduleMutationOptions) {
    const dateObj = calendarDateUtc(data.date);

    const existing = await prisma.specialDay.findUnique({
      where: { date: dateObj },
    });

    if (existing) {
      throw httpError('Já existe um dia especial cadastrado para esta data', 409);
    }

    const isClosed = data.isClosed ?? true;
    assertOpenBeforeClose(isClosed, data.openTime, data.closeTime);
    const values = specialValues(isClosed, data.openTime, data.closeTime);

    const affected = await scheduleImpactService.findAffected({
      dateKeys: [data.date],
      studioSpecials: [specialOverride(data.date, values)],
    });
    scheduleImpactService.requireDecision(affected, options.onAffected, 'sem atendimento');

    const { result, impact } = await scheduleImpactService.commit(
      affected,
      options.onAffected,
      options.actor,
      studioSpecialReason(data.date, data.title, values),
      (tx) =>
        tx.specialDay.create({
          data: {
            date: dateObj,
            title: data.title,
            description: data.description || null,
            ...values,
          },
        }),
    );

    return { day: mapSpecialDay(result), impact };
  }

  async updateSpecialDay(
    id: string,
    data: UpdateSpecialDayInput,
    options: ScheduleMutationOptions,
  ) {
    const existing = await prisma.specialDay.findUnique({ where: { id } });
    if (!existing) {
      throw httpError('Dia especial não encontrado', 404);
    }

    const isClosed = data.isClosed ?? existing.isClosed;
    const openTime = data.openTime !== undefined ? data.openTime : existing.openTime;
    const closeTime = data.closeTime !== undefined ? data.closeTime : existing.closeTime;
    assertOpenBeforeClose(isClosed, openTime, closeTime);

    const oldKey = specialDateKey(existing.date);
    const newKey = data.date ?? oldKey;
    if (newKey !== oldKey) {
      const clash = await prisma.specialDay.findUnique({
        where: { date: calendarDateUtc(newKey) },
      });
      if (clash) {
        throw httpError('Já existe um dia especial cadastrado para esta data', 409);
      }
    }

    const values = specialValues(isClosed, openTime, closeTime);
    const overrides = [specialOverride(newKey, values)];
    if (newKey !== oldKey) overrides.push(specialOverride(oldKey, null));

    const affected = await scheduleImpactService.findAffected({
      dateKeys: [oldKey, newKey],
      studioSpecials: overrides,
    });
    scheduleImpactService.requireDecision(affected, options.onAffected, 'sem atendimento');

    const { result, impact } = await scheduleImpactService.commit(
      affected,
      options.onAffected,
      options.actor,
      studioSpecialReason(newKey, data.title ?? existing.title, values),
      (tx) =>
        tx.specialDay.update({
          where: { id },
          data: {
            ...(data.date !== undefined && { date: calendarDateUtc(data.date) }),
            ...(data.title !== undefined && { title: data.title }),
            ...(data.description !== undefined && { description: data.description || null }),
            ...values,
          },
        }),
    );

    return { day: mapSpecialDay(result), impact };
  }

  /** Remover um dia especial também pode fechar o dia (ex.: um domingo que abriria excepcionalmente). */
  async deleteSpecialDay(id: string, options: ScheduleMutationOptions) {
    const existing = await prisma.specialDay.findUnique({ where: { id } });
    if (!existing) {
      throw httpError('Dia especial não encontrado', 404);
    }

    const dateKey = specialDateKey(existing.date);
    const affected = await scheduleImpactService.findAffected({
      dateKeys: [dateKey],
      studioSpecials: [specialOverride(dateKey, null)],
    });
    scheduleImpactService.requireDecision(affected, options.onAffected, 'sem atendimento');

    const { impact } = await scheduleImpactService.commit(
      affected,
      options.onAffected,
      options.actor,
      studioSpecialReason(dateKey, existing.title, null),
      (tx) => tx.specialDay.delete({ where: { id } }),
    );
    return { impact };
  }

  async listEmployeeScheduleSummaries() {
    const employees = await prisma.employee.findMany({
      select: { id: true, name: true, active: true },
      orderBy: { name: 'asc' },
    });

    const [hourGroups, specialGroups] = await Promise.all([
      prisma.employeeBusinessHour.groupBy({
        by: ['employeeId'],
        _count: { employeeId: true },
      }),
      prisma.employeeSpecialDay.groupBy({
        by: ['employeeId'],
        _count: { employeeId: true },
      }),
    ]);

    const hourCount = new Map(hourGroups.map((item) => [item.employeeId, item._count.employeeId]));
    const specialCount = new Map(
      specialGroups.map((item) => [item.employeeId, item._count.employeeId]),
    );

    return employees.map((employee) => ({
      id: employee.id,
      name: employee.name,
      active: employee.active,
      usesCustomHours: (hourCount.get(employee.id) ?? 0) > 0,
      specialDaysCount: specialCount.get(employee.id) ?? 0,
    }));
  }

  async getEmployeeSchedule(employeeId: string) {
    const employee = await this.requireEmployee(employeeId);
    const [studioHours, customHours, specialDays] = await Promise.all([
      this.getBusinessHours(),
      prisma.employeeBusinessHour.findMany({
        where: { employeeId },
        orderBy: { dayOfWeek: 'asc' },
      }),
      prisma.employeeSpecialDay.findMany({
        where: { employeeId },
        orderBy: { date: 'asc' },
      }),
    ]);

    const usesCustomHours = customHours.length > 0;
    const byDay = new Map<
      number,
      {
        dayOfWeek: number;
        openTime: string;
        closeTime: string;
        isClosed: boolean;
        breaks?: unknown;
      }
    >();
    for (const hour of studioHours) {
      byDay.set(hour.dayOfWeek, hour);
    }
    if (usesCustomHours) {
      for (const hour of customHours) {
        byDay.set(hour.dayOfWeek, hour);
      }
    }
    const hours = [...byDay.values()]
      .sort((left, right) => left.dayOfWeek - right.dayOfWeek)
      .map(withDayName);

    return {
      employee: { id: employee.id, name: employee.name, active: employee.active },
      usesCustomHours,
      hours,
      specialDays: specialDays.map(mapSpecialDay),
      bufferMinutes: employee.bufferMinutes,
    };
  }

  async upsertEmployeeHours(
    employeeId: string,
    hours: UpsertBusinessHourInput[],
    options: ScheduleMutationOptions,
  ) {
    const employee = await this.requireEmployee(employeeId);

    for (const hour of hours) {
      assertOpenBeforeClose(hour.isClosed, hour.openTime, hour.closeTime);
    }

    const previous = await prisma.employeeBusinessHour.findMany({ where: { employeeId } });
    const previousBreaks = new Map(previous.map((hour) => [hour.dayOfWeek, hour.breaks]));
    const next = hours.map((hour) => toHour(hour, previousBreaks.get(hour.dayOfWeek)));

    const affected = await scheduleImpactService.findAffected({
      employeeId,
      employeeHours: next,
    });
    scheduleImpactService.requireDecision(affected, options.onAffected, 'fora do novo horário');

    const { impact } = await scheduleImpactService.commit(
      affected,
      options.onAffected,
      options.actor,
      `Mudança no horário de atendimento de ${employee.name}.`,
      async (tx) => {
        await tx.employeeBusinessHour.deleteMany({ where: { employeeId } });
        await tx.employeeBusinessHour.createMany({
          data: next.map((hour) => ({ employeeId, ...hour })),
        });
      },
    );

    return { ...(await this.getEmployeeSchedule(employeeId)), impact };
  }

  /** Voltar ao horário do estúdio também pode tirar horários (se o do estúdio for menor). */
  async resetEmployeeHours(employeeId: string, options: ScheduleMutationOptions) {
    const employee = await this.requireEmployee(employeeId);

    const affected = await scheduleImpactService.findAffected({ employeeId, employeeHours: [] });
    scheduleImpactService.requireDecision(affected, options.onAffected, 'fora do novo horário');

    const { impact } = await scheduleImpactService.commit(
      affected,
      options.onAffected,
      options.actor,
      `Mudança no horário de atendimento de ${employee.name}.`,
      (tx) => tx.employeeBusinessHour.deleteMany({ where: { employeeId } }),
    );

    return { ...(await this.getEmployeeSchedule(employeeId)), impact };
  }

  async createEmployeeSpecialDay(
    employeeId: string,
    data: CreateEmployeeSpecialDayInput,
    options: ScheduleMutationOptions,
  ) {
    const employee = await this.requireEmployee(employeeId);
    const dateObj = calendarDateUtc(data.date);

    const existing = await prisma.employeeSpecialDay.findUnique({
      where: { employeeId_date: { employeeId, date: dateObj } },
    });
    if (existing) {
      throw httpError('Já existe uma exceção cadastrada para este profissional nesta data', 409);
    }

    const isClosed = data.isClosed ?? true;
    assertOpenBeforeClose(isClosed, data.openTime, data.closeTime);
    const values = specialValues(isClosed, data.openTime, data.closeTime);

    const affected = await scheduleImpactService.findAffected({
      employeeId,
      dateKeys: [data.date],
      employeeSpecials: [specialOverride(data.date, values)],
    });
    scheduleImpactService.requireDecision(affected, options.onAffected, 'sem atendimento');

    const { result, impact } = await scheduleImpactService.commit(
      affected,
      options.onAffected,
      options.actor,
      employeeSpecialReason(employee.name, data.date, values),
      (tx) =>
        tx.employeeSpecialDay.create({
          data: {
            employeeId,
            date: dateObj,
            title: data.title,
            description: data.description || null,
            ...values,
          },
        }),
    );

    return { day: mapSpecialDay(result), impact };
  }

  async updateEmployeeSpecialDay(
    employeeId: string,
    id: string,
    data: UpdateEmployeeSpecialDayInput,
    options: ScheduleMutationOptions,
  ) {
    const employee = await this.requireEmployee(employeeId);
    const existing = await prisma.employeeSpecialDay.findFirst({
      where: { id, employeeId },
    });
    if (!existing) {
      throw httpError('Exceção do profissional não encontrada', 404);
    }

    const isClosed = data.isClosed ?? existing.isClosed;
    const openTime = data.openTime !== undefined ? data.openTime : existing.openTime;
    const closeTime = data.closeTime !== undefined ? data.closeTime : existing.closeTime;
    assertOpenBeforeClose(isClosed, openTime, closeTime);

    const oldKey = specialDateKey(existing.date);
    const newKey = data.date ?? oldKey;
    if (newKey !== oldKey) {
      const clash = await prisma.employeeSpecialDay.findUnique({
        where: { employeeId_date: { employeeId, date: calendarDateUtc(newKey) } },
      });
      if (clash) {
        throw httpError('Já existe uma exceção cadastrada para este profissional nesta data', 409);
      }
    }

    const values = specialValues(isClosed, openTime, closeTime);
    const overrides = [specialOverride(newKey, values)];
    if (newKey !== oldKey) overrides.push(specialOverride(oldKey, null));

    const affected = await scheduleImpactService.findAffected({
      employeeId,
      dateKeys: [oldKey, newKey],
      employeeSpecials: overrides,
    });
    scheduleImpactService.requireDecision(affected, options.onAffected, 'sem atendimento');

    const { result, impact } = await scheduleImpactService.commit(
      affected,
      options.onAffected,
      options.actor,
      employeeSpecialReason(employee.name, newKey, values),
      (tx) =>
        tx.employeeSpecialDay.update({
          where: { id },
          data: {
            ...(data.date !== undefined && { date: calendarDateUtc(data.date) }),
            ...(data.title !== undefined && { title: data.title }),
            ...(data.description !== undefined && { description: data.description || null }),
            ...values,
          },
        }),
    );

    return { day: mapSpecialDay(result), impact };
  }

  async deleteEmployeeSpecialDay(employeeId: string, id: string, options: ScheduleMutationOptions) {
    const employee = await this.requireEmployee(employeeId);
    const existing = await prisma.employeeSpecialDay.findFirst({
      where: { id, employeeId },
    });
    if (!existing) {
      throw httpError('Exceção do profissional não encontrada', 404);
    }

    const dateKey = specialDateKey(existing.date);
    const affected = await scheduleImpactService.findAffected({
      employeeId,
      dateKeys: [dateKey],
      employeeSpecials: [specialOverride(dateKey, null)],
    });
    scheduleImpactService.requireDecision(affected, options.onAffected, 'sem atendimento');

    const { impact } = await scheduleImpactService.commit(
      affected,
      options.onAffected,
      options.actor,
      employeeSpecialReason(employee.name, dateKey, null),
      (tx) => tx.employeeSpecialDay.delete({ where: { id } }),
    );
    return { impact };
  }

  private async requireEmployee(employeeId: string) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, active: true, bufferMinutes: true },
    });
    if (!employee) {
      throw httpError('Funcionário não encontrado', 404);
    }
    return employee;
  }
}

function mapSpecialDay<T extends { date: Date }>(day: T) {
  return {
    ...day,
    date: day.date.toISOString().slice(0, 10),
  };
}
