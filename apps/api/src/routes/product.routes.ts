import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/admin.middleware';

const productRouter = Router();
const productController = new ProductController();

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *           example: "Corte de Cabelo"
 *         description:
 *           type: string
 *           nullable: true
 *           example: "Corte masculino tradicional"
 *         price:
 *           type: number
 *           format: float
 *           example: 45.00
 *         duration:
 *           type: integer
 *           description: "Duração em minutos"
 *           example: 30
 *         active:
 *           type: boolean
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     CreateProductInput:
 *       type: object
 *       required:
 *         - name
 *         - price
 *         - duration
 *       properties:
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 150
 *           example: "Corte de Cabelo"
 *         description:
 *           type: string
 *           maxLength: 500
 *           example: "Corte masculino tradicional"
 *         price:
 *           type: number
 *           format: float
 *           minimum: 0.01
 *           example: 45.00
 *         duration:
 *           type: integer
 *           minimum: 5
 *           maximum: 480
 *           description: "Duração em minutos"
 *           example: 30
 *     UpdateProductInput:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         price:
 *           type: number
 *           format: float
 *         duration:
 *           type: integer
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Listar todos os produtos
 *     description: Retorna todos os produtos ativos. Admins podem incluir inativos com query param.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *         description: Incluir produtos inativos (apenas admin)
 *     responses:
 *       200:
 *         description: Lista de produtos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     products:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Product'
 */
productRouter.get('/', authMiddleware, (req, res, next) =>
  productController.findAll(req, res, next),
);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Buscar produto por ID
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Produto encontrado
 *       404:
 *         description: Produto não encontrado
 */
productRouter.get('/:id', authMiddleware, (req, res, next) =>
  productController.findById(req, res, next),
);

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Criar novo produto (Admin)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProductInput'
 *     responses:
 *       201:
 *         description: Produto criado com sucesso
 *       400:
 *         description: Dados inválidos
 *       403:
 *         description: Acesso restrito a administradores
 */
productRouter.post('/', authMiddleware, adminMiddleware, (req, res, next) =>
  productController.create(req, res, next),
);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Atualizar produto (Admin)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProductInput'
 *     responses:
 *       200:
 *         description: Produto atualizado
 *       404:
 *         description: Produto não encontrado
 */
productRouter.put('/:id', authMiddleware, adminMiddleware, (req, res, next) =>
  productController.update(req, res, next),
);

/**
 * @swagger
 * /api/products/{id}/toggle:
 *   patch:
 *     summary: Ativar/desativar produto (Admin)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status do produto alterado
 */
productRouter.patch('/:id/toggle', authMiddleware, adminMiddleware, (req, res, next) =>
  productController.toggleActive(req, res, next),
);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Excluir produto (Admin)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Produto excluído
 *       404:
 *         description: Produto não encontrado
 */
productRouter.delete('/:id', authMiddleware, adminMiddleware, (req, res, next) =>
  productController.delete(req, res, next),
);

export { productRouter };
