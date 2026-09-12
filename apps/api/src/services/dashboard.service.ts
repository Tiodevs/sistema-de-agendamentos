import { prisma } from '../config/database';

export class DashboardService {
  async getStats() {
    const now = new Date();

    // Início e fim do mês atual
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Início e fim do mês anterior (para comparação)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Início do dia de hoje
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const eightWeeksAgo = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 55,
      0,
      0,
      0,
      0,
    );

    const [
      totalProducts,
      activeProducts,
      totalEmployees,
      activeEmployees,
      totalClients,
      monthAppointments,
      prevMonthAppointments,
      todayAppointments,
      monthRevenue,
      prevMonthRevenue,
      appointmentsByStatus,
      recentAppointments,
      topProducts,
      topEmployees,
      activityAppointments,
    ] = await Promise.all([
      // Produtos
      prisma.product.count(),
      prisma.product.count({ where: { active: true } }),

      // Funcionários
      prisma.employee.count(),
      prisma.employee.count({ where: { active: true } }),

      // Clientes (usuários com role USER)
      prisma.user.count({ where: { role: 'USER' } }),

      // Agendamentos do mês (excluindo cancelados)
      prisma.appointment.count({
        where: {
          date: { gte: monthStart, lte: monthEnd },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
      }),

      // Agendamentos do mês anterior (para comparação)
      prisma.appointment.count({
        where: {
          date: { gte: prevMonthStart, lte: prevMonthEnd },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
      }),

      // Agendamentos de hoje
      prisma.appointment.findMany({
        where: {
          date: { gte: todayStart, lte: todayEnd },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
        include: {
          client: { select: { id: true, name: true } },
          product: { select: { id: true, name: true, duration: true } },
          employee: { select: { id: true, name: true } },
        },
        orderBy: { date: 'asc' },
      }),

      // Receita do mês
      prisma.appointment.aggregate({
        where: {
          date: { gte: monthStart, lte: monthEnd },
          status: { in: ['COMPLETED', 'CONFIRMED', 'SCHEDULED', 'IN_PROGRESS'] },
        },
        _sum: { price: true },
      }),

      // Receita do mês anterior
      prisma.appointment.aggregate({
        where: {
          date: { gte: prevMonthStart, lte: prevMonthEnd },
          status: { in: ['COMPLETED', 'CONFIRMED', 'SCHEDULED', 'IN_PROGRESS'] },
        },
        _sum: { price: true },
      }),

      // Agendamentos por status (mês atual)
      prisma.appointment.groupBy({
        by: ['status'],
        where: {
          date: { gte: monthStart, lte: monthEnd },
        },
        _count: { id: true },
      }),

      // Últimos 5 agendamentos
      prisma.appointment.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, name: true } },
          product: { select: { id: true, name: true, duration: true, price: true } },
          employee: { select: { id: true, name: true } },
        },
      }),

      // Top 5 produtos mais agendados (mês atual)
      prisma.appointment.groupBy({
        by: ['productId'],
        where: {
          date: { gte: monthStart, lte: monthEnd },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),

      // Top 5 funcionários com mais agendamentos (mês atual)
      prisma.appointment.groupBy({
        by: ['employeeId'],
        where: {
          date: { gte: monthStart, lte: monthEnd },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),

      prisma.appointment.findMany({
        where: {
          date: { gte: eightWeeksAgo, lte: monthEnd },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
        select: {
          date: true,
          status: true,
          product: { select: { duration: true } },
        },
      }),
    ]);

    // Buscar nomes dos top produtos
    const topProductIds = topProducts.map((p) => p.productId);
    const productNames =
      topProductIds.length > 0
        ? await prisma.product.findMany({
            where: { id: { in: topProductIds } },
            select: { id: true, name: true },
          })
        : [];

    // Buscar nomes dos top funcionários
    const topEmployeeIds = topEmployees.map((e) => e.employeeId);
    const employeeNames =
      topEmployeeIds.length > 0
        ? await prisma.employee.findMany({
            where: { id: { in: topEmployeeIds } },
            select: { id: true, name: true },
          })
        : [];

    // Calcular variações percentuais
    const appointmentChange =
      prevMonthAppointments > 0
        ? Math.round(((monthAppointments - prevMonthAppointments) / prevMonthAppointments) * 100)
        : monthAppointments > 0
          ? 100
          : 0;

    const currentRevenue = Number(monthRevenue._sum.price || 0);
    const previousRevenue = Number(prevMonthRevenue._sum.price || 0);
    const revenueChange =
      previousRevenue > 0
        ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100)
        : currentRevenue > 0
          ? 100
          : 0;

    // Formatar status counts
    const statusCounts: Record<string, number> = {};
    for (const s of appointmentsByStatus) {
      statusCounts[s.status] = s._count.id;
    }

    const weeklyActivity = Array.from({ length: 8 }, (_, index) => {
      const offset = 7 - index;
      const end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - offset * 7,
        23,
        59,
        59,
        999,
      );
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - offset * 7 - 6,
        0,
        0,
        0,
        0,
      );
      return {
        start,
        end,
        completedMinutes: 0,
        scheduledMinutes: 0,
      };
    });

    let monthCompletedMinutes = 0;
    let monthScheduledMinutes = 0;

    for (const appointment of activityAppointments) {
      const duration = appointment.product.duration || 0;
      const isCompleted = appointment.status === 'COMPLETED';
      const inCurrentMonth = appointment.date >= monthStart && appointment.date <= monthEnd;

      if (inCurrentMonth) {
        if (isCompleted) monthCompletedMinutes += duration;
        else monthScheduledMinutes += duration;
      }

      const week = weeklyActivity.find(
        (bucket) => appointment.date >= bucket.start && appointment.date <= bucket.end,
      );
      if (!week) continue;
      if (isCompleted) week.completedMinutes += duration;
      else week.scheduledMinutes += duration;
    }

    return {
      overview: {
        activeProducts,
        totalProducts,
        activeEmployees,
        totalEmployees,
        totalClients,
        monthAppointments,
        appointmentChange,
        monthRevenue: currentRevenue,
        revenueChange,
      },
      todayAppointments: todayAppointments.map((a) => ({
        id: a.id,
        date: a.date,
        endDate: a.endDate,
        status: a.status,
        client: a.client,
        product: a.product,
        employee: a.employee,
      })),
      statusBreakdown: statusCounts,
      recentAppointments: recentAppointments.map((a) => ({
        id: a.id,
        date: a.date,
        endDate: a.endDate,
        status: a.status,
        price: Number(a.price),
        client: a.client,
        product: { ...a.product, price: Number(a.product.price) },
        employee: a.employee,
        createdAt: a.createdAt,
      })),
      topProducts: topProducts.map((p) => ({
        productId: p.productId,
        name: productNames.find((pn) => pn.id === p.productId)?.name || 'Desconhecido',
        count: p._count.id,
      })),
      topEmployees: topEmployees.map((e) => ({
        employeeId: e.employeeId,
        name: employeeNames.find((en) => en.id === e.employeeId)?.name || 'Desconhecido',
        count: e._count.id,
      })),
      timeSpent: {
        totalMinutes: monthCompletedMinutes + monthScheduledMinutes,
        completedMinutes: monthCompletedMinutes,
        scheduledMinutes: monthScheduledMinutes,
      },
      weeklyActivity: weeklyActivity.map((week) => ({
        start: week.start.toISOString(),
        completedMinutes: week.completedMinutes,
        scheduledMinutes: week.scheduledMinutes,
      })),
    };
  }
}
