import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { RegisterInput, LoginInput } from '../schemas/auth.schema';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

function generateToken(user: UserPayload): string {
  const expiresInSeconds = parseExpiresIn(JWT_EXPIRES_IN);
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: expiresInSeconds },
  );
}

function parseExpiresIn(value: string): number {
  const match = value.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 604800; // default 7 days
  const num = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return num;
    case 'm': return num * 60;
    case 'h': return num * 3600;
    case 'd': return num * 86400;
    default: return 604800;
  }
}

export class AuthService {
  async register(data: RegisterInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      const error = new Error('E-mail já está em uso') as Error & { statusCode: number };
      error.statusCode = 409;
      throw error;
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        phone: data.phone || null,
      },
    });

    const token = generateToken(user);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      const error = new Error('E-mail ou senha inválidos') as Error & { statusCode: number };
      error.statusCode = 401;
      throw error;
    }

    if (!user.active) {
      const error = new Error('Conta desativada') as Error & { statusCode: number };
      error.statusCode = 403;
      throw error;
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
      const error = new Error('E-mail ou senha inválidos') as Error & { statusCode: number };
      error.statusCode = 401;
      throw error;
    }

    // Verificar se o user tem employee vinculado
    const linkedEmployee = await prisma.employee.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    const token = generateToken(user);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        employeeId: linkedEmployee?.id || null,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        employee: { select: { id: true } },
      },
    });

    if (!user) {
      const error = new Error('Usuário não encontrado') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    return {
      ...user,
      employeeId: user.employee?.id || null,
    };
  }

  async getClients(search?: string) {
    const where: Record<string, unknown> = { active: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    return prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
      },
      orderBy: { name: 'asc' },
      take: 50,
    });
  }
}
