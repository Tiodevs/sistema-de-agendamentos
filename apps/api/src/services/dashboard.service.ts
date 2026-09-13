import { prisma } from '../config/database';
import {
  addCalendarDays,
  endOfZonedDay,
  enumerateCalendarDays,
  formatDayLabel,
  formatDayTooltip,
  formatHourLabel,
  formatRangeLabel,
  formatWeekLabel,
  formatWeekTooltip,
  startOfMonday,
  startOfZonedDay,
  TIME_ZONE,
  zonedDate,
  zonedParts,
} from '../lib/datetime';

export const DASHBOARD_PERIODS = ['today', 'week', 'month', 'last7', 'last30'] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

type ActivityBucket = {
  start: Date;
  end: Date;
  label: string;
  tooltipLabel: string;
  completedMinutes: number;
  scheduledMinutes: number;
  completedCount: number;
  scheduledCount: number;
};

const REVENUE_STATUSES = ['COMPLETED', 'CONFIRMED', 'SCHEDULED', 'IN_PROGRESS'] as const;
const STOPPED_STATUSES = ['CANCELLED', 'NO_SHOW'] as const;

const DEFAULT_HOURS: Array<{
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}> = [
  { dayOfWeek: 0, openTime: '08:00', closeTime: '18:00', isClosed: true },
  { dayOfWeek: 1, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 2, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 3, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 4, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 5, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 6, openTime: '08:00', closeTime: '12:00', isClosed: false },
];

function percentChange(current: number, previous: number) {
  if (previous > 0) return Math.round(((current - previous) / previous) * 100);
  if (current > 0) return 100;
  return 0;
}

function percentOf(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function parseMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function calendarDayKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function availableWorkMinutes(options: {
  start: Date;
  end: Date;
  employeeCount: number;
  hoursByDay: Map<
    number,
    { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }
  >;
  specialByDay: Map<
    string,
    { isClosed: boolean; openTime: string | null; closeTime: string | null }
  >;
}) {
  if (options.employeeCount <= 0) return 0;

  return enumerateCalendarDays(options.start, options.end).reduce((sum, day) => {
    const special = options.specialByDay.get(calendarDayKey(day.year, day.month, day.day));
    const hours = special
      ? {
          isClosed: special.isClosed,
          openTime: special.openTime || '08:00',
          closeTime: special.closeTime || '18:00',
        }
      : options.hoursByDay.get(day.dayOfWeek);

    if (!hours || hours.isClosed) return sum;
    const duration = Math.max(0, parseMinutes(hours.closeTime) - parseMinutes(hours.openTime));
    return sum + duration * options.employeeCount;
  }, 0);
}

function isStopped(status: string) {
  return STOPPED_STATUSES.includes(status as (typeof STOPPED_STATUSES)[number]);
}

function isCompleted(status: string) {
  return status === 'COMPLETED';
}

function pickClosestAppointments<T extends { date: Date }>(items: T[], now: Date, limit: number) {
  if (items.length <= limit) {
    return [...items].sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  return [...items]
    .sort(
      (a, b) =>
        Math.abs(a.date.getTime() - now.getTime()) - Math.abs(b.date.getTime() - now.getTime()),
    )
    .slice(0, limit)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function emptyBucket(start: Date, end: Date, label: string, tooltipLabel: string): ActivityBucket {
  return {
    start,
    end,
    label,
    tooltipLabel,
    completedMinutes: 0,
    scheduledMinutes: 0,
    completedCount: 0,
    scheduledCount: 0,
  };
}

function addAppointmentToBucket(bucket: ActivityBucket, status: string, duration: number) {
  if (isStopped(status)) return;
  if (isCompleted(status)) {
    bucket.completedMinutes += duration;
    bucket.completedCount += 1;
    return;
  }
  bucket.scheduledMinutes += duration;
  bucket.scheduledCount += 1;
}

function resolvePeriod(period: DashboardPeriod, now: Date) {
  const todayStart = startOfZonedDay(now);
  const todayEnd = endOfZonedDay(now);
  const nowParts = zonedParts(now);

  if (period === 'today') {
    return {
      start: todayStart,
      end: todayEnd,
      label: 'Hoje',
      granularity: 'hour' as const,
    };
  }

  if (period === 'week') {
    const start = startOfMonday(now);
    const end = endOfZonedDay(addCalendarDays(start, 6));
    return {
      start,
      end,
      label: 'Esta semana',
      granularity: 'day' as const,
    };
  }

  if (period === 'last7') {
    return {
      start: addCalendarDays(todayStart, -6),
      end: todayEnd,
      label: 'Últimos 7 dias',
      granularity: 'day' as const,
    };
  }

  if (period === 'last30') {
    return {
      start: addCalendarDays(todayStart, -29),
      end: todayEnd,
      label: 'Últimos 30 dias',
      granularity: 'week' as const,
    };
  }

  const start = zonedDate(nowParts.year, nowParts.month, 1, 0, 0, 0, 0);
  const end = endOfZonedDay(zonedDate(nowParts.year, nowParts.month + 1, 0));
  return {
    start,
    end,
    label: new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
      timeZone: TIME_ZONE,
    })
      .format(start)
      .replace(/^\w/, (letter) => letter.toUpperCase()),
    granularity: 'week' as const,
  };
}

function previousRange(start: Date, end: Date) {
  const duration = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - duration);
  return { start: prevStart, end: prevEnd };
}

