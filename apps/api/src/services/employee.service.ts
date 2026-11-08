import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { CreateEmployeeInput, UpdateEmployeeInput } from '../schemas/employee.schema';
import { userAvatarUrl } from '../lib/avatar';
import { httpError } from '../lib/http-error';
import { createPasswordResetToken, EMPLOYEE_INVITE_TTL_MS } from '../lib/password-reset-token';
import { appUrl } from '../emails/brand';
import { notifyEmployeeInvite } from './email.service';
import type { StatusActorContext } from './appointment-status.service';
import { scheduleImpactService, type AffectedDecision } from './schedule-impact.service';

const employeeInclude = {
  products: {
    include: {
      product: {
        select: { id: true, name: true, price: true, duration: true, active: true },
      },
    },
  },
  user: {
    select: { id: true, email: true, avatar: true, updatedAt: true },
  },
  // Só o convite em aberto mais recente: os substituídos e o aceito já têm `usedAt`.
  invites: {
    where: { usedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { createdAt: true, expiresAt: true },
  },
  _count: { select: { appointments: true } },
} satisfies Prisma.EmployeeInclude;

type EmployeeRecord = Prisma.EmployeeGetPayload<{ include: typeof employeeInclude }>;

/**
 * Acesso ao painel do profissional (SEC-03): `linked` (conta ligada), `pending` (convite enviado
 * e válido), `expired` (convite venceu sem ser aceito) ou `none` (nunca convidado ou acesso removido).
 */
export type EmployeeAccess =
  | { status: 'linked'; email: string | null }
  | { status: 'pending' | 'expired'; sentAt: string; expiresAt: string }
  | { status: 'none' };

function accessOf(employee: EmployeeRecord, now = new Date()): EmployeeAccess {
  if (employee.userId) {
    return { status: 'linked', email: employee.user?.email ?? null };
  }
  const invite = employee.invites[0];
  if (invite) {
    return {
      status: invite.expiresAt > now ? 'pending' : 'expired',
      sentAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt.toISOString(),
    };
  }
  return { status: 'none' };
}

function toEmployee(employee: EmployeeRecord) {
  const { user, invites: _invites, _count, ...rest } = employee;
  return {
    ...rest,
    avatar: user ? userAvatarUrl(user.id, user.avatar, user.updatedAt) : employee.avatar,
    access: accessOf(employee),
    appointmentCount: _count.appointments,
  };
}

/** Novo convite para o e-mail do profissional; os anteriores deixam de valer. */
async function issueInvite(tx: Prisma.TransactionClient, employee: { id: string; email: string }) {
  const { token, tokenHash } = createPasswordResetToken();
  const now = new Date();
  await tx.employeeInvite.updateMany({
    where: { employeeId: employee.id, usedAt: null },
    data: { usedAt: now },
  });
  const invite = await tx.employeeInvite.create({
    data: {
      employeeId: employee.id,
      email: employee.email,
      tokenHash,
      expiresAt: new Date(now.getTime() + EMPLOYEE_INVITE_TTL_MS),
    },
    select: { id: true, expiresAt: true },
  });
  return {
    inviteId: invite.id,
    expiresAt: invite.expiresAt,
    acceptUrl: `${appUrl()}/accept-invite#token=${encodeURIComponent(token)}`,
  };
}

function sendInviteEmail(
  employee: { name: string; email: string },
  invite: { inviteId: string; acceptUrl: string },
) {
  notifyEmployeeInvite({
    name: employee.name,
    email: employee.email,
    inviteId: invite.inviteId,
    acceptUrl: invite.acceptUrl,
  });
}

export interface EmployeeMutationOptions {
  actor: StatusActorContext;
  onAffected?: AffectedDecision;
}

export class EmployeeService {
  async findAll(includeInactive = false) {
    const where = includeInactive ? {} : { active: true };
    const employees = await prisma.employee.findMany({
      where,
      include: employeeInclude,
      orderBy: { name: 'asc' },
    });
    return employees.map(toEmployee);
  }

  async findById(id: string) {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: employeeInclude,
    });

    if (!employee) {
      throw httpError('Funcionário não encontrado', 404);
    }

    return toEmployee(employee);
  }

  /**
   * SEC-03: cadastrar não liga nem promove nenhuma conta. O profissional recebe um convite e o
   * vínculo só acontece quando o dono do e-mail aceita (`POST /auth/invites/accept`).
   */
  async create(data: CreateEmployeeInput) {
    const existing = await prisma.employee.findUnique({ where: { email: data.email } });
    if (existing) {
      throw httpError('Já existe um funcionário com este e-mail', 409);
    }

    const { employee, invite } = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          avatar: data.avatar || null,
        },
      });
      const invite = await issueInvite(tx, employee);
      return { employee, invite };
    });

    sendInviteEmail(employee, invite);
    return this.findById(employee.id);
  }

  async update(id: string, data: UpdateEmployeeInput) {
    const current = await this.findById(id);

    if (data.email) {
      const existing = await prisma.employee.findFirst({
        where: { email: data.email, NOT: { id } },
      });
      if (existing) {
        throw httpError('Já existe um funcionário com este e-mail', 409);
      }
    }

    const emailChanged = data.email !== undefined && data.email !== current.email;
    // O convite em aberto foi para o e-mail antigo: ele deixa de valer e um novo vai para o atual.
    const resendInvite =
      emailChanged && current.access.status === 'pending' && current.active === true;

    const { employee, invite } = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.email !== undefined && { email: data.email }),
          ...(data.phone !== undefined && { phone: data.phone || null }),
          ...(data.avatar !== undefined && { avatar: data.avatar || null }),
        },
      });
      if (emailChanged && !current.userId) {
        await tx.employeeInvite.updateMany({
          where: { employeeId: id, usedAt: null },
          data: { usedAt: new Date() },
        });
      }
      const invite = resendInvite ? await issueInvite(tx, employee) : null;
      return { employee, invite };
    });

    if (invite) sendInviteEmail(employee, invite);
    return this.findById(id);
  }

  /**
   * DOM-02: desativar com horários marcados pede decisão (manter ou cancelar e avisar). Reativar
   * não mexe na agenda.
   */
  async toggleActive(id: string, options: EmployeeMutationOptions) {
    const existing = await this.findById(id);

    if (!existing.active) {
      await prisma.employee.update({ where: { id }, data: { active: true } });
      return { employee: await this.findById(id), impact: { affected: 0, cancelled: 0 } };
    }

    const affected = await scheduleImpactService.findFutureOfEmployee(id);
    scheduleImpactService.requireDecision(affected, options.onAffected, 'sem profissional');

    const { impact } = await scheduleImpactService.commit(
      affected,
      options.onAffected,
      options.actor,
      `${existing.name} não está mais atendendo no estúdio.`,
      async (tx) => {
        await tx.employee.update({ where: { id }, data: { active: false } });
        // Convite em aberto de quem saiu não deve mais ligar conta nenhuma.
        await tx.employeeInvite.updateMany({
          where: { employeeId: id, usedAt: null },
          data: { usedAt: new Date() },
        });
      },
    );

    return { employee: await this.findById(id), impact };
  }

  /** DOM-04: com histórico, o caminho é desativar; sem histórico, exclui e devolve a conta ao papel de cliente. */
  async delete(id: string) {
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true, userId: true, _count: { select: { appointments: true } } },
    });
    if (!employee) {
      throw httpError('Funcionário não encontrado', 404);
    }

    const count = employee._count.appointments;
    if (count > 0) {
      throw httpError(
        `Este profissional tem ${count === 1 ? '1 agendamento' : `${count} agendamentos`} no histórico. Desative em vez de excluir, para manter o histórico.`,
        409,
        'HAS_APPOINTMENTS',
        { appointments: count },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.employee.delete({ where: { id } });
      if (employee.userId) {
        await tx.user.updateMany({
          where: { id: employee.userId, role: 'EMPLOYEE' },
          data: { role: 'USER' },
        });
      }
    });
  }

  /** Envia (ou reenvia) o convite de acesso ao painel. */
  async sendInvite(id: string) {
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, active: true, userId: true },
    });
    if (!employee) {
      throw httpError('Funcionário não encontrado', 404);
    }
    if (employee.userId) {
      throw httpError('Este profissional já tem acesso ao painel.', 409, 'ALREADY_LINKED');
    }
    if (!employee.active) {
      throw httpError('Ative o profissional antes de enviar o convite.', 409, 'EMPLOYEE_INACTIVE');
    }

    const invite = await prisma.$transaction((tx) => issueInvite(tx, employee));
    sendInviteEmail(employee, invite);
    return this.findById(id);
  }

  /** Tira o acesso ao painel: desfaz o vínculo, cancela convites e devolve a conta ao papel de cliente. */
  async revokeAccess(id: string) {
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!employee) {
      throw httpError('Funcionário não encontrado', 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.employeeInvite.updateMany({
        where: { employeeId: id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (employee.userId) {
        await tx.employee.update({ where: { id }, data: { userId: null } });
        await tx.user.updateMany({
          where: { id: employee.userId, role: 'EMPLOYEE' },
          data: { role: 'USER' },
        });
      }
    });

    return this.findById(id);
  }

  async assignProducts(employeeId: string, productIds: string[]) {
    await this.findById(employeeId);

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      throw httpError('Um ou mais produtos não foram encontrados', 400);
    }

    // Remover todos os vínculos existentes e criar novos
    await prisma.$transaction([
      prisma.employeeProduct.deleteMany({ where: { employeeId } }),
      ...productIds.map((productId) =>
        prisma.employeeProduct.create({
          data: { employeeId, productId },
        }),
      ),
    ]);

    return this.findById(employeeId);
  }
}
