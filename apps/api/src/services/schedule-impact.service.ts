import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { calendarDateUtc, dateKeyFromInstant, zonedDayRange } from '../lib/datetime';
import { httpError } from '../lib/http-error';
import { DEFAULT_STUDIO_HOURS, type HourLike, type SpecialLike } from '../lib/schedule-hours';
import {
  applyScheduleChange,
  isAffectedByChange,
  type ScheduleChange,
  type ScheduleConfig,
} from '../lib/schedule-impact';
import {
  RESCHEDULABLE_STATUSES,
  appointmentStatusService,
  type StatusActorContext,
} from './appointment-status.service';

/**
 * DOM-02: antes de fechar um dia, mudar expediente ou desativar profissional, a API lista os
 * agendamentos marcados que ficariam sem atendimento. Sem decisão, responde 409
 * `AFFECTED_APPOINTMENTS` com a lista; com `onAffected=keep` salva e mantém; com
 * `onAffected=cancel` salva, cancela na mesma transação e avisa os clientes por e-mail.
 */

export type AffectedDecision = 'keep' | 'cancel';

export interface AffectedAppointment {
  id: string;
  date: string;
  endDate: string;
  status: string;
  client: { id: string; name: string };
  product: { id: string; name: string };
  employee: { id: string; name: string };
}

export interface ImpactSummary {
  affected: number;
  cancelled: number;
}

const affectedSelect = {
  id: true,
  date: true,
  endDate: true,
  status: true,
  employeeId: true,
  client: { select: { id: true, name: true } },
  product: { select: { id: true, name: true } },
  employee: { select: { id: true, name: true } },
} as const;

type AffectedRow = Prisma.AppointmentGetPayload<{ select: typeof affectedSelect }>;

function toAffected(row: AffectedRow): AffectedAppointment {
  return {
    id: row.id,
    date: row.date.toISOString(),
    endDate: row.endDate.toISOString(),
    status: row.status,
    client: row.client,
    product: row.product,
    employee: row.employee,
  };
}

function groupByEmployee<T extends { employeeId: string }>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.employeeId);
    if (list) list.push(row);
    else map.set(row.employeeId, [row]);
  }
  return map;
}

export class ScheduleImpactService {
  /** Agendamentos futuros, marcados ou confirmados, que deixam de caber se `change` for salvo. */
  async findAffected(change: ScheduleChange): Promise<AffectedAppointment[]> {
    const now = new Date();
    const and: Prisma.AppointmentWhereInput[] = [
      { status: { in: RESCHEDULABLE_STATUSES } },
      { date: { gt: now } },
    ];
    if (change.employeeId) and.push({ employeeId: change.employeeId });
    if (change.dateKeys?.length) {
      and.push({
        OR: [...new Set(change.dateKeys)].map((key) => {
          const { start, end } = zonedDayRange(key);
          return { date: { gte: start, lt: end } };
        }),
      });
    }

    const appointments = await prisma.appointment.findMany({
      where: { AND: and },
      select: affectedSelect,
      orderBy: { date: 'asc' },
    });
    if (appointments.length === 0) return [];

    const employeeIds = [...new Set(appointments.map((item) => item.employeeId))];
    const fromDate = calendarDateUtc(dateKeyFromInstant(now));
    const [studioHours, studioSpecials, employeeHours, employeeSpecials] = await Promise.all([
      prisma.businessHour.findMany(),
      prisma.specialDay.findMany({ where: { date: { gte: fromDate } } }),
      prisma.employeeBusinessHour.findMany({ where: { employeeId: { in: employeeIds } } }),
      prisma.employeeSpecialDay.findMany({
        where: { employeeId: { in: employeeIds }, date: { gte: fromDate } },
      }),
    ]);

    const hoursByEmployee = groupByEmployee(employeeHours);
    const specialsByEmployee = groupByEmployee(employeeSpecials);
    const studio: Pick<ScheduleConfig, 'studioHours' | 'studioSpecials'> = {
      studioHours: studioHours.length > 0 ? studioHours : [...DEFAULT_STUDIO_HOURS],
      studioSpecials: studioSpecials as SpecialLike[],
    };

    return appointments
      .filter((appointment) => {
        const before: ScheduleConfig = {
          ...studio,
          employeeHours: (hoursByEmployee.get(appointment.employeeId) ?? []) as HourLike[],
          employeeSpecials: (specialsByEmployee.get(appointment.employeeId) ?? []) as SpecialLike[],
        };
        const after = applyScheduleChange(before, change, appointment.employeeId);
        return isAffectedByChange(appointment, dateKeyFromInstant(appointment.date), before, after);
      })
      .map(toAffected);
  }

  /** Profissional desativado: todo horário futuro dele fica sem atendimento. */
  async findFutureOfEmployee(employeeId: string): Promise<AffectedAppointment[]> {
    const appointments = await prisma.appointment.findMany({
      where: { employeeId, status: { in: RESCHEDULABLE_STATUSES }, date: { gt: new Date() } },
      select: affectedSelect,
      orderBy: { date: 'asc' },
    });
    return appointments.map(toAffected);
  }

  /** Sem decisão e com afetados: 409 com a lista, para a tela perguntar o que fazer. */
  requireDecision(
    affected: AffectedAppointment[],
    decision: AffectedDecision | undefined,
    context: string,
  ) {
    if (affected.length === 0 || decision) return;
    const count = affected.length;
    const subject =
      count === 1 ? '1 agendamento marcado fica' : `${count} agendamentos marcados ficam`;
    throw httpError(
      `${subject} ${context}. Escolha se quer mantê-${count === 1 ? 'lo' : 'los'} ou cancelar e avisar ${count === 1 ? 'o cliente' : 'os clientes'}.`,
      409,
      'AFFECTED_APPOINTMENTS',
      { appointments: affected },
    );
  }

  /**
   * Roda `write` e, se a decisão for cancelar, cancela os afetados na mesma transação. O e-mail
   * aos clientes sai depois do commit.
   */
  async commit<T>(
    affected: AffectedAppointment[],
    decision: AffectedDecision | undefined,
    actor: StatusActorContext,
    reason: string,
    write: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<{ result: T; impact: ImpactSummary }> {
    const { result, cancelledIds } = await prisma.$transaction(async (tx) => {
      const result = await write(tx);
      const cancelledIds =
        decision === 'cancel'
          ? await appointmentStatusService.cancelManyInTransaction(
              tx,
              affected.map((item) => item.id),
              actor,
              reason,
            )
          : [];
      return { result, cancelledIds };
    });

    await appointmentStatusService.notifyBulkCancellation(cancelledIds, reason);
    return { result, impact: { affected: affected.length, cancelled: cancelledIds.length } };
  }
}

export const scheduleImpactService = new ScheduleImpactService();
