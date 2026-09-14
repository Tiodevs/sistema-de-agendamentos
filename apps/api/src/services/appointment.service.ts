import { prisma } from '../config/database';
import { appointmentInclude, mapAppointment } from '../lib/appointment-map';
import {
  dayBounds,
  enumerateSlots,
  findMatchingSlot,
  isEmployeeOverlapError,
} from '../lib/booking-slot';
import { dateKeyFromInstant } from '../lib/datetime';
import { httpError } from '../lib/http-error';
import { CreateAppointmentInput } from '../schemas/appointment.schema';
import { notifyAppointmentCancelled, notifyAppointmentScheduled } from './email.service';
import { ScheduleService } from './schedule.service';

const scheduleService = new ScheduleService();
const ACTIVE_STATUSES = {
  notIn: ['CANCELLED', 'NO_SHOW'] as Array<'CANCELLED' | 'NO_SHOW'>,
};
const CLIENT_CANCELLABLE = new Set(['SCHEDULED', 'CONFIRMED']);

export class AppointmentService {
  async findAll(filters?: {
    employeeId?: string;
    clientId?: string;
    status?: string;
    from?: string;
    to?: string;
  }) {
    const where: Record<string, unknown> = {};

    if (filters?.employeeId) where.employeeId = filters.employeeId;
    if (filters?.clientId) where.clientId = filters.clientId;
    if (filters?.status) where.status = filters.status;
    if (filters?.from || filters?.to) {
      where.date = {};
      if (filters.from) (where.date as Record<string, unknown>).gte = new Date(filters.from);
      if (filters.to) (where.date as Record<string, unknown>).lte = new Date(filters.to);
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: appointmentInclude,
      orderBy: { date: 'asc' },
    });

