import { Request, Response } from 'express';
import { ProductService } from '../services/product.service';
import { createProductSchema, updateProductSchema } from '../schemas/product.schema';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { httpError } from '../lib/http-error';

const productService = new ProductService();

export class ProductController {
  async findAll(req: Request, res: Response) {
    const includeInactive = req.query.includeInactive === 'true';
    const authReq = req as AuthenticatedRequest;
    if (includeInactive && authReq.user.role !== 'ADMIN') {
      throw httpError('Acesso restrito a administradores', 403);
    }

    const products = await productService.findAll(includeInactive, authReq.user.role === 'ADMIN');

    res.status(200).json({
      status: 'success',
      data: { products },
    });
  }

  async findById(req: Request, res: Response) {
    const authReq = req as AuthenticatedRequest;
    const product = await productService.findById(req.params.id as string);
    if (!product.active && authReq.user.role !== 'ADMIN') {
      throw httpError('Produto não encontrado', 404);
    }

    res.status(200).json({
      status: 'success',
      data: { product },
    });
  }

  async create(req: Request, res: Response) {
    const data = createProductSchema.parse(req.body);
    const product = await productService.create(data);

    res.status(201).json({
      status: 'success',
      message: 'Produto criado com sucesso',
      data: { product },
    });
  }

  async update(req: Request, res: Response) {
    const data = updateProductSchema.parse(req.body);
    const product = await productService.update(req.params.id as string, data);

    res.status(200).json({
      status: 'success',
      message: 'Produto atualizado com sucesso',
      data: { product },
    });
  }

  async toggleActive(req: Request, res: Response) {
    const product = await productService.toggleActive(req.params.id as string);

    res.status(200).json({
      status: 'success',
      message: product.active ? 'Produto ativado' : 'Produto desativado',
      data: { product },
    });
  }

  async delete(req: Request, res: Response) {
    await productService.delete(req.params.id as string);

    res.status(200).json({
      status: 'success',
      message: 'Produto excluído com sucesso',
    });
  }
}
