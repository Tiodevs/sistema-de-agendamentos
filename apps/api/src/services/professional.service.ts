import { prisma } from '../config/database';

export class ProfessionalService {
  async getDashboard(employeeId: string) {
    const now = new Date();

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Semana atual (segunda a domingo)
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    weekEnd.setHours(23, 59, 59, 999);

    const [
      monthAppointments,
      prevMonthAppointments,
      monthRevenue,
      prevMonthRevenue,
      todayAppointments,
      weekAppointments,
      completedMonth,
      cancelledMonth,
      statusBreakdown,
      totalClients,
      topProducts,
      employee,
    ] = await Promise.all([
      // Agendamentos do mês
      prisma.appointment.count({
        where: {
          employeeId,
          date: { gte: monthStart, lte: monthEnd },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
      }),

      // Agendamentos mês anterior
      prisma.appointment.count({
        where: {
          employeeId,
          date: { gte: prevMonthStart, lte: prevMonthEnd },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
      }),

      // Receita do mês
      prisma.appointment.aggregate({
        where: {
          employeeId,
          date: { gte: monthStart, lte: monthEnd },
          status: { in: ['COMPLETED', 'CONFIRMED', 'SCHEDULED', 'IN_PROGRESS'] },
        },
        _sum: { price: true },
      }),

      // Receita mês anterior
      prisma.appointment.aggregate({
        where: {
          employeeId,
          date: { gte: prevMonthStart, lte: prevMonthEnd },
          status: { in: ['COMPLETED', 'CONFIRMED', 'SCHEDULED', 'IN_PROGRESS'] },
        },
        _sum: { price: true },
      }),

      // Agendamentos de hoje
      prisma.appointment.findMany({
        where: {
          employeeId,
          date: { gte: todayStart, lte: todayEnd },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
        include: {
          client: { select: { id: true, name: true, phone: true } },
          product: { select: { id: true, name: true, duration: true } },
        },
        orderBy: { date: 'asc' },
      }),

      // Agendamentos da semana
      prisma.appointment.count({
        where: {
          employeeId,
          date: { gte: weekStart, lte: weekEnd },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
      }),

      // Concluídos no mês
      prisma.appointment.count({
        where: {
          employeeId,
          date: { gte: monthStart, lte: monthEnd },
          status: 'COMPLETED',
        },
      }),

      // Cancelados no mês
      prisma.appointment.count({
        where: {
          employeeId,
          date: { gte: monthStart, lte: monthEnd },
          status: { in: ['CANCELLED', 'NO_SHOW'] },
        },
      }),

      // Status breakdown do mês
      prisma.appointment.groupBy({
        by: ['status'],
        where: {
          employeeId,
          date: { gte: monthStart, lte: monthEnd },
        },
        _count: { id: true },
      }),

      // Total de clientes únicos atendidos
      prisma.appointment.findMany({
        where: {
          employeeId,
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
        select: { clientId: true },
        distinct: ['clientId'],
      }),

      // Top 5 serviços realizados no mês
      prisma.appointment.groupBy({
        by: ['productId'],
        where: {
          employeeId,
          date: { gte: monthStart, lte: monthEnd },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),

      // Dados do employee
      prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, name: true, email: true, phone: true },
      }),
    ]);

    // Buscar nomes dos top produtos
    const topProductIds = topProducts.map((p) => p.productId);
    const productNames = topProductIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: topProductIds } },
          select: { id: true, name: true },
        })
      : [];

    // Variações percentuais
    const appointmentChange = prevMonthAppointments > 0
      ? Math.round(((monthAppointments - prevMonthAppointments) / prevMonthAppointments) * 100)
      : monthAppointments > 0 ? 100 : 0;

    const currentRevenue = Number(monthRevenue._sum.price || 0);
    const previousRevenue = Number(prevMonthRevenue._sum.price || 0);
    const revenueChange = previousRevenue > 0
      ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100)
      : currentRevenue > 0 ? 100 : 0;

    // Status counts
    const statusCounts: Record<string, number> = {};
    for (const s of statusBreakdown) {
      statusCounts[s.status] = s._count.id;
    }

    return {
      employee,
      overview: {
        monthAppointments,
        appointmentChange,
        monthRevenue: currentRevenue,
        revenueChange,
        weekAppointments,
        completedMonth,
        cancelledMonth,
        totalClients: totalClients.length,
      },
      todayAppointments: todayAppointments.map((a) => ({
        id: a.id,
        date: a.date,
        endDate: a.endDate,
        status: a.status,
        client: a.client,
        product: a.product,
      })),
      statusBreakdown: statusCounts,
      topProducts: topProducts.map((p) => ({
        productId: p.productId,
        name: productNames.find((pn) => pn.id === p.productId)?.name || 'Desconhecido',
        count: p._count.id,
      })),
    };
  }

  async getAppointments(employeeId: string, filters?: { from?: string; to?: string; status?: string }) {
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
        client: { select: { id: true, name: true, email: true, phone: true } },
        product: { select: { id: true, name: true, duration: true, price: true } },
      },
      orderBy: { date: 'asc' },
    });

    return appointments.map((a) => ({
      ...a,
      price: Number(a.price),
      product: { ...a.product, price: Number(a.product.price) },
    }));
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
      const error = new Error('Este agendamento não pertence a você') as Error & { statusCode: number };
      error.statusCode = 403;
      throw error;
    }

    // Profissional só pode: CONFIRMED, IN_PROGRESS, COMPLETED
    const allowedStatuses = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];
    if (!allowedStatuses.includes(status)) {
      const error = new Error('Status não permitido. Use: CONFIRMED, IN_PROGRESS ou COMPLETED') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: status as 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        product: { select: { id: true, name: true, duration: true, price: true } },
      },
    });

    return {
      ...updated,
      price: Number(updated.price),
      product: { ...updated.product, price: Number(updated.product.price) },
    };
  }
}
