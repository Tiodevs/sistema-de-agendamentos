import bcrypt from 'bcryptjs';
import type { Prisma, Role } from '@prisma/client';
import { prisma } from '../config/database';
import {
  RegisterInput,
  LoginInput,
  UpdateProfileInput,
  ResetPasswordInput,
  ChangePasswordInput,
  ListClientsQuery,
  AcceptInviteInput,
  CreateClientInput,
  passwordSchema,
} from '../schemas/auth.schema';
import { appointmentInclude, mapAppointment } from '../lib/appointment-map';
import {
  notifyAccountActivation,
  notifyEmailChangeConfirm,
  notifyEmailChangeNotice,
  notifyEmailVerification,
  notifyPasswordChanged,
  notifyPasswordReset,
  notifyWelcome,
} from './email.service';
import { storageService } from './storage.service';
import { userAvatarUrl } from '../lib/avatar';
import { httpError } from '../lib/http-error';
import { logger } from '../lib/logger';
import { signAccessToken } from '../lib/jwt';
import {
  ACCOUNT_ACTIVATION_TTL_MS,
  createPasswordResetToken,
  EMAIL_CHANGE_TTL_MS,
  EMAIL_VERIFICATION_TTL_MS,
  hashPasswordResetToken,
  PASSWORD_RESET_TTL_MS,
} from '../lib/password-reset-token';
import {
  clearLoginFailures,
  consumeRateLimit,
  loginLockedError,
  loginLockedUntil,
  registerLoginFailure,
  waitAtLeast,
} from '../lib/rate-limit';
import { appUrl } from '../emails/brand';

const BCRYPT_ROUNDS = 12;
const FORGOT_PASSWORD_EMAIL_LIMIT = 3;
const FORGOT_PASSWORD_WINDOW_MS = 60 * 60 * 1000;
const CHANGE_PASSWORD_LIMIT = 5;
const CHANGE_PASSWORD_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAIL_IP_LIMIT = 25;
const LOGIN_FAIL_IP_WINDOW_MS = 15 * 60 * 1000;
const GENERIC_RESET_MESSAGE =
  'Se este e-mail estiver cadastrado, você receberá as instruções em instantes.';
const INVALID_LOGIN_MESSAGE = 'E-mail ou senha inválidos';
const DUMMY_PASSWORD_HASH = '$2b$12$qv5fKs2op18PWbUcztHcPO6.Z9Cmw2dbwE21elN5p3fGygv4AP22O';

const profileSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  avatar: true,
  role: true,
  active: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
  tokenVersion: true,
  employee: { select: { id: true } },
} as const;

type ProfileRecord = {
  id: string;
  name: string;
  /** `null` só no cliente rápido sem e-mail (UX-03), que não tem sessão. */
  email: string | null;
  phone: string | null;
  avatar: string | null;
  role: Role;
  active?: boolean;
  emailVerifiedAt?: Date | null;
  createdAt: Date;
  updatedAt?: Date;
  tokenVersion?: number;
  employee?: { id: string } | null;
  employeeId?: string | null;
};

function generateToken(user: ProfileRecord) {
  return signAccessToken({
    id: user.id,
    email: user.email ?? '',
    role: user.role,
    tokenVersion: user.tokenVersion ?? 0,
  });
}

function toPublicUser(user: ProfileRecord, pendingEmail: string | null = null) {
  const employeeId = user.employeeId ?? user.employee?.id ?? null;
  return {
    id: user.id,
    name: user.name,
    email: user.email ?? '',
    phone: user.phone,
    role: user.role,
    employeeId,
    avatarUrl: userAvatarUrl(user.id, user.avatar, user.updatedAt),
    pendingEmail,
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: user.createdAt,
  };
}

const clientListSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  avatar: true,
  updatedAt: true,
  active: true,
  createdAt: true,
  _count: { select: { appointments: true } },
  appointments: {
    orderBy: { date: 'desc' as const },
    take: 1,
    select: { date: true, status: true },
  },
};

const UPCOMING_STATUSES = new Set(['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS']);
const EXPECTED_REVENUE_STATUSES = new Set(['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS']);

