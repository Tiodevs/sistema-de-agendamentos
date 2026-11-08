import { prisma } from '../config/database';
import { httpError } from '../lib/http-error';
import { CreateProductInput, UpdateProductInput } from '../schemas/product.schema';

type ProductRecord = {
  price: unknown;
  _count?: { appointments: number };
};

function toProduct<T extends ProductRecord>(product: T) {
  const { _count, ...rest } = product;
  return {
    ...rest,
    price: Number(product.price),
    ...(_count && { appointmentCount: _count.appointments }),
  };
}

export class ProductService {
  /** `withStats` (só admin): inclui `appointmentCount`, que decide entre excluir e desativar. */
  async findAll(includeInactive = false, withStats = false) {
    const where = includeInactive ? {} : { active: true };
    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
      ...(withStats && { include: { _count: { select: { appointments: true } } } }),
    });

    return products.map(toProduct);
  }

  async findById(id: string) {
    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) {
      throw httpError('Produto não encontrado', 404);
    }

    return toProduct(product);
  }

  async create(data: CreateProductInput) {
    const product = await prisma.product.create({
      data: {
        name: data.name,
        description: data.description || null,
        price: data.price,
        duration: data.duration,
      },
    });

    return toProduct(product);
  }

  async update(id: string, data: UpdateProductInput) {
    await this.findById(id);

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.duration !== undefined && { duration: data.duration }),
      },
    });

    return toProduct(product);
  }

  async toggleActive(id: string) {
    const existing = await this.findById(id);

    const product = await prisma.product.update({
      where: { id },
      data: { active: !existing.active },
    });

    return toProduct(product);
  }

  /** DOM-04: serviço com agendamentos no histórico não é excluído; o caminho é desativar. */
  async delete(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, _count: { select: { appointments: true } } },
    });
    if (!product) {
      throw httpError('Produto não encontrado', 404);
    }

    const count = product._count.appointments;
    if (count > 0) {
      throw httpError(
        `Este serviço tem ${count === 1 ? '1 agendamento' : `${count} agendamentos`} no histórico. Desative em vez de excluir, para manter o histórico.`,
        409,
        'HAS_APPOINTMENTS',
        { appointments: count },
      );
    }

    await prisma.product.delete({ where: { id } });
  }
}
