import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import {
  RegisterInput,
  LoginInput,
  UpdateProfileInput,
  ResetPasswordInput,
  ChangePasswordInput,
} from '../schemas/auth.schema';
import { notifyPasswordChanged, notifyPasswordReset, notifyWelcome } from './email.service';
import { storageService } from './storage.service';
import { userAvatarUrl } from '../lib/avatar';
import { httpError } from '../lib/http-error';
import { getJwtExpiresIn, getJwtSecret } from '../lib/jwt';
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  PASSWORD_RESET_TTL_MS,
} from '../lib/password-reset-token';
import { consumeRateLimit, waitAtLeast } from '../lib/rate-limit';
import { appUrl } from '../emails/brand';

const JWT_EXPIRES_IN = getJwtExpiresIn();
const BCRYPT_ROUNDS = 12;
const FORGOT_PASSWORD_EMAIL_LIMIT = 3;
const FORGOT_PASSWORD_WINDOW_MS = 60 * 60 * 1000;
const CHANGE_PASSWORD_LIMIT = 5;
const CHANGE_PASSWORD_WINDOW_MS = 15 * 60 * 1000;
const GENERIC_RESET_MESSAGE =
  'Se este e-mail estiver cadastrado, você receberá as instruções em instantes.';

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

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
  employee?: { id: string } | null;
  employeeId?: string | null;
};

function generateToken(user: UserPayload): string {
  const expiresInSeconds = parseExpiresIn(JWT_EXPIRES_IN);
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, getJwtSecret(), {
    expiresIn: expiresInSeconds,
  });
}

function parseExpiresIn(value: string): number {
  const match = value.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 604800; // default 7 days
  const num = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return num;
    case 'm':
      return num * 60;
    case 'h':
      return num * 3600;
    case 'd':
      return num * 86400;
    default:
      return 604800;
  }
}

function toPublicUser(user: ProfileRecord) {
  const employeeId = user.employeeId ?? user.employee?.id ?? null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    employeeId,
    avatarUrl: userAvatarUrl(user.id, user.avatar, user.updatedAt),
    createdAt: user.createdAt,
  };
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

  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      select: { ...profileSelect, password: true },
    });

    if (!user) {
      throw httpError('E-mail ou senha inválidos', 401);
    }

    if (!user.active) {
      throw httpError('Conta desativada', 403);
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
      throw httpError('E-mail ou senha inválidos', 401);
    }

    const token = generateToken(user);
    const { password: _password, ...safeUser } = user;

    return {
      user: toPublicUser(safeUser),
      token,
    };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: profileSelect,
    });

    if (!user) {
      throw httpError('Usuário não encontrado', 404);
    }

    return toPublicUser(user);
  }

  async updateProfile(userId: string, data: UpdateProfileInput) {
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, employee: { select: { id: true } } },
    });

    if (!current) {
      throw httpError('Usuário não encontrado', 404);
    }

    if (data.email !== current.email) {
      const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
      if (existingUser) {
        throw httpError('E-mail já está em uso', 409);
      }

      if (current.employee) {
        const existingEmployee = await prisma.employee.findFirst({
          where: { email: data.email, NOT: { id: current.employee.id } },
        });
        if (existingEmployee) {
          throw httpError('E-mail já está em uso', 409);
        }
      }
    }

    const phone = data.phone === undefined ? undefined : data.phone || null;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        email: data.email,
        ...(phone !== undefined && { phone }),
      },
      select: profileSelect,
    });

    await syncLinkedEmployee(userId, {
      name: data.name,
      email: data.email,
      phone,
    });

    return toPublicUser(user);
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

    const publicUser = toPublicUser(user);
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
      return toPublicUser(current);
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

    return toPublicUser(user);
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

  async getClients(search?: string) {
    const where: Record<string, unknown> = { active: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const clients = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatar: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
      take: 50,
    });

    return clients.map((client) => ({
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      role: client.role,
      avatarUrl: userAvatarUrl(client.id, client.avatar, client.updatedAt),
    }));
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
          resetUrl: `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`,
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
        data: { password: hashedPassword, passwordChangedAt },
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
        data: { password: hashedPassword, passwordChangedAt },
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
      user: toPublicUser(updated),
      token: generateToken(updated),
    };
  }
}
