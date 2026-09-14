import { prisma } from '../config/database';
import { calendarDateUtc, weekdayFromDateKey } from '../lib/datetime';
import { httpError } from '../lib/http-error';
import {
  UpsertBusinessHourInput,
  CreateSpecialDayInput,
  UpdateSpecialDayInput,
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

    return hours.map((h) => ({
      ...h,
      dayName: DAY_NAMES[h.dayOfWeek],
    }));
  }

  async upsertBusinessHour(data: UpsertBusinessHourInput) {
    if (!data.isClosed && data.openTime >= data.closeTime) {
      throw httpError('O horário de abertura deve ser anterior ao de fechamento', 400);
    }

    const hour = await prisma.businessHour.upsert({
      where: { dayOfWeek: data.dayOfWeek },
      create: data,
      update: {
        openTime: data.openTime,
        closeTime: data.closeTime,
        isClosed: data.isClosed,
      },
    });

    return { ...hour, dayName: DAY_NAMES[hour.dayOfWeek] };
  }

  async upsertAllBusinessHours(hours: UpsertBusinessHourInput[]) {
    const results = [];
    for (const h of hours) {
      results.push(await this.upsertBusinessHour(h));
    }
    return results;
  }

  /** Retorna o horário de funcionamento para uma data específica (considerando dia especial) */
  async getHoursForDate(
    dateStr: string,
  ): Promise<{ isClosed: boolean; openTime: string; closeTime: string }> {
    const specialDay = await prisma.specialDay.findUnique({
      where: { date: calendarDateUtc(dateStr) },
    });

    if (specialDay) {
      return {
        isClosed: specialDay.isClosed,
        openTime: specialDay.openTime || '08:00',
        closeTime: specialDay.closeTime || '18:00',
      };
    }

    const dayOfWeek = weekdayFromDateKey(dateStr);
    const businessHour = await prisma.businessHour.findUnique({
      where: { dayOfWeek },
    });

    if (!businessHour) {
      return { isClosed: false, openTime: '08:00', closeTime: '18:00' };
    }

    return {
      isClosed: businessHour.isClosed,
      openTime: businessHour.openTime,
      closeTime: businessHour.closeTime,
    };
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
}

function mapSpecialDay<T extends { date: Date }>(day: T) {
  return {
    ...day,
    date: day.date.toISOString().slice(0, 10),
  };
}
