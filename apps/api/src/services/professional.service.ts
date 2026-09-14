import { prisma } from '../config/database';
import {
  appointmentClientSelect,
  appointmentProductSelect,
  mapClientAvatar,
} from '../lib/appointment-map';
import { DashboardService, DASHBOARD_PERIODS, type DashboardPeriod } from './dashboard.service';

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

  async getAppointments(
    employeeId: string,
    filters?: { from?: string; to?: string; status?: string },
  ) {
    const where: Record<string, unknown> = { employeeId };

    if (filters?.status) where.status = filters.status;
    if (filters?.from || filters?.to) {
      where.date = {};
      if (filters.from) (where.date as Record<string, unknown>).gte = new Date(filters.from);
      if (filters.to) (where.date as Record<string, unknown>).lte = new Date(filters.to);
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

  async updateAppointmentStatus(employeeId: string, appointmentId: string, status: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      const error = new Error('Agendamento não encontrado') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    if (appointment.employeeId !== employeeId) {
      const error = new Error('Este agendamento não pertence a você') as Error & {
        statusCode: number;
      };
      error.statusCode = 403;
      throw error;
    }

    // Profissional só pode: CONFIRMED, IN_PROGRESS, COMPLETED
    const allowedStatuses = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];
    if (!allowedStatuses.includes(status)) {
      const error = new Error(
        'Status não permitido. Use: CONFIRMED, IN_PROGRESS ou COMPLETED',
      ) as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: status as 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' },
      include: {
        client: { select: appointmentClientSelect },
        product: { select: appointmentProductSelect },
      },
    });

    const { client, ...rest } = updated;
    return {
      ...rest,
      price: Number(updated.price),
      product: { ...updated.product, price: Number(updated.product.price) },
      client: mapClientAvatar(client),
    };
  }
}