function buildHourlyBuckets(now: Date, appointments: Array<{ date: Date }>) {
  const parts = zonedParts(now);
  let startHour = 8;
  let endHour = 20;

  for (const appointment of appointments) {
    const hour = zonedParts(appointment.date).hour;
    startHour = Math.min(startHour, hour);
    endHour = Math.max(endHour, Math.min(24, hour + 1));
  }

  startHour = Math.max(0, Math.floor(startHour / 2) * 2);
  endHour = Math.min(24, Math.ceil(endHour / 2) * 2);

  const buckets: ActivityBucket[] = [];
  for (let hour = startHour; hour < endHour; hour += 2) {
    const start = zonedDate(parts.year, parts.month, parts.day, hour);
    const end =
      hour + 2 >= 24
        ? zonedDate(parts.year, parts.month, parts.day + 1, 0)
        : zonedDate(parts.year, parts.month, parts.day, hour + 2);
    buckets.push(
      emptyBucket(
        start,
        end,
        formatHourLabel(hour),
        `${formatHourLabel(hour)} – ${formatHourLabel((hour + 2) % 24)}`,
      ),
    );
  }

  return buckets;
}

function buildDailyBuckets(start: Date, end: Date) {
  return enumerateCalendarDays(start, end).map((day) => {
    const dayStart = zonedDate(day.year, day.month, day.day, 0, 0, 0, 0);
    const dayEnd = zonedDate(day.year, day.month, day.day, 23, 59, 59, 999);
    return emptyBucket(dayStart, dayEnd, formatDayLabel(dayStart), formatDayTooltip(dayStart));
  });
}

function buildWeeklyBuckets(start: Date, end: Date) {
  const periodStart = startOfZonedDay(start);
  const periodEnd = endOfZonedDay(end);
  let cursor = startOfMonday(periodStart);
  const buckets: ActivityBucket[] = [];

  while (cursor.getTime() <= periodEnd.getTime()) {
    const rawEnd = endOfZonedDay(addCalendarDays(cursor, 6));
    const bucketStart = cursor.getTime() < periodStart.getTime() ? periodStart : cursor;
    const bucketEnd = rawEnd.getTime() > periodEnd.getTime() ? periodEnd : rawEnd;
    buckets.push(
      emptyBucket(
        bucketStart,
        bucketEnd,
        formatWeekLabel(bucketStart, bucketEnd),
        formatWeekTooltip(bucketStart, bucketEnd),
      ),
    );
    cursor = addCalendarDays(cursor, 7);
  }

  return buckets;
}

