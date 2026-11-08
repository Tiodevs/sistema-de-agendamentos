import { prisma } from '../config/database';
import {
  appointmentClientSelect,
  appointmentProductSelect,
  mapClientAvatar,
} from '../lib/appointment-map';
import { DashboardService, DASHBOARD_PERIODS, type DashboardPeriod } from './dashboard.service';
import type {
  AppointmentStatus,
  ProfessionalAppointmentFilters,
} from '../schemas/appointment.schema';
import { appointmentStatusService, type StatusActorContext } from './appointment-status.service';

const dashboardService = new DashboardService();

export class ProfessionalService {
  async getDashboard(
    employeeId: string,
    options: { period?: DashboardPeriod; productId?: string } = {},
  ) {
    const period =
      options.period && DASHBOARD_PERIODS.includes(options.period) ? options.period : 'month';

    const [stats, employee, assignedProducts] = await Promise.all([
      dashboardService.getStats({
        period,
        employeeId,
        productId: options.productId,
      }),
      prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, name: true, email: true, phone: true },
      }),
      prisma.employeeProduct.findMany({
        where: { employeeId, product: { active: true } },
        select: { product: { select: { id: true, name: true } } },
      }),
    ]);

    const products = (
      assignedProducts.length > 0
        ? assignedProducts.map((item) => item.product)
        : stats.filters.products
    ).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    return {
      employee,
      ...stats,
      filters: { products, employees: [] },
      overview: {
        ...stats.overview,
        weekAppointments: stats.overview.monthAppointments,
        completedMonth: stats.overview.completedAppointments ?? 0,
        cancelledMonth: stats.overview.cancelledAppointments ?? 0,
        totalClients: stats.overview.uniqueClients ?? stats.overview.totalClients,
      },
    };
  }

  /** Os filtros chegam validados pelo `professionalAppointmentsQuerySchema`. */
  async getAppointments(employeeId: string, filters?: ProfessionalAppointmentFilters) {
    const where: Record<string, unknown> = { employeeId };

    if (filters?.status) where.status = filters.status;
    if (filters?.from || filters?.to) {
      where.date = {
        ...(filters.from && { gte: filters.from }),
        ...(filters.to && { lte: filters.to }),
      };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        client: { select: appointmentClientSelect },
        product: { select: appointmentProductSelect },
      },
      orderBy: { date: 'asc' },
    });

    return appointments.map((appointment) => {
      const { client, ...rest } = appointment;
      return {
        ...rest,
        price: Number(appointment.price),
        product: { ...appointment.product, price: Number(appointment.product.price) },
        client: mapClientAvatar(client),
      };
    });
  }

  /**
   * DOM-03: o profissional confirma, inicia, conclui, registra falta (depois do horário) e
   * cancela (até a antecedência mínima, avisando o cliente), sempre pela máquina de estados.
   */
  async updateAppointmentStatus(
    actor: StatusActorContext,
    appointmentId: string,
    status: AppointmentStatus,
  ) {
    return appointmentStatusService.change(appointmentId, status, actor);
  }

  async undoAppointmentStatus(actor: StatusActorContext, appointmentId: string) {
    return appointmentStatusService.undo(appointmentId, actor);
  }
}
