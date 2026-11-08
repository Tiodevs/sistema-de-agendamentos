import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { appointmentInclude, mapAppointment } from '../lib/appointment-map';
import {
  allowedTransitions,
  cancellationDeadline,
  checkTransition,
  checkUndo,
  undoDeadline,
  type AppointmentStatusValue,
  type StatusActor,
} from '../lib/appointment-status';
import { cancellationNoticeMinutes } from '../lib/booking-rules';
import { httpError } from '../lib/http-error';
import { notifyAppointmentCancelled } from './email.service';

/** Quem está mudando o status: o papel decide as regras, o id vai para o histórico. */
export interface StatusActorContext {
  role: StatusActor;
  userId: string;
  /** Obrigatório para `EMPLOYEE`: só mexe na própria agenda. */
  employeeId?: string;
}

/** Status que uma mudança de expediente ou a saída de um profissional cancela em lote (DOM-02). */
export const RESCHEDULABLE_STATUSES: AppointmentStatusValue[] = ['SCHEDULED', 'CONFIRMED'];

type MailableAppointment = {
  id: string;
  date: Date;
  price: number;
  notes: string | null;
  client: { name: string; email: string };
  product: { name: string; duration: number };
  employee: { name: string; email: string };
};

function assertOwnership(
  appointment: { clientId: string; employeeId: string },
  actor: StatusActorContext,
) {
  if (actor.role === 'EMPLOYEE' && appointment.employeeId !== actor.employeeId) {
    throw httpError('Este agendamento não pertence a você', 403);
  }
  if (actor.role === 'CLIENT' && appointment.clientId !== actor.userId) {
    throw httpError('Você só pode cancelar seus próprios agendamentos', 403);
  }
}

function toMailInput(appointment: MailableAppointment) {
  return {
    id: appointment.id,
    date: appointment.date,
    price: appointment.price,
    notes: appointment.notes,
    client: appointment.client,
    product: appointment.product,
    employee: appointment.employee,
  };
}

/** O que o front precisa para montar o menu de status sem repetir as regras. */
export function withStatusActions<
  T extends { status: AppointmentStatusValue; date: Date | string },
>(appointment: T, actor: StatusActor, now = new Date()) {
  const notice = cancellationNoticeMinutes();
  const start = new Date(appointment.date);
  return {
    ...appointment,
    allowedStatuses: allowedTransitions({
      from: appointment.status,
      actor,
      start,
      cancellationNoticeMinutes: notice,
      now,
    }),
    cancellableUntil: cancellationDeadline(start, notice).toISOString(),
  };
}