function mapClientListItem(client: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  avatar: string | null;
  updatedAt: Date;
  active: boolean;
  createdAt: Date;
  _count: { appointments: number };
  appointments: Array<{ date: Date; status: string }>;
}) {
  const last = client.appointments[0];
  return {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    role: client.role,
    active: client.active,
    createdAt: client.createdAt.toISOString(),
    avatarUrl: userAvatarUrl(client.id, client.avatar, client.updatedAt),
    appointmentCount: client._count.appointments,
    lastAppointmentAt: last?.date.toISOString() ?? null,
  };
}

function favoriteOf(
  appointments: Array<{
    status: string;
    product: { id: string; name: string };
    employee: { id: string; name: string };
  }>,
  field: 'product' | 'employee',
) {
  const completed = appointments.filter((item) => item.status === 'COMPLETED');
  const pool = completed.length
    ? completed
    : appointments.filter((item) => item.status !== 'CANCELLED' && item.status !== 'NO_SHOW');
  const counts = new Map<string, { id: string; name: string; count: number }>();

  for (const item of pool) {
    const value = item[field];
    const current = counts.get(value.id);
    if (current) current.count += 1;
    else counts.set(value.id, { id: value.id, name: value.name, count: 1 });
  }

  let best: { id: string; name: string; count: number } | null = null;
  for (const value of counts.values()) {
    if (!best || value.count > best.count) best = value;
  }
  return best;
}

function buildClientStats(
  appointments: Array<{
    date: Date | string;
    status: string;
    price: number;
    product: { id: string; name: string };
    employee: { id: string; name: string };
  }>,
) {
  const now = Date.now();
  let upcoming = 0;
  let completed = 0;
  let cancelled = 0;
  let noShow = 0;
  let completedRevenue = 0;
  let expectedRevenue = 0;

  for (const appointment of appointments) {
    if (appointment.status === 'COMPLETED') {
      completed += 1;
      completedRevenue += appointment.price;
    } else if (appointment.status === 'CANCELLED') {
      cancelled += 1;
    } else if (appointment.status === 'NO_SHOW') {
      noShow += 1;
    }

    if (EXPECTED_REVENUE_STATUSES.has(appointment.status)) {
      expectedRevenue += appointment.price;
    }

    if (UPCOMING_STATUSES.has(appointment.status) && new Date(appointment.date).getTime() >= now) {
      upcoming += 1;
    }
  }

  return {
    total: appointments.length,
    upcoming,
    completed,
    cancelled,
    noShow,
    completedRevenue,
    expectedRevenue,
    lastAppointmentAt: appointments[0] ? new Date(appointments[0].date).toISOString() : null,
    favoriteProduct: favoriteOf(appointments, 'product'),
    favoriteEmployee: favoriteOf(appointments, 'employee'),
  };
}

/** E-mail novo aguardando confirmação. A confirmação do próprio e-mail do cadastro não conta como troca. */
async function getPendingEmail(userId: string, currentEmail: string | null) {
  const pending = await prisma.emailChangeToken.findFirst({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: { newEmail: true },
  });
  if (!pending || pending.newEmail === currentEmail?.trim().toLowerCase()) return null;
  return pending.newEmail;
}

/**
 * Gera o link que confirma `email` para a conta e invalida os anteriores. Serve tanto para a
 * confirmação do cadastro (mesmo e-mail) quanto para a troca de e-mail no perfil.
 */
async function issueEmailConfirmation(userId: string, email: string, ttlMs: number) {
  const { token, tokenHash } = createPasswordResetToken();
  const expiresAt = new Date(Date.now() + ttlMs);
  const now = new Date();

  const created = await prisma.$transaction(async (tx) => {
    await tx.emailChangeToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: now },
    });
    return tx.emailChangeToken.create({
      data: { userId, newEmail: email, tokenHash, expiresAt },
      select: { id: true },
    });
  });

  return {
    tokenId: created.id,
    confirmUrl: `${appUrl()}/confirm-email#token=${encodeURIComponent(token)}`,
  };
}

async function isEmailAvailable(email: string, userId: string, employeeId?: string | null) {
  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser && existingUser.id !== userId) return false;

  if (employeeId) {
    const existingEmployee = await prisma.employee.findFirst({
      where: { email, NOT: { id: employeeId } },
      select: { id: true },
    });
    if (existingEmployee) return false;
  }
  return true;
}