    return appointments.map(mapAppointment);
  }

  async findById(id: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: appointmentInclude,
    });

    if (!appointment) {
      throw httpError('Agendamento não encontrado', 404);
    }

    return mapAppointment(appointment);
  }

  async create(data: CreateAppointmentInput) {
    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product || !product.active) {
      throw httpError('Produto não encontrado ou inativo', 400);
    }

    const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee || !employee.active) {
      throw httpError('Funcionário não encontrado ou inativo', 400);
    }

    const assignment = await prisma.employeeProduct.findUnique({
      where: { employeeId_productId: { employeeId: data.employeeId, productId: data.productId } },
    });
    if (!assignment) {
      throw httpError('Este funcionário não atende este produto', 400);
    }

    const client = await prisma.user.findUnique({ where: { id: data.clientId } });
    if (!client) {
      throw httpError('Cliente não encontrado', 400);
    }

    const startDate = new Date(data.date);
    const endDate = new Date(startDate.getTime() + product.duration * 60 * 1000);
    await this.assertBookableInstant(data.employeeId, product.duration, startDate);

    try {
      const appointment = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM employees WHERE id = ${data.employeeId} FOR UPDATE`;

        const conflict = await tx.appointment.findFirst({
          where: {
            employeeId: data.employeeId,
            status: ACTIVE_STATUSES,
            AND: [{ date: { lt: endDate } }, { endDate: { gt: startDate } }],
          },
        });

        if (conflict) {
          throw httpError('O funcionário já possui um agendamento neste horário', 409);
        }

        return tx.appointment.create({
          data: {
            clientId: data.clientId,
            productId: data.productId,
            employeeId: data.employeeId,
            date: startDate,
            endDate,
            price: product.price,
            notes: data.notes || null,
          },
          include: appointmentInclude,
        });
      });

      const mapped = mapAppointment(appointment);

      notifyAppointmentScheduled({
        id: mapped.id,
        date: mapped.date,
        price: mapped.price,
        notes: mapped.notes,
        client: mapped.client,
        product: mapped.product,
        employee: mapped.employee,
      });

      return mapped;
    } catch (error) {
      if (isEmployeeOverlapError(error)) {
        throw httpError('O funcionário já possui um agendamento neste horário', 409);
      }
      throw error;
    }
  }

  async updateStatus(id: string, status: string) {
    const current = await this.findById(id);

    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        status: status as
          | 'SCHEDULED'
          | 'CONFIRMED'
          | 'IN_PROGRESS'
          | 'COMPLETED'
          | 'CANCELLED'
          | 'NO_SHOW',
      },
      include: appointmentInclude,
    });

    const mapped = mapAppointment(appointment);

    if (status === 'CANCELLED' && current.status !== 'CANCELLED') {
      notifyAppointmentCancelled({
        id: mapped.id,
        date: mapped.date,
        price: mapped.price,
        notes: mapped.notes,
        client: mapped.client,
        product: mapped.product,
        employee: mapped.employee,
      });
    }

    return mapped;
  }

  async cancelOwn(id: string, clientId: string) {
    const appointment = await this.findById(id);

    if (appointment.client.id !== clientId) {
      throw httpError('Você só pode cancelar seus próprios agendamentos', 403);
    }

    if (!CLIENT_CANCELLABLE.has(appointment.status)) {
      throw httpError('Este agendamento não pode ser cancelado', 400);
    }

    if (new Date(appointment.date) <= new Date()) {
      throw httpError('Não é possível cancelar um agendamento que já passou', 400);
    }

    return this.updateStatus(id, 'CANCELLED');
  }

  async delete(id: string) {
    await this.findById(id);
    await prisma.appointment.delete({ where: { id } });
  }

  /**
   * Retorna os slots disponíveis de um funcionário para um produto em uma data específica.
   * Usa os horários de funcionamento configurados e respeita dias especiais/feriados.
   */
  async getAvailableSlots(employeeId: string, productId: string, dateStr: string) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product?.active) {
      throw httpError('Produto não encontrado ou inativo', 400);
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee?.active) {
      throw httpError('Funcionário não encontrado ou inativo', 400);
    }

    const assignment = await prisma.employeeProduct.findUnique({
      where: { employeeId_productId: { employeeId, productId } },
    });
    if (!assignment) {
      throw httpError('Este funcionário não atende este produto', 400);
    }

    const schedule = await scheduleService.getHoursForDate(dateStr, employeeId);

    if (schedule.isClosed) {
      return {
        date: dateStr,
        employee: { id: employee.id, name: employee.name },
        product: { id: product.id, name: product.name, duration: product.duration },
        businessHours: { start: schedule.openTime, end: schedule.closeTime },
        isClosed: true,
        slots: [],
      };
    }

    const { dayStart, dayEnd } = dayBounds(dateStr, schedule.openTime, schedule.closeTime);
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        employeeId,
        status: ACTIVE_STATUSES,
        date: { lt: dayEnd },
        endDate: { gt: dayStart },
      },
      orderBy: { date: 'asc' },
    });

    const now = new Date();
    const slots = enumerateSlots(dayStart, dayEnd, product.duration).map((slot) => {
      const isPast = slot.start <= now;
      const hasConflict = existingAppointments.some((appt) => {
        return slot.start < appt.endDate && slot.end > appt.date;
      });

      return {
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        available: !hasConflict && !isPast,
      };
    });

    return {
      date: dateStr,
      employee: { id: employee.id, name: employee.name },
      product: { id: product.id, name: product.name, duration: product.duration },
      businessHours: { start: schedule.openTime, end: schedule.closeTime },
      isClosed: false,
      slots,
    };
  }

  private async assertBookableInstant(
    employeeId: string,
    durationMinutes: number,
    startDate: Date,
  ) {
    if (startDate.getTime() <= Date.now()) {
      throw httpError('Não é possível agendar no passado', 400);
    }

    const dateStr = dateKeyFromInstant(startDate);
    const schedule = await scheduleService.getHoursForDate(dateStr, employeeId);
    if (schedule.isClosed) {
      throw httpError('Não há atendimento neste dia', 400);
    }

    const { dayStart, dayEnd } = dayBounds(dateStr, schedule.openTime, schedule.closeTime);
    const slots = enumerateSlots(dayStart, dayEnd, durationMinutes);
    if (!findMatchingSlot(slots, startDate)) {
      throw httpError('Horário indisponível para este serviço', 400);
    }
  }
}