export class AppointmentStatusService {
  /**
   * Única porta para mudar status (DOM-01): valida a transição para o papel, grava com trava
   * otimista (o status não pode ter mudado no meio) e registra no histórico. Cancelamento avisa o
   * cliente e, quando não foi ele quem cancelou, o profissional.
   */
  async change(
    appointmentId: string,
    to: AppointmentStatusValue,
    actor: StatusActorContext,
    options: { reason?: string } = {},
  ) {
    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, status: true, date: true, clientId: true, employeeId: true },
    });
    if (!current) {
      throw httpError('Agendamento não encontrado', 404);
    }
    assertOwnership(current, actor);

    const check = checkTransition({
      from: current.status,
      to,
      actor: actor.role,
      start: current.date,
      cancellationNoticeMinutes: cancellationNoticeMinutes(),
    });
    if (!check.ok) {
      throw httpError(check.message, check.statusCode, check.code);
    }

    const { appointment, change } = await prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.updateMany({
        where: { id: appointmentId, status: current.status },
        data: { status: to },
      });
      if (updated.count !== 1) {
        throw httpError(
          'O status deste agendamento acabou de mudar. Atualize a tela e tente de novo.',
          409,
          'STATUS_CHANGED',
        );
      }

      const change = await tx.appointmentStatusChange.create({
        data: {
          appointmentId,
          fromStatus: current.status,
          toStatus: to,
          actorRole: actor.role,
          actorId: actor.userId,
          reason: options.reason?.trim() || null,
        },
      });

      const appointment = await tx.appointment.findUniqueOrThrow({
        where: { id: appointmentId },
        include: appointmentInclude,
      });
      return { appointment, change };
    });

    const mapped = mapAppointment(appointment);

    if (to === 'CANCELLED') {
      notifyAppointmentCancelled(toMailInput(mapped), {
        cancelledBy: actor.role === 'CLIENT' ? 'client' : 'studio',
        reason: options.reason,
        notifyProfessional: actor.role !== 'EMPLOYEE',
      });
    }

    const until = undoDeadline(change);
    return { appointment: mapped, undoUntil: until ? until.toISOString() : null };
  }

  /** Reverte a última mudança, se quem pede é quem a fez e ainda está no prazo (UX-06). */
  async undo(appointmentId: string, actor: StatusActorContext) {
    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        status: true,
        clientId: true,
        employeeId: true,
        statusChanges: {
          where: { revertedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!current) {
      throw httpError('Agendamento não encontrado', 404);
    }
    assertOwnership(current, actor);

    const change = current.statusChanges[0] ?? null;
    const check = checkUndo({ change, currentStatus: current.status, actorId: actor.userId });
    if (!check.ok || !change) {
      const denied = check.ok ? null : check;
      throw httpError(
        denied?.message ?? 'Não há mudança recente para desfazer.',
        denied?.statusCode ?? 409,
        denied?.code ?? 'NOTHING_TO_UNDO',
      );
    }

    // Voltar de "Não compareceu" reocupa o horário: se alguém já reservou, a constraint de
    // sobreposição recusa e o errorHandler responde 409.
    const appointment = await prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.updateMany({
        where: { id: appointmentId, status: change.toStatus },
        data: { status: change.fromStatus },
      });
      if (updated.count !== 1) {
        throw httpError(
          'O status deste agendamento acabou de mudar. Atualize a tela e tente de novo.',
          409,
          'STATUS_CHANGED',
        );
      }
      await tx.appointmentStatusChange.update({
        where: { id: change.id },
        data: { revertedAt: new Date() },
      });
      return tx.appointment.findUniqueOrThrow({
        where: { id: appointmentId },
        include: appointmentInclude,
      });
    });

    return mapAppointment(appointment);
  }

  /**
   * Cancela em lote, dentro da transação de quem chama (mudança de expediente, dia fechado,
   * profissional desativado). Só os que ainda estão marcados ou confirmados; devolve os ids
   * cancelados para o aviso aos clientes sair depois do commit.
   */
  async cancelManyInTransaction(
    tx: Prisma.TransactionClient,
    appointmentIds: string[],
    actor: StatusActorContext,
    reason: string,
  ) {
    if (appointmentIds.length === 0) return [];

    const targets = await tx.appointment.findMany({
      where: { id: { in: appointmentIds }, status: { in: RESCHEDULABLE_STATUSES } },
      select: { id: true, status: true },
    });
    if (targets.length === 0) return [];

    await tx.appointment.updateMany({
      where: { id: { in: targets.map((item) => item.id) }, status: { in: RESCHEDULABLE_STATUSES } },
      data: { status: 'CANCELLED' },
    });
    await tx.appointmentStatusChange.createMany({
      data: targets.map((item) => ({
        appointmentId: item.id,
        fromStatus: item.status,
        toStatus: 'CANCELLED' as const,
        actorRole: actor.role,
        actorId: actor.userId,
        reason,
      })),
    });

    return targets.map((item) => item.id);
  }

  /** Avisa os clientes dos cancelamentos em lote (depois do commit). */
  async notifyBulkCancellation(appointmentIds: string[], reason: string) {
    if (appointmentIds.length === 0) return;
    const appointments = await prisma.appointment.findMany({
      where: { id: { in: appointmentIds } },
      include: appointmentInclude,
    });
    for (const appointment of appointments) {
      notifyAppointmentCancelled(toMailInput(mapAppointment(appointment)), {
        cancelledBy: 'studio',
        reason,
      });
    }
  }
}

export const appointmentStatusService = new AppointmentStatusService();
