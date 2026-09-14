import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import {
  RegisterInput,
  LoginInput,
  UpdateProfileInput,
  ResetPasswordInput,
  ChangePasswordInput,
  ListClientsQuery,
} from '../schemas/auth.schema';
import { appointmentInclude, mapAppointment } from '../lib/appointment-map';
import {
  notifyEmailChangeConfirm,
  notifyEmailChangeNotice,
  notifyPasswordChanged,
  notifyPasswordReset,
  notifyWelcome,
} from './email.service';
import { storageService } from './storage.service';
import { userAvatarUrl } from '../lib/avatar';
import { httpError } from '../lib/http-error';
import { signAccessToken } from '../lib/jwt';
import {
  createPasswordResetToken,
  EMAIL_CHANGE_TTL_MS,
  hashPasswordResetToken,
  PASSWORD_RESET_TTL_MS,
} from '../lib/password-reset-token';
import {
  clearLoginFailures,
  consumeRateLimit,
  isLoginLocked,
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
  createdAt: true,
  updatedAt: true,
  tokenVersion: true,
  employee: { select: { id: true } },
} as const;

type ProfileRecord = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  role: string;
  active?: boolean;
  createdAt: Date;
  updatedAt?: Date;
  tokenVersion?: number;
  employee?: { id: string } | null;
  employeeId?: string | null;
};

function generateToken(user: ProfileRecord) {
  return signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion ?? 0,
  });
}

function toPublicUser(user: ProfileRecord, pendingEmail: string | null = null) {
  const employeeId = user.employeeId ?? user.employee?.id ?? null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    employeeId,
    avatarUrl: userAvatarUrl(user.id, user.avatar, user.updatedAt),
    pendingEmail,
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
  email: string;
  phone: string | null;
  role: string;
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

async function getPendingEmail(userId: string) {
  const pending = await prisma.emailChangeToken.findFirst({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: { newEmail: true },
  });
  return pending?.newEmail ?? null;
}

async function assertEmailAvailable(email: string, userId: string, employeeId?: string | null) {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser && existingUser.id !== userId) {
    throw httpError('E-mail já está em uso', 409);
  }

  if (employeeId) {
    const existingEmployee = await prisma.employee.findFirst({
      where: { email, NOT: { id: employeeId } },
    });
    if (existingEmployee) {
      throw httpError('E-mail já está em uso', 409);
    }
  }
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

    notifyWelcome({
      id: user.id,
      name: user.name,
      email: user.email,
    });

    return {
      user: toPublicUser(user),
      token,
    };
  }

  async login(data: LoginInput, ip = 'unknown') {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      select: { ...profileSelect, password: true },
    });

    const passwordOk = await bcrypt.compare(data.password, user?.password ?? DUMMY_PASSWORD_HASH);
    const locked = isLoginLocked(data.email);
    const valid = Boolean(user?.active && passwordOk);

    if (locked || !valid || !user) {
      if (!locked) {
        registerLoginFailure(data.email);
        if (!consumeRateLimit(`login-fail:${ip}`, LOGIN_FAIL_IP_LIMIT, LOGIN_FAIL_IP_WINDOW_MS)) {
          throw httpError('Muitas tentativas. Tente novamente em instantes.', 429);
        }
      }
      throw httpError(INVALID_LOGIN_MESSAGE, 401);
    }

    clearLoginFailures(data.email);
    const { password: _password, ...safeUser } = user;

    return {
      user: toPublicUser(safeUser),
      token: generateToken(safeUser),
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

    return toPublicUser(user, await getPendingEmail(userId));
  }

  async updateProfile(userId: string, data: UpdateProfileInput) {
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, employee: { select: { id: true } } },
    });

    if (!current) {
      throw httpError('Usuário não encontrado', 404);
    }

    const emailChanged = data.email !== current.email.trim().toLowerCase();
    if (emailChanged) {
      await assertEmailAvailable(data.email, userId, current.employee?.id);
    }

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

    let pendingEmail = await getPendingEmail(userId);

    if (emailChanged) {
      const { token, tokenHash } = createPasswordResetToken();
      const expiresAt = new Date(Date.now() + EMAIL_CHANGE_TTL_MS);
      const now = new Date();

      const created = await prisma.$transaction(async (tx) => {
        await tx.emailChangeToken.updateMany({
          where: { userId, usedAt: null },
          data: { usedAt: now },
        });
        return tx.emailChangeToken.create({
          data: { userId, newEmail: data.email, tokenHash, expiresAt },
          select: { id: true },
        });
      });

      pendingEmail = data.email;
      const confirmUrl = `${appUrl()}/confirm-email#token=${encodeURIComponent(token)}`;

      notifyEmailChangeConfirm({
        id: user.id,
        name: user.name,
        email: data.email,
        tokenId: created.id,
        confirmUrl,
      });
      notifyEmailChangeNotice({
        id: user.id,
        name: user.name,
        email: current.email,
        newEmail: data.email,
        tokenId: created.id,
      });
    }

    return toPublicUser(user, pendingEmail);
  }

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
          select: { id: true, active: true, employee: { select: { id: true } } },
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
        data: { email: record.newEmail },
      });

      await tx.emailChangeToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: now },
      });
    });

    await syncLinkedEmployee(record.userId, { email: record.newEmail });
  }

  async updateAvatar(
    userId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
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

    const publicUser = toPublicUser(user, await getPendingEmail(userId));
    await syncLinkedEmployee(userId, { avatarUrl: publicUser.avatarUrl });

    if (current.avatar && current.avatar !== key) {
      storageService.deleteObject(current.avatar).catch((error) => {
        console.error('[storage] falha ao remover avatar antigo', error);
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
      return toPublicUser(current, await getPendingEmail(userId));
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
      select: profileSelect,
    });

    await syncLinkedEmployee(userId, { avatarUrl: null });
    storageService.deleteObject(current.avatar).catch((error) => {
      console.error('[storage] falha ao remover avatar', error);
    });

    return toPublicUser(user, await getPendingEmail(userId));
  }

  async getAvatarFile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    if (!user?.avatar) {
      throw httpError('Foto de perfil não encontrada', 404);
    }

    return storageService.getObject(user.avatar);
  }

  async getClients(query: ListClientsQuery = {}) {
    const search = query.search?.trim() || undefined;
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where: {
      active?: boolean;
      role?: string;
      OR?: Array<Record<string, unknown>>;
    } = {};

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

      if (user?.active) {
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
          email: user.email,
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
        user: { select: { id: true, name: true, email: true, active: true, password: true } },
      },
    });

    if (!record || record.usedAt || record.expiresAt <= new Date() || !record.user.active) {
      throw httpError('Link inválido ou expirado', 400);
    }

    const samePassword = await bcrypt.compare(data.password, record.user.password);
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
        },
      });

      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: passwordChangedAt },
      });
    });

    notifyPasswordChanged({
      id: record.user.id,
      name: record.user.name,
      email: record.user.email,
      changedAt: passwordChangedAt,
    });
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

    if (!user?.active) {
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

    notifyPasswordChanged({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      changedAt: passwordChangedAt,
    });

    return {
      user: toPublicUser(updated, await getPendingEmail(userId)),
      token: generateToken(updated),
    };
  }
}
