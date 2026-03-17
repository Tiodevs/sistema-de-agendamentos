import { prisma } from '../config/database';
import { CreateProductInput, UpdateProductInput } from '../schemas/product.schema';

export class ProductService {
  async findAll(includeInactive = false) {
    const where = includeInactive ? {} : { active: true };
    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return products.map((p) => ({
      ...p,
      price: Number(p.price),
    }));
  }

  async findById(id: string) {
    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) {
      const error = new Error('Produto não encontrado') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    return { ...product, price: Number(product.price) };
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

    return { ...product, price: Number(product.price) };
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

    return { ...product, price: Number(product.price) };
  }

  async toggleActive(id: string) {
    const existing = await this.findById(id);

    const product = await prisma.product.update({
      where: { id },
      data: { active: !existing.active },
    });

    return { ...product, price: Number(product.price) };
  }

  async delete(id: string) {
    await this.findById(id);
    await prisma.product.delete({ where: { id } });
  }
}
