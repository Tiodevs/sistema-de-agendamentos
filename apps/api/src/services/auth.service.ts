import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { RegisterInput, LoginInput, UpdateProfileInput } from '../schemas/auth.schema';
import { notifyWelcome } from './email.service';
import { storageService } from './storage.service';
import { userAvatarUrl } from '../lib/avatar';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

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
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
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

function httpError(message: string, statusCode: number) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
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

    const hashedPassword = await bcrypt.hash(data.password, 12);

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
}
