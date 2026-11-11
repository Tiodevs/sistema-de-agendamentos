import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { appointmentInclude, mapAppointment } from '../lib/appointment-map';
import {
  breakIntervals,
  conflictsWithBuffer,
  dayBounds,
  enumerateSlots,
  findMatchingSlot,
  isEmployeeOverlapError,
} from '../lib/booking-slot';
import {
  MAX_BOOKING_DAYS_AHEAD,
  MAX_UPCOMING_BOOKINGS_PER_CLIENT,
  UPCOMING_BOOKING_STATUSES,
  isBeyondBookingWindow,
} from '../lib/booking-rules';
import { dateKeyFromInstant, startOfZonedDay } from '../lib/datetime';
import { httpError } from '../lib/http-error';
import type {
  AppointmentListFilters,
  AppointmentStatus,
  CreateAppointmentInput,
} from '../schemas/appointment.schema';
import { appointmentStatusService, type StatusActorContext } from './appointment-status.service';
import { notifyAppointmentScheduled } from './email.service';
import { ScheduleService } from './schedule.service';

const scheduleService = new ScheduleService();
const ACTIVE_STATUSES = {
  notIn: ['CANCELLED', 'NO_SHOW'],
} satisfies Prisma.EnumAppointmentStatusFilter;

const DEFAULT_PAGE_SIZE = 100;

type ListFilters = Pick<
  AppointmentListFilters,
  'employeeId' | 'clientId' | 'status' | 'from' | 'to' | 'search'
>;

function listWhere(filters: ListFilters = {}): Prisma.AppointmentWhereInput {
  const where: Prisma.AppointmentWhereInput = {};

  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.status) where.status = filters.status;
  if (filters.from || filters.to) {
    where.date = {
      ...(filters.from && { gte: filters.from }),
      ...(filters.to && { lte: filters.to }),
    };
  }
  if (filters.search) {
    const contains = { contains: filters.search, mode: 'insensitive' as const };
    where.client = { OR: [{ name: contains }, { email: contains }, { phone: contains }] };
  }

  return where;
}

export class AppointmentService {
  /** Lista completa, sem paginação: histórico de um cliente ou a agenda de um profissional. */
  async findAll(filters?: ListFilters) {
    const appointments = await prisma.appointment.findMany({
      where: listWhere(filters),
      include: appointmentInclude,
      orderBy: { date: 'asc' },
    });

    return appointments.map(mapAppointment);
  }

  /**
   * Agenda do admin (UX-09), paginada. Sem período nem cliente, começa em hoje: a tela abre no
   * que vem pela frente, não no primeiro agendamento do estúdio.
   */
  async findPage(filters: AppointmentListFilters = {}) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? DEFAULT_PAGE_SIZE;
    const hasScope = Boolean(filters.from || filters.to || filters.clientId);
    const from = hasScope ? filters.from : startOfZonedDay(new Date());
    const where = listWhere({ ...filters, from });

