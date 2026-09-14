import { prisma } from '../config/database';
import { calendarDateUtc } from '../lib/datetime';
import { httpError } from '../lib/http-error';
import { resolveHoursForDate } from '../lib/schedule-hours';
import {
  UpsertBusinessHourInput,
  CreateSpecialDayInput,
  UpdateSpecialDayInput,
  CreateEmployeeSpecialDayInput,
  UpdateEmployeeSpecialDayInput,
} from '../schemas/schedule.schema';

const DAY_NAMES = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

const DEFAULT_HOURS: {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}[] = [
  { dayOfWeek: 0, openTime: '08:00', closeTime: '18:00', isClosed: true },
  { dayOfWeek: 1, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 2, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 3, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 4, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 5, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 6, openTime: '08:00', closeTime: '12:00', isClosed: false },
];

function withDayName<T extends { dayOfWeek: number }>(hour: T) {
  return { ...hour, dayName: DAY_NAMES[hour.dayOfWeek] };
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

export class ScheduleService {
  async getBusinessHours() {
    let hours = await prisma.businessHour.findMany({
      orderBy: { dayOfWeek: 'asc' },
    });

    if (hours.length === 0) {
      await prisma.businessHour.createMany({ data: DEFAULT_HOURS });
      hours = await prisma.businessHour.findMany({
        orderBy: { dayOfWeek: 'asc' },
      });
    }

    return hours.map(withDayName);
  }

  async upsertBusinessHour(data: UpsertBusinessHourInput) {
    assertOpenBeforeClose(data.isClosed, data.openTime, data.closeTime);

    const hour = await prisma.businessHour.upsert({
      where: { dayOfWeek: data.dayOfWeek },
      create: data,
      update: {
        openTime: data.openTime,
        closeTime: data.closeTime,
        isClosed: data.isClosed,
      },
    });

    return withDayName(hour);
  }

  async upsertAllBusinessHours(hours: UpsertBusinessHourInput[]) {
    const results = [];
    for (const hour of hours) {
      results.push(await this.upsertBusinessHour(hour));
    }
    return results;
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
      studioHours: studioHours.length > 0 ? studioHours : DEFAULT_HOURS,
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

  async createSpecialDay(data: CreateSpecialDayInput) {
    const dateObj = calendarDateUtc(data.date);

    const existing = await prisma.specialDay.findUnique({
      where: { date: dateObj },
    });

    if (existing) {
      throw httpError('Já existe um dia especial cadastrado para esta data', 409);
    }

    assertOpenBeforeClose(data.isClosed ?? true, data.openTime, data.closeTime);

    const specialDay = await prisma.specialDay.create({
      data: {
        date: dateObj,
        title: data.title,
        description: data.description || null,
        isClosed: data.isClosed ?? true,
        openTime: data.isClosed ? null : data.openTime || null,
        closeTime: data.isClosed ? null : data.closeTime || null,
      },
    });

    return mapSpecialDay(specialDay);
  }

  async updateSpecialDay(id: string, data: UpdateSpecialDayInput) {
    const existing = await prisma.specialDay.findUnique({ where: { id } });
    if (!existing) {
      throw httpError('Dia especial não encontrado', 404);
    }

    const isClosed = data.isClosed ?? existing.isClosed;
    const openTime = data.openTime !== undefined ? data.openTime : existing.openTime;
    const closeTime = data.closeTime !== undefined ? data.closeTime : existing.closeTime;
    assertOpenBeforeClose(isClosed, openTime, closeTime);

    const updateData: Record<string, unknown> = {};

    if (data.date !== undefined) {
      updateData.date = calendarDateUtc(data.date);
    }
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.isClosed !== undefined) updateData.isClosed = data.isClosed;
    if (data.openTime !== undefined) updateData.openTime = data.openTime || null;
    if (data.closeTime !== undefined) updateData.closeTime = data.closeTime || null;

    const specialDay = await prisma.specialDay.update({
      where: { id },
      data: updateData,
    });

    return mapSpecialDay(specialDay);
  }

  async deleteSpecialDay(id: string) {
    const existing = await prisma.specialDay.findUnique({ where: { id } });
    if (!existing) {
      throw httpError('Dia especial não encontrado', 404);
    }

    await prisma.specialDay.delete({ where: { id } });
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
      { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }
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
    };
  }

  async upsertEmployeeHours(employeeId: string, hours: UpsertBusinessHourInput[]) {
    await this.requireEmployee(employeeId);

    for (const hour of hours) {
      assertOpenBeforeClose(hour.isClosed, hour.openTime, hour.closeTime);
    }

    await prisma.$transaction(async (tx) => {
      await tx.employeeBusinessHour.deleteMany({ where: { employeeId } });
      await tx.employeeBusinessHour.createMany({
        data: hours.map((hour) => ({
          employeeId,
          dayOfWeek: hour.dayOfWeek,
          openTime: hour.openTime,
          closeTime: hour.closeTime,
          isClosed: hour.isClosed,
        })),
      });
    });

    return this.getEmployeeSchedule(employeeId);
  }

  async resetEmployeeHours(employeeId: string) {
    await this.requireEmployee(employeeId);
    await prisma.employeeBusinessHour.deleteMany({ where: { employeeId } });
    return this.getEmployeeSchedule(employeeId);
  }

  async createEmployeeSpecialDay(employeeId: string, data: CreateEmployeeSpecialDayInput) {
    await this.requireEmployee(employeeId);
    const dateObj = calendarDateUtc(data.date);

    const existing = await prisma.employeeSpecialDay.findUnique({
      where: { employeeId_date: { employeeId, date: dateObj } },
    });
    if (existing) {
      throw httpError('Já existe uma exceção cadastrada para este profissional nesta data', 409);
    }

    assertOpenBeforeClose(data.isClosed ?? true, data.openTime, data.closeTime);

    const specialDay = await prisma.employeeSpecialDay.create({
      data: {
        employeeId,
        date: dateObj,
        title: data.title,
        description: data.description || null,
        isClosed: data.isClosed ?? true,
        openTime: data.isClosed ? null : data.openTime || null,
        closeTime: data.isClosed ? null : data.closeTime || null,
      },
    });

    return mapSpecialDay(specialDay);
  }

  async updateEmployeeSpecialDay(
    employeeId: string,
    id: string,
    data: UpdateEmployeeSpecialDayInput,
  ) {
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

    const updateData: Record<string, unknown> = {};
    if (data.date !== undefined) updateData.date = calendarDateUtc(data.date);
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.isClosed !== undefined) updateData.isClosed = data.isClosed;
    if (data.openTime !== undefined) updateData.openTime = data.openTime || null;
    if (data.closeTime !== undefined) updateData.closeTime = data.closeTime || null;

    const specialDay = await prisma.employeeSpecialDay.update({
      where: { id },
      data: updateData,
    });

    return mapSpecialDay(specialDay);
  }

  async deleteEmployeeSpecialDay(employeeId: string, id: string) {
    const existing = await prisma.employeeSpecialDay.findFirst({
      where: { id, employeeId },
    });
    if (!existing) {
      throw httpError('Exceção do profissional não encontrada', 404);
    }

    await prisma.employeeSpecialDay.delete({ where: { id } });
  }

  private async requireEmployee(employeeId: string) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, active: true },
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