export class DashboardService {
  async getStats(
    options: {
      period?: DashboardPeriod;
      employeeId?: string;
      productId?: string;
    } = {},
  ) {
    const now = new Date();
    const periodKey = options.period ?? 'month';
    const range = resolvePeriod(periodKey, now);
    const previous = previousRange(range.start, range.end);
    const todayStart = startOfZonedDay(now);
    const todayEnd = endOfZonedDay(now);
    const rangeStartParts = zonedParts(range.start);
    const rangeEndParts = zonedParts(range.end);
    const specialDayFrom = new Date(
      Date.UTC(rangeStartParts.year, rangeStartParts.month - 1, rangeStartParts.day),
    );
    const specialDayTo = new Date(
      Date.UTC(rangeEndParts.year, rangeEndParts.month - 1, rangeEndParts.day),
    );

    const scope = {
      ...(options.employeeId ? { employeeId: options.employeeId } : {}),
      ...(options.productId ? { productId: options.productId } : {}),
    };

    const [
      totalProducts,
      activeProducts,
      totalEmployees,
      activeEmployees,
      totalClients,
      periodAppointments,
      prevBookedCount,
      prevRevenue,
      todayAppointments,
      recentAppointments,
      filterEmployees,
      filterProducts,
      businessHours,
      specialDays,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { active: true } }),
      prisma.employee.count(),
      prisma.employee.count({ where: { active: true } }),
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.appointment.findMany({
        where: {
          ...scope,
          date: { gte: range.start, lte: range.end },
        },
        select: {
          id: true,
          date: true,
          endDate: true,
          status: true,
          price: true,
          productId: true,
          employeeId: true,
          clientId: true,
          client: { select: { id: true, name: true } },
          product: { select: { id: true, name: true, duration: true } },
          employee: { select: { id: true, name: true } },
        },
      }),
      prisma.appointment.count({
        where: {
          ...scope,
          date: { gte: previous.start, lte: previous.end },
          status: { notIn: [...STOPPED_STATUSES] },
        },
      }),
      prisma.appointment.aggregate({
        where: {
          ...scope,
          date: { gte: previous.start, lte: previous.end },
          status: { in: [...REVENUE_STATUSES] },
        },
        _sum: { price: true },
      }),
      prisma.appointment.findMany({
        where: {
          ...scope,
          date: { gte: todayStart, lte: todayEnd },
        },
        include: {
          client: { select: { id: true, name: true } },
          product: { select: { id: true, name: true, duration: true } },
          employee: { select: { id: true, name: true } },
        },
        orderBy: { date: 'asc' },
      }),
      prisma.appointment.findMany({
        where: {
          ...scope,
          date: { gte: range.start, lte: range.end },
        },
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, name: true } },
          product: { select: { id: true, name: true, duration: true, price: true } },
          employee: { select: { id: true, name: true } },
        },
      }),
      prisma.employee.findMany({
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.product.findMany({
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.businessHour.findMany({
        orderBy: { dayOfWeek: 'asc' },
      }),
      prisma.specialDay.findMany({
        where: {
          date: { gte: specialDayFrom, lte: specialDayTo },
        },
      }),
    ]);

    const hoursByDay = new Map(
      (businessHours.length > 0 ? businessHours : DEFAULT_HOURS).map((hour) => [
        hour.dayOfWeek,
        hour,
      ]),
    );
    const specialByDay = new Map(
      specialDays.map((day) => [
        calendarDayKey(
          day.date.getUTCFullYear(),
          day.date.getUTCMonth() + 1,
          day.date.getUTCDate(),
        ),
        { isClosed: day.isClosed, openTime: day.openTime, closeTime: day.closeTime },
      ]),
    );
    const occupancyEmployees = options.employeeId ? 1 : activeEmployees;
    const availableMinutes = availableWorkMinutes({
      start: range.start,
      end: range.end,
      employeeCount: occupancyEmployees,
      hoursByDay,
      specialByDay,
    });

    let bookedCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let noShowCount = 0;
    let completedMinutes = 0;
    let scheduledMinutes = 0;
    let completedRevenue = 0;
    let expectedRevenue = 0;
    const uniqueClients = new Set<string>();
    const statusCounts: Record<string, number> = {};
    const productStats = new Map<
      string,
      { productId: string; name: string; count: number; revenue: number }
    >();
    const employeeStats = new Map<
      string,
      { employeeId: string; name: string; count: number; revenue: number }
    >();

    const buckets =
      range.granularity === 'hour'
        ? buildHourlyBuckets(now, periodAppointments)
        : range.granularity === 'day'
          ? buildDailyBuckets(range.start, range.end)
          : buildWeeklyBuckets(range.start, range.end);

    for (const appointment of periodAppointments) {
      const duration = appointment.product.duration || 0;
      const price = Number(appointment.price || 0);
      statusCounts[appointment.status] = (statusCounts[appointment.status] || 0) + 1;

      if (appointment.status === 'CANCELLED') cancelledCount += 1;
      if (appointment.status === 'NO_SHOW') noShowCount += 1;

      if (!isStopped(appointment.status)) {
        bookedCount += 1;
        uniqueClients.add(appointment.clientId);

        if (isCompleted(appointment.status)) {
          completedCount += 1;
          completedMinutes += duration;
          completedRevenue += price;
        } else {
          scheduledMinutes += duration;
          expectedRevenue += price;
        }

        const product = productStats.get(appointment.productId) ?? {
          productId: appointment.productId,
          name: appointment.product.name,
          count: 0,
          revenue: 0,
        };
        product.count += 1;
        product.revenue += price;
        productStats.set(appointment.productId, product);

        const employee = employeeStats.get(appointment.employeeId) ?? {
          employeeId: appointment.employeeId,
          name: appointment.employee.name,
          count: 0,
          revenue: 0,
        };
        employee.count += 1;
        employee.revenue += price;
        employeeStats.set(appointment.employeeId, employee);
      }

      const bucket = buckets.find((item, index) => {
        if (appointment.date < item.start) return false;
        const last = index === buckets.length - 1;
        return last ? appointment.date <= item.end : appointment.date < item.end;
      });
      if (bucket) addAppointmentToBucket(bucket, appointment.status, duration);
    }

    const totalAppointments = periodAppointments.length;
    const occupancyMinutes = completedMinutes + scheduledMinutes;
    const periodRevenue = completedRevenue + expectedRevenue;
    const previousRevenue = Number(prevRevenue._sum.price || 0);

    const topProducts = [...productStats.values()]
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
      .slice(0, 5);
    const topEmployees = [...employeeStats.values()]
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
      .slice(0, 5);

    const todayCompleted = todayAppointments.filter((item) => item.status === 'COMPLETED').length;
    const todayRemaining = todayAppointments.filter(
      (item) => !isStopped(item.status) && !isCompleted(item.status),
    ).length;

    return {
      period: {
        key: periodKey,
        label: range.label,
        start: range.start.toISOString(),
        end: range.end.toISOString(),
        rangeLabel: formatRangeLabel(range.start, range.end),
        granularity: range.granularity,
        employeeId: options.employeeId ?? null,
        productId: options.productId ?? null,
      },
      filters: {
        employees: filterEmployees,
        products: filterProducts,
      },
      overview: {
        activeProducts,
        totalProducts,
        activeEmployees,
        totalEmployees,
        totalClients,
        monthAppointments: bookedCount,
        appointmentChange: percentChange(bookedCount, prevBookedCount),
        monthRevenue: periodRevenue,
        revenueChange: percentChange(periodRevenue, previousRevenue),
        totalAppointments,
        bookedAppointments: bookedCount,
        completedAppointments: completedCount,
        cancelledAppointments: cancelledCount,
        noShowAppointments: noShowCount,
        uniqueClients: uniqueClients.size,
        completedRevenue,
        expectedRevenue,
        avgTicket: bookedCount > 0 ? periodRevenue / bookedCount : 0,
        occupancyRate: percentOf(occupancyMinutes, availableMinutes),
        occupancyMinutes,
        availableMinutes,
        completionRate: percentOf(completedCount, totalAppointments),
        cancellationRate: percentOf(cancelledCount, totalAppointments),
        noShowRate: percentOf(noShowCount, totalAppointments),
        todayCount: todayAppointments.length,
      },
      periodAppointments: pickClosestAppointments(periodAppointments, now, 18).map(
        (appointment) => ({
          id: appointment.id,
          date: appointment.date,
          endDate: appointment.endDate,
          status: appointment.status,
          client: appointment.client,
          product: appointment.product,
          employee: appointment.employee,
        }),
      ),
      todayAppointments: todayAppointments.map((appointment) => ({
        id: appointment.id,
        date: appointment.date,
        endDate: appointment.endDate,
        status: appointment.status,
        client: appointment.client,
        product: appointment.product,
        employee: appointment.employee,
      })),
      todaySummary: {
        total: todayAppointments.length,
        remaining: todayRemaining,
        completed: todayCompleted,
      },
      statusBreakdown: statusCounts,
      recentAppointments: recentAppointments.map((appointment) => ({
        id: appointment.id,
        date: appointment.date,
        endDate: appointment.endDate,
        status: appointment.status,
        price: Number(appointment.price),
        client: appointment.client,
        product: { ...appointment.product, price: Number(appointment.product.price) },
        employee: appointment.employee,
        createdAt: appointment.createdAt,
      })),
      topProducts,
      topEmployees,
      timeSpent: {
        totalMinutes: completedMinutes + scheduledMinutes,
        completedMinutes,
        scheduledMinutes,
      },
      weeklyActivity: buckets.map((bucket) => ({
        start: bucket.start.toISOString(),
        label: bucket.label,
        tooltipLabel: bucket.tooltipLabel,
        completedMinutes: bucket.completedMinutes,
        scheduledMinutes: bucket.scheduledMinutes,
        completedCount: bucket.completedCount,
        scheduledCount: bucket.scheduledCount,
      })),
    };
  }
}