    const [total, appointments] = await Promise.all([
      prisma.appointment.count({ where }),
      prisma.appointment.findMany({
        where,
        include: appointmentInclude,
        orderBy: [{ date: filters.order ?? 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      appointments: appointments.map(mapAppointment),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      period: { from: from?.toISOString() ?? null, to: filters.to?.toISOString() ?? null },
    };
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

  /**
   * `selfService`: o próprio cliente reservando em `/book`. Aí valem as regras do SEC-02:
   * e-mail confirmado, até 3 agendamentos futuros e até 60 dias de antecedência.
   */
  async create(data: CreateAppointmentInput, options: { selfService?: boolean } = {}) {
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

    if (options.selfService) {
      if (!client.emailVerifiedAt) {
        throw httpError(
          `Confirme seu e-mail para agendar. Enviamos o link para ${client.email}.`,
          403,
          'EMAIL_NOT_VERIFIED',
        );
      }
      if (isBeyondBookingWindow(startDate)) {
        throw httpError(
          `Dá para agendar com até ${MAX_BOOKING_DAYS_AHEAD} dias de antecedência.`,
          400,
          'BOOKING_TOO_FAR',
        );
      }
    }

    await this.assertBookableInstant(data.employeeId, product.duration, startDate);

    try {
      const appointment = await prisma.$transaction(async (tx) => {
        if (options.selfService) {
          // Trava a linha do cliente antes da do profissional (sempre nessa ordem): duas reservas
          // simultâneas do mesmo cliente não passam juntas pelo teto.
          await tx.$queryRaw`SELECT id FROM users WHERE id = ${data.clientId} FOR UPDATE`;
          const upcoming = await tx.appointment.count({
            where: {
              clientId: data.clientId,
              status: { in: [...UPCOMING_BOOKING_STATUSES] },
              date: { gt: new Date() },
            },
          });
          if (upcoming >= MAX_UPCOMING_BOOKINGS_PER_CLIENT) {
            throw httpError(
              `Você já tem ${MAX_UPCOMING_BOOKINGS_PER_CLIENT} agendamentos marcados. Cancele um deles para marcar outro.`,
              409,
              'BOOKING_LIMIT_REACHED',
            );
          }
        }

        await tx.$queryRaw`SELECT id FROM employees WHERE id = ${data.employeeId} FOR UPDATE`;

        // UX-12: com respiro, o intervalo livre antes e depois de cada atendimento também conta.
        const bufferMs = employee.bufferMinutes * 60 * 1000;
        const conflict = await tx.appointment.findFirst({
          where: {
            employeeId: data.employeeId,
            status: ACTIVE_STATUSES,
            AND: [
              { date: { lt: new Date(endDate.getTime() + bufferMs) } },
              { endDate: { gt: new Date(startDate.getTime() - bufferMs) } },
            ],
          },
          select: { date: true, endDate: true },
        });

        if (conflict) {
          const overlapsDirectly = conflict.date < endDate && conflict.endDate > startDate;
          throw httpError(
            overlapsDirectly
              ? 'O funcionário já possui um agendamento neste horário'
              : `Este profissional precisa de ${employee.bufferMinutes} minutos entre os atendimentos. Escolha outro horário.`,
            409,
            overlapsDirectly ? undefined : 'BUFFER_CONFLICT',
          );
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

  /** Mudança de status pela máquina de estados (DOM-01): devolve o agendamento e o prazo do "Desfazer". */
  async updateStatus(id: string, status: AppointmentStatus, actor: StatusActorContext) {
    return appointmentStatusService.change(id, status, actor);
  }

  async undoStatus(id: string, actor: StatusActorContext) {
    return appointmentStatusService.undo(id, actor);
  }

  /** DOM-09: o cliente cancela até a antecedência mínima; depois disso, só o estúdio. */
  async cancelOwn(id: string, clientId: string) {
    const { appointment } = await appointmentStatusService.change(id, 'CANCELLED', {
      role: 'CLIENT',
      userId: clientId,
    });
    return appointment;
  }

  /**
   * DOM-04: agendamento não é apagado, para não sumir do histórico do cliente nem dos relatórios.
   * O caminho é cancelar (que avisa o cliente e libera o horário).
   */
  async delete(id: string) {
    await this.findById(id);
    throw httpError(
      'Agendamentos não são excluídos, para não apagar o histórico. Cancele o agendamento.',
      409,
      'APPOINTMENT_DELETE_DISABLED',
    );
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
        breaks: [],
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
    const pauses = breakIntervals(dateStr, schedule.breaks);
    const slots = enumerateSlots(dayStart, dayEnd, product.duration, pauses).map((slot) => {
      const isPast = slot.start <= now;
      const hasConflict = existingAppointments.some((appt) =>
        conflictsWithBuffer(slot, { start: appt.date, end: appt.endDate }, employee.bufferMinutes),
      );

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
      breaks: schedule.breaks,
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
    const slots = enumerateSlots(
      dayStart,
      dayEnd,
      durationMinutes,
      breakIntervals(dateStr, schedule.breaks),
    );
    if (!findMatchingSlot(slots, startDate)) {
      throw httpError('Horário indisponível para este serviço', 400);
    }
  }
}