async function assertEmailAvailable(email: string, userId: string, employeeId?: string | null) {
  if (!(await isEmailAvailable(email, userId, employeeId))) {
    throw httpError('E-mail já está em uso', 409);
  }
}

/** Convite em aberto, válido e de um profissional ativo e ainda sem conta (SEC-03). */
async function findOpenInvite(token: string) {
  const record = await prisma.employeeInvite.findUnique({
    where: { tokenHash: hashPasswordResetToken(token) },
    select: {
      id: true,
      email: true,
      expiresAt: true,
      usedAt: true,
      employeeId: true,
      employee: { select: { id: true, name: true, active: true, userId: true } },
    },
  });

  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    throw httpError(
      'Convite inválido ou expirado. Peça um novo ao estúdio.',
      400,
      'INVITE_INVALID',
    );
  }
  if (record.employee.userId) {
    throw httpError('Este convite já foi aceito.', 409, 'ALREADY_LINKED');
  }
  if (!record.employee.active) {
    throw httpError(
      'Este cadastro de profissional está desativado. Fale com o estúdio.',
      409,
      'EMPLOYEE_INACTIVE',
    );
  }
  return record;
}

async function syncLinkedEmployee(
  userId: string,
  data: { name?: string; email?: string; phone?: string | null; avatarUrl?: string | null },
) {
  const linked = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!linked) return;

  await prisma.employee.update({
    where: { id: linked.id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.avatarUrl !== undefined && { avatar: data.avatarUrl }),
    },
  });
}

export class AuthService {
  async register(data: RegisterInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw httpError('E-mail já está em uso', 409);
    }

