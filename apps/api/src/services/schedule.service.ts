import { prisma } from '../config/database';
import {
  UpsertBusinessHourInput,
  CreateSpecialDayInput,
  UpdateSpecialDayInput,
} from '../schemas/schedule.schema';

const DAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

const DEFAULT_HOURS: { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }[] = [
  { dayOfWeek: 0, openTime: '08:00', closeTime: '18:00', isClosed: true },   // Domingo
  { dayOfWeek: 1, openTime: '08:00', closeTime: '18:00', isClosed: false },  // Segunda
  { dayOfWeek: 2, openTime: '08:00', closeTime: '18:00', isClosed: false },  // Terça
  { dayOfWeek: 3, openTime: '08:00', closeTime: '18:00', isClosed: false },  // Quarta
  { dayOfWeek: 4, openTime: '08:00', closeTime: '18:00', isClosed: false },  // Quinta
  { dayOfWeek: 5, openTime: '08:00', closeTime: '18:00', isClosed: false },  // Sexta
  { dayOfWeek: 6, openTime: '08:00', closeTime: '12:00', isClosed: false },  // Sábado
];

export class ScheduleService {
  /* ─── Business Hours ─── */

  async getBusinessHours() {
    let hours = await prisma.businessHour.findMany({
      orderBy: { dayOfWeek: 'asc' },
    });

    // Se não existirem, criar os padrões
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
      const error = new Error('O horário de abertura deve ser anterior ao de fechamento') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
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
  async getHoursForDate(dateStr: string): Promise<{ isClosed: boolean; openTime: string; closeTime: string }> {
    // Verificar se existe dia especial
    const specialDay = await prisma.specialDay.findUnique({
      where: { date: new Date(dateStr + 'T00:00:00.000Z') },
    });

    if (specialDay) {
      return {
        isClosed: specialDay.isClosed,
        openTime: specialDay.openTime || '08:00',
        closeTime: specialDay.closeTime || '18:00',
      };
    }

    // Obter o dia da semana baseado na data
    const date = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = date.getDay();

    const businessHour = await prisma.businessHour.findUnique({
      where: { dayOfWeek },
    });

    if (!businessHour) {
      // Padrão se não configurado
      return { isClosed: false, openTime: '08:00', closeTime: '18:00' };
    }

    return {
      isClosed: businessHour.isClosed,
      openTime: businessHour.openTime,
      closeTime: businessHour.closeTime,
    };
  }

  /* ─── Special Days ─── */

  async getSpecialDays() {
    const days = await prisma.specialDay.findMany({
      orderBy: { date: 'asc' },
    });

    return days;
  }

  async createSpecialDay(data: CreateSpecialDayInput) {
    const dateObj = new Date(data.date + 'T00:00:00.000Z');

    // Verificar se já existe um dia especial nesta data
    const existing = await prisma.specialDay.findUnique({
      where: { date: dateObj },
    });

    if (existing) {
      const error = new Error('Já existe um dia especial cadastrado para esta data') as Error & { statusCode: number };
      error.statusCode = 409;
      throw error;
    }

    const specialDay = await prisma.specialDay.create({
      data: {
        date: dateObj,
        title: data.title,
        description: data.description || null,
        isClosed: data.isClosed ?? true,
        openTime: data.isClosed ? null : (data.openTime || null),
        closeTime: data.isClosed ? null : (data.closeTime || null),
      },
    });

    return specialDay;
  }

  async updateSpecialDay(id: string, data: UpdateSpecialDayInput) {
    const existing = await prisma.specialDay.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error('Dia especial não encontrado') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const updateData: Record<string, unknown> = {};

    if (data.date !== undefined) {
      updateData.date = new Date(data.date + 'T00:00:00.000Z');
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

    return specialDay;
  }

  async deleteSpecialDay(id: string) {
    const existing = await prisma.specialDay.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error('Dia especial não encontrado') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    await prisma.specialDay.delete({ where: { id } });
  }
}
