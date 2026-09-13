import { prisma } from '../config/database';
import { appointmentInclude, mapAppointment } from '../lib/appointment-map';
import { CreateAppointmentInput } from '../schemas/appointment.schema';
import { notifyAppointmentCancelled, notifyAppointmentScheduled } from './email.service';
import { ScheduleService } from './schedule.service';

// Intervalo entre slots em minutos
const SLOT_INTERVAL = 15;

const scheduleService = new ScheduleService();

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
      const error = new Error('Agendamento não encontrado') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    return mapAppointment(appointment);
  }

  async create(data: CreateAppointmentInput) {
    // Validar que o produto existe e está ativo
    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product || !product.active) {
      const error = new Error('Produto não encontrado ou inativo') as Error & {
        statusCode: number;
      };
      error.statusCode = 400;
      throw error;
    }

    // Validar que o funcionário existe e está ativo
    const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee || !employee.active) {
      const error = new Error('Funcionário não encontrado ou inativo') as Error & {
        statusCode: number;
      };
      error.statusCode = 400;
      throw error;
    }

    // Validar que o funcionário está vinculado ao produto
    const assignment = await prisma.employeeProduct.findUnique({
      where: { employeeId_productId: { employeeId: data.employeeId, productId: data.productId } },
    });
    if (!assignment) {
      const error = new Error('Este funcionário não atende este produto') as Error & {
        statusCode: number;
      };
      error.statusCode = 400;
      throw error;
    }

    // Validar que o cliente existe
    const client = await prisma.user.findUnique({ where: { id: data.clientId } });
    if (!client) {
      const error = new Error('Cliente não encontrado') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    const startDate = new Date(data.date);
    const endDate = new Date(startDate.getTime() + product.duration * 60 * 1000);

    // Verificar conflito de horário para o funcionário
    const conflict = await prisma.appointment.findFirst({
      where: {
        employeeId: data.employeeId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        AND: [{ date: { lt: endDate } }, { endDate: { gt: startDate } }],
      },
    });

    if (conflict) {
      const error = new Error('O funcionário já possui um agendamento neste horário') as Error & {
        statusCode: number;
      };
      error.statusCode = 409;
      throw error;
    }

    const appointment = await prisma.appointment.create({
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

  async delete(id: string) {
    await this.findById(id);
    await prisma.appointment.delete({ where: { id } });
  }

  /**
   * Retorna os slots disponíveis de um funcionário para um produto em uma data específica.
   * Usa os horários de funcionamento configurados e respeita dias especiais/feriados.
   */
  async getAvailableSlots(employeeId: string, productId: string, dateStr: string) {
    // Validar produto
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product?.active) {
      const error = new Error('Produto não encontrado ou inativo') as Error & {
        statusCode: number;
      };
      error.statusCode = 400;
      throw error;
    }

    // Validar funcionário
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee?.active) {
      const error = new Error('Funcionário não encontrado ou inativo') as Error & {
        statusCode: number;
      };
      error.statusCode = 400;
      throw error;
    }

    // Validar vínculo
    const assignment = await prisma.employeeProduct.findUnique({
      where: { employeeId_productId: { employeeId, productId } },
    });
    if (!assignment) {
      const error = new Error('Este funcionário não atende este produto') as Error & {
        statusCode: number;
      };
      error.statusCode = 400;
      throw error;
    }

    // Buscar horário de funcionamento para essa data (considera dias especiais)
    const schedule = await scheduleService.getHoursForDate(dateStr);

    // Se o dia estiver fechado, retornar sem slots
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

    const duration = product.duration;

    // Criar data no fuso de São Paulo (UTC-3)
    const dayStart = new Date(`${dateStr}T${schedule.openTime}:00-03:00`);
    const dayEnd = new Date(`${dateStr}T${schedule.closeTime}:00-03:00`);

    // Buscar agendamentos do funcionário naquele dia (exceto cancelados)
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        employeeId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        date: { gte: dayStart },
        endDate: { lte: new Date(dayEnd.getTime() + 24 * 60 * 60 * 1000) },
        AND: [{ date: { lt: dayEnd } }],
      },
      orderBy: { date: 'asc' },
    });

    // Gerar todos os slots possíveis
    const slots: { start: string; end: string; available: boolean }[] = [];
    const now = new Date();

    let current = new Date(dayStart);
    while (current.getTime() + duration * 60 * 1000 <= dayEnd.getTime()) {
      const slotEnd = new Date(current.getTime() + duration * 60 * 1000);

      // Verificar se o slot não está no passado
      const isPast = current <= now;

      // Verificar conflito com agendamentos existentes
      const hasConflict = existingAppointments.some((appt) => {
        const apptStart = new Date(appt.date);
        const apptEnd = new Date(appt.endDate);
        return current < apptEnd && slotEnd > apptStart;
      });

      slots.push({
        start: current.toISOString(),
        end: slotEnd.toISOString(),
        available: !hasConflict && !isPast,
      });

      current = new Date(current.getTime() + SLOT_INTERVAL * 60 * 1000);
    }

    return {
      date: dateStr,
      employee: { id: employee.id, name: employee.name },
      product: { id: product.id, name: product.name, duration: product.duration },
      businessHours: { start: schedule.openTime, end: schedule.closeTime },
      isClosed: false,
      slots,
    };
  }
}