    const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        phone: data.phone || null,
      },
      select: profileSelect,
    });

    const token = generateToken(user);

    // A conta já entra, mas só reserva depois de confirmar o e-mail (SEC-02). As boas-vindas
    // vão depois da confirmação.
    const verification = await issueEmailConfirmation(
      user.id,
      data.email,
      EMAIL_VERIFICATION_TTL_MS,
    );
    notifyEmailVerification({
      id: user.id,
      name: user.name,
      email: data.email,
      ...verification,
    });

    return {
      user: toPublicUser(user),
      token,
    };
  }

  /** Reenvia o link de confirmação do e-mail do cadastro. */
  async resendEmailVerification(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, active: true, emailVerifiedAt: true },
    });

    if (!user?.active || !user.email) {
      throw httpError('Usuário não encontrado', 404);
    }

    if (user.emailVerifiedAt) {
      return { alreadyVerified: true };
    }

    const verification = await issueEmailConfirmation(
      user.id,
      user.email,
      EMAIL_VERIFICATION_TTL_MS,
    );
    notifyEmailVerification({
      id: user.id,
      name: user.name,
      email: user.email,
      ...verification,
    });

    return { alreadyVerified: false };
  }

  async login(data: LoginInput, ip = 'unknown') {
    // O bloqueio é do par e-mail + IP: quem erra a senha de outro lugar não tranca o dono da conta.
    const lockedUntil = loginLockedUntil(data.email, ip);
    if (lockedUntil) {
      throw loginLockedError(lockedUntil);
    }

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      select: { ...profileSelect, password: true },
    });

    const passwordOk = await bcrypt.compare(data.password, user?.password ?? DUMMY_PASSWORD_HASH);
    // Conta sem senha (cliente rápido ainda não ativado, UX-03) nunca autentica.
    const valid = Boolean(user?.active && user.password && passwordOk);

    if (!valid || !user) {
      const lockedNow = registerLoginFailure(data.email, ip);
      if (!consumeRateLimit(`login-fail:${ip}`, LOGIN_FAIL_IP_LIMIT, LOGIN_FAIL_IP_WINDOW_MS)) {
        throw httpError('Muitas tentativas. Tente novamente em instantes.', 429);
      }
      if (lockedNow) {
        throw loginLockedError(lockedNow);
      }
      throw httpError(INVALID_LOGIN_MESSAGE, 401);
    }

    clearLoginFailures(data.email, ip);
    const { password: _password, ...safeUser } = user;

    return {
      user: toPublicUser(safeUser),
      token: generateToken(safeUser),
    };
  }

  /** O que a tela do convite precisa para decidir entre "entrar" e "criar senha". */
  async previewEmployeeInvite(token: string) {
    const record = await findOpenInvite(token);
    const account = await prisma.user.findUnique({
      where: { email: record.email },
      select: { id: true, password: true },
    });
    return {
      email: record.email,
      employeeName: record.employee.name,
      // Conta sem senha (cliente rápido) segue o caminho de criar a senha.
      accountExists: Boolean(account?.password),
      expiresAt: record.expiresAt.toISOString(),
    };
  }

  /**
   * SEC-03: liga a conta ao profissional. O token prova que a pessoa recebe o e-mail; a sessão ou
   * a senha provam que a conta é dela. Quem cadastrou o e-mail antes com outra senha não ganha o
   * painel: o dono do e-mail usa "Esqueci a senha" e retoma a conta.
   */
  async acceptEmployeeInvite(input: AcceptInviteInput, sessionUserId?: string, ip = 'unknown') {
    const record = await findOpenInvite(input.token);
    const email = record.email.trim().toLowerCase();

    let userId: string | null = null;
    let newAccountPassword: string | null = null;

    if (sessionUserId) {
      const sessionUser = await prisma.user.findUnique({
        where: { id: sessionUserId },
        select: { id: true, email: true },
      });
      if (!sessionUser || sessionUser.email?.trim().toLowerCase() !== email) {
        throw httpError(
          `Este convite é para ${email}. Saia da conta atual e entre com esse e-mail.`,
          403,
          'INVITE_EMAIL_MISMATCH',
        );
      }
      userId = sessionUser.id;
    } else {
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true, password: true },
      });
      if (existing && !existing.password) {
        // Conta criada pela recepção, ainda sem senha (UX-03): o link prova que o e-mail é da
        // pessoa, então ela cria a senha aqui.
        const parsed = passwordSchema.safeParse(input.password ?? '');
        if (!parsed.success) {
          throw httpError(
            input.password ? parsed.error.issues[0].message : 'Crie uma senha para aceitar.',
            400,
            'WEAK_PASSWORD',
          );
        }
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            password: await bcrypt.hash(parsed.data, BCRYPT_ROUNDS),
            passwordChangedAt: new Date(),
          },
        });
        userId = existing.id;
      } else if (existing) {
        if (!input.password) {
          throw httpError('Entre com a senha da sua conta para aceitar.', 401, 'PASSWORD_REQUIRED');
        }
        // Mesmo caminho do login: bloqueio por e-mail + IP e mensagem genérica.
        const session = await this.login({ email, password: input.password }, ip);
        userId = session.user.id;
      } else {
        const parsed = passwordSchema.safeParse(input.password ?? '');
        if (!parsed.success) {
          throw httpError(
            input.password ? parsed.error.issues[0].message : 'Crie uma senha para aceitar.',
            400,
            'WEAK_PASSWORD',
          );
        }
        newAccountPassword = await bcrypt.hash(parsed.data, BCRYPT_ROUNDS);
      }
    }

    const now = new Date();
    const linkedUserId = await prisma.$transaction(async (tx) => {
      const consumed = await tx.employeeInvite.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) {
        throw httpError(
          'Convite inválido ou expirado. Peça um novo ao estúdio.',
          400,
          'INVITE_INVALID',
        );
      }

      const accountId =
        userId ??
        (
          await tx.user.create({
            data: {
              name: record.employee.name,
              email,
              password: newAccountPassword!,
              // O link chegou neste e-mail: a pessoa provou que é dona dele.
              emailVerifiedAt: now,
            },
            select: { id: true },
          })
        ).id;

      const otherLink = await tx.employee.findUnique({ where: { userId: accountId } });
      if (otherLink) {
        throw httpError(
          'Esta conta já está ligada a outro profissional.',
          409,
          'ACCOUNT_ALREADY_LINKED',
        );
      }

      const linked = await tx.employee.updateMany({
        where: { id: record.employeeId, userId: null },
        data: { userId: accountId },
      });
      if (linked.count !== 1) {
        throw httpError('Este convite já foi aceito.', 409, 'ALREADY_LINKED');
      }

      await tx.employeeInvite.updateMany({
        where: { employeeId: record.employeeId, usedAt: null },
        data: { usedAt: now },
      });

      const account = await tx.user.findUniqueOrThrow({
        where: { id: accountId },
        select: { role: true, emailVerifiedAt: true },
      });
      await tx.user.update({
        where: { id: accountId },
        data: {
          // Admin continua admin; cliente passa a abrir o painel do profissional.
          ...(account.role === 'USER' && { role: 'EMPLOYEE' }),
          ...(!account.emailVerifiedAt && { emailVerifiedAt: now }),
        },
      });

      return accountId;
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: linkedUserId },
      select: profileSelect,
    });

    return {
      user: toPublicUser(user),
      token: generateToken(user),
    };
  }

  async logout(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: profileSelect,
    });

    if (!user) {
      throw httpError('Usuário não encontrado', 404);
    }

    return toPublicUser(user, await getPendingEmail(userId, user.email));
  }

  async updateProfile(userId: string, data: UpdateProfileInput) {
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, employee: { select: { id: true } } },
    });

    if (!current) {
      throw httpError('Usuário não encontrado', 404);
    }

    const emailChanged = data.email !== current.email?.trim().toLowerCase();
    // SEC-10: a resposta é a mesma se o e-mail novo já for de outra conta. Nesse caso o pedido
    // fica registrado, mas nenhum link é enviado (e a confirmação recusaria de qualquer forma).
    const emailTaken = emailChanged
      ? !(await isEmailAvailable(data.email, userId, current.employee?.id))
      : false;

    const phone = data.phone === undefined ? undefined : data.phone || null;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        ...(phone !== undefined && { phone }),
      },
      select: profileSelect,
    });

    await syncLinkedEmployee(userId, {
      name: data.name,
      phone,
    });

    let pendingEmail = await getPendingEmail(userId, user.email);

    if (emailChanged) {
      const { tokenId, confirmUrl } = await issueEmailConfirmation(
        userId,
        data.email,
        EMAIL_CHANGE_TTL_MS,
      );
      pendingEmail = data.email;

      if (!emailTaken) {
        notifyEmailChangeConfirm({
          id: user.id,
          name: user.name,
          email: data.email,
          tokenId,
          confirmUrl,
        });
      }
      if (current.email) {
        notifyEmailChangeNotice({
          id: user.id,
          name: user.name,
          email: current.email,
          newEmail: data.email,
          tokenId,
        });
      }
    }

    return toPublicUser(user, pendingEmail);
  }

  /**
   * Consome o link e confirma o e-mail: o do cadastro (mesmo endereço) ou um novo pedido no
   * perfil. Nos dois casos, quem abriu o link provou ser dono do endereço.
   */
  async confirmEmailChange(token: string) {
    const tokenHash = hashPasswordResetToken(token);
    const record = await prisma.emailChangeToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        newEmail: true,
        expiresAt: true,
        usedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            active: true,
            emailVerifiedAt: true,
            employee: { select: { id: true } },
          },
        },
      },
    });

    if (!record || record.usedAt || record.expiresAt <= new Date() || !record.user.active) {
      throw httpError('Link inválido ou expirado', 400);
    }

    await assertEmailAvailable(record.newEmail, record.userId, record.user.employee?.id);

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.emailChangeToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });

      if (consumed.count !== 1) {
        throw httpError('Link inválido ou expirado', 400);
      }

      await tx.user.update({
        where: { id: record.userId },
        data: { email: record.newEmail, emailVerifiedAt: now },
      });

      await tx.emailChangeToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: now },
      });
    });

    await syncLinkedEmployee(record.userId, { email: record.newEmail });

    const changed = record.newEmail !== record.user.email?.trim().toLowerCase();
    if (!record.user.emailVerifiedAt) {
      notifyWelcome({ id: record.user.id, name: record.user.name, email: record.newEmail });
    }

    return { changed };
  }

  async updateAvatar(userId: string, file: { buffer: Buffer }) {
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: profileSelect,
    });

    if (!current) {
      throw httpError('Usuário não encontrado', 404);
    }

    const key = await storageService.uploadAvatar(userId, file);
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatar: key },
      select: profileSelect,
    });

    const publicUser = toPublicUser(user, await getPendingEmail(userId, user.email));
    await syncLinkedEmployee(userId, { avatarUrl: publicUser.avatarUrl });

    if (current.avatar && current.avatar !== key) {
      storageService.deleteObject(current.avatar).catch((error) => {
        logger.warn({ err: error }, 'storage: falha ao remover avatar antigo');
      });
    }

    return publicUser;
  }

  async deleteAvatar(userId: string) {
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: profileSelect,
    });

    if (!current) {
      throw httpError('Usuário não encontrado', 404);
    }

    if (!current.avatar) {
      return toPublicUser(current, await getPendingEmail(userId, current.email));
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
      select: profileSelect,
    });

    await syncLinkedEmployee(userId, { avatarUrl: null });
    storageService.deleteObject(current.avatar).catch((error) => {
      logger.warn({ err: error }, 'storage: falha ao remover avatar');
    });

    return toPublicUser(user, await getPendingEmail(userId, user.email));
  }

  async getAvatarFile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    if (!user?.avatar) {
      throw httpError('Foto de perfil não encontrada', 404);
    }

    return storageService.getObjectStream(user.avatar);
  }

  async getClients(query: ListClientsQuery = {}) {
    const search = query.search?.trim() || undefined;
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where: Prisma.UserWhereInput = {};

    if (query.active === 'true') where.active = true;
    else if (query.active === 'false') where.active = false;
    else if (query.includeInactive !== 'true') where.active = true;

    if (query.role) where.role = query.role;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, clients] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: clientListSelect,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      clients: clients.map(mapClientListItem),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  /**
   * UX-03: a recepção cadastra quem ligou, sem senha. Com e-mail, a pessoa recebe um link para
   * criar a senha (o mesmo de "nova senha", com prazo de 7 dias); sem e-mail, a conta existe só
   * para a agenda. Contato repetido devolve 409 com o cliente que já existe.
   */
  async createClient(data: CreateClientInput) {
    const email = data.email || null;
    const phone = data.phone || null;

    if (email) {
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true, role: true },
      });
      if (existing) {
        throw httpError('Já existe uma conta com este e-mail.', 409, 'CLIENT_EXISTS', {
          client: existing,
          match: 'email',
        });
      }
    }

    if (phone) {
      const digits = phone.replace(/\D/g, '');
      const samePhone = await prisma.$queryRaw<Array<{ id: string; name: string; role: Role }>>`
        SELECT "id", "name", "role"::text AS "role" FROM "users"
         WHERE "phone" IS NOT NULL
           AND regexp_replace("phone", '\\D', '', 'g') = ${digits}
         ORDER BY "createdAt"
         LIMIT 1`;
      if (samePhone[0]) {
        throw httpError('Já existe um cliente com este telefone.', 409, 'CLIENT_EXISTS', {
          client: samePhone[0],
          match: 'phone',
        });
      }
    }

    const user = await prisma.user.create({
      data: { name: data.name, email, phone, password: null },
      select: clientListSelect,
    });

    let activationSent = false;
    if (email) {
      const { token, tokenHash } = createPasswordResetToken();
      const created = await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + ACCOUNT_ACTIVATION_TTL_MS),
        },
        select: { id: true },
      });
      notifyAccountActivation({
        id: user.id,
        name: user.name,
        email,
        tokenId: created.id,
        activateUrl: `${appUrl()}/reset-password#token=${encodeURIComponent(token)}`,
      });
      activationSent = true;
    }

    return { client: mapClientListItem(user), activationSent };
  }

  async getClientById(id: string) {
    const [user, appointments] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: clientListSelect,
      }),
      prisma.appointment.findMany({
        where: { clientId: id },
        include: appointmentInclude,
        orderBy: { date: 'desc' },
      }),
    ]);

    if (!user) {
      throw httpError('Cliente não encontrado', 404);
    }

    const mapped = appointments.map(mapAppointment);

    return {
      client: mapClientListItem(user),
      stats: buildClientStats(mapped),
      appointments: mapped,
    };
  }

  async requestPasswordReset(email: string) {
    const startedAt = Date.now();
    const allowed = consumeRateLimit(
      `forgot-email:${email}`,
      FORGOT_PASSWORD_EMAIL_LIMIT,
      FORGOT_PASSWORD_WINDOW_MS,
    );

    if (allowed) {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true, email: true, active: true },
      });

      if (user?.active && user.email) {
        const email = user.email;
        const { token, tokenHash } = createPasswordResetToken();
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
        const now = new Date();

        const created = await prisma.$transaction(async (tx) => {
          await tx.passwordResetToken.updateMany({
            where: { userId: user.id, usedAt: null },
            data: { usedAt: now },
          });
          return tx.passwordResetToken.create({
            data: { userId: user.id, tokenHash, expiresAt },
            select: { id: true },
          });
        });

        notifyPasswordReset({
          id: user.id,
          name: user.name,
          email,
          tokenId: created.id,
          resetUrl: `${appUrl()}/reset-password#token=${encodeURIComponent(token)}`,
        });
      }
    }

    await waitAtLeast(startedAt, 250);
    return GENERIC_RESET_MESSAGE;
  }

  async resetPassword(data: ResetPasswordInput) {
    const tokenHash = hashPasswordResetToken(data.token);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            active: true,
            password: true,
            emailVerifiedAt: true,
          },
        },
      },
    });

    if (!record || record.usedAt || record.expiresAt <= new Date() || !record.user.active) {
      throw httpError('Link inválido ou expirado', 400);
    }

    // Conta sem senha (cliente rápido, UX-03): este link é a ativação, não há senha anterior.
    const samePassword = record.user.password
      ? await bcrypt.compare(data.password, record.user.password)
      : false;
    if (samePassword) {
      throw httpError('A nova senha deve ser diferente da senha atual', 400);
    }

    const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const passwordChangedAt = new Date();

    await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: passwordChangedAt },
      });

      if (consumed.count !== 1) {
        throw httpError('Link inválido ou expirado', 400);
      }

      await tx.user.update({
        where: { id: record.userId },
        data: {
          password: hashedPassword,
          passwordChangedAt,
          tokenVersion: { increment: 1 },
          // O link chegou nesse e-mail: a pessoa provou que é dona dele.
          ...(!record.user.emailVerifiedAt && { emailVerifiedAt: passwordChangedAt }),
        },
      });

      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: passwordChangedAt },
      });
    });

    // Quem provou ser dono do e-mail volta a entrar na hora, de qualquer IP.
    if (record.user.email) {
      clearLoginFailures(record.user.email);
      // Na ativação (conta sem senha) não há "senha alterada" para avisar.
      if (record.user.password) {
        notifyPasswordChanged({
          id: record.user.id,
          name: record.user.name,
          email: record.user.email,
          changedAt: passwordChangedAt,
        });
      }
    }
  }

  async changePassword(userId: string, data: ChangePasswordInput) {
    if (
      !consumeRateLimit(
        `change-password:${userId}`,
        CHANGE_PASSWORD_LIMIT,
        CHANGE_PASSWORD_WINDOW_MS,
      )
    ) {
      throw httpError('Muitas tentativas. Tente novamente em instantes.', 429);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { ...profileSelect, password: true, active: true },
    });

    if (!user?.active || !user.password) {
      throw httpError('Usuário não encontrado', 404);
    }

    const isCurrentValid = await bcrypt.compare(data.currentPassword, user.password);
    if (!isCurrentValid) {
      throw httpError('Senha atual incorreta', 400);
    }

    const isSamePassword = await bcrypt.compare(data.newPassword, user.password);
    if (isSamePassword) {
      throw httpError('A nova senha deve ser diferente da atual', 400);
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, BCRYPT_ROUNDS);
    const passwordChangedAt = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          passwordChangedAt,
          tokenVersion: { increment: 1 },
        },
        select: profileSelect,
      });

      await tx.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: passwordChangedAt },
      });

      return nextUser;
    });

    if (updated.email) {
      notifyPasswordChanged({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        changedAt: passwordChangedAt,
      });
    }

    return {
      user: toPublicUser(updated, await getPendingEmail(userId, updated.email)),
      token: generateToken(updated),
    };
  }
}
