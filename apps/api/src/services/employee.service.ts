import { prisma } from '../config/database';
import { CreateEmployeeInput, UpdateEmployeeInput } from '../schemas/employee.schema';

export class EmployeeService {
  async findAll(includeInactive = false) {
    const where = includeInactive ? {} : { active: true };
    return prisma.employee.findMany({
      where,
      include: {
        products: {
          include: {
            product: {
              select: { id: true, name: true, price: true, duration: true, active: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        products: {
          include: {
            product: {
              select: { id: true, name: true, price: true, duration: true, active: true },
            },
          },
        },
      },
    });

    if (!employee) {
      const error = new Error('Funcionário não encontrado') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    return employee;
  }

  async create(data: CreateEmployeeInput) {
    const existing = await prisma.employee.findUnique({ where: { email: data.email } });
    if (existing) {
      const error = new Error('Já existe um funcionário com este e-mail') as Error & { statusCode: number };
      error.statusCode = 409;
      throw error;
    }

    // Auto-vincular user por email se existir
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });

    const employee = await prisma.employee.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        avatar: data.avatar || null,
        ...(existingUser ? { userId: existingUser.id } : {}),
      },
      include: {
        products: {
          include: {
            product: {
              select: { id: true, name: true, price: true, duration: true, active: true },
            },
          },
        },
      },
    });

    // Se vinculou ao user, atualizar role para EMPLOYEE
    if (existingUser && existingUser.role === 'USER') {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { role: 'EMPLOYEE' },
      });
    }

    return employee;
  }

  async update(id: string, data: UpdateEmployeeInput) {
    await this.findById(id);

    if (data.email) {
      const existing = await prisma.employee.findFirst({
        where: { email: data.email, NOT: { id } },
      });
      if (existing) {
        const error = new Error('Já existe um funcionário com este e-mail') as Error & { statusCode: number };
        error.statusCode = 409;
        throw error;
      }
    }

    return prisma.employee.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.avatar !== undefined && { avatar: data.avatar || null }),
      },
      include: {
        products: {
          include: {
            product: {
              select: { id: true, name: true, price: true, duration: true, active: true },
            },
          },
        },
      },
    });
  }

  async toggleActive(id: string) {
    const existing = await this.findById(id);

    return prisma.employee.update({
      where: { id },
      data: { active: !existing.active },
      include: {
        products: {
          include: {
            product: {
              select: { id: true, name: true, price: true, duration: true, active: true },
            },
          },
        },
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await prisma.employee.delete({ where: { id } });
  }

  async assignProducts(employeeId: string, productIds: string[]) {
    await this.findById(employeeId);

    // Verificar se todos os produtos existem
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      const error = new Error('Um ou mais produtos não foram encontrados') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
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
