import { Router } from 'express';
import { EmployeeController } from '../controllers/employee.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/admin.middleware';

const employeeRouter = Router();
const employeeController = new EmployeeController();

/**
 * @swagger
 * components:
 *   schemas:
 *     Employee:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *           example: "João Silva"
 *         email:
 *           type: string
 *           example: "joao@email.com"
 *         phone:
 *           type: string
 *           nullable: true
 *           example: "(11) 99999-0000"
 *         avatar:
 *           type: string
 *           nullable: true
 *         active:
 *           type: boolean
 *           example: true
 *         products:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               product:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   price:
 *                     type: number
 *                   duration:
 *                     type: integer
 *                   active:
 *                     type: boolean
 *               assignedAt:
 *                 type: string
 *                 format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     CreateEmployeeInput:
 *       type: object
 *       required:
 *         - name
 *         - email
 *       properties:
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 150
 *           example: "João Silva"
 *         email:
 *           type: string
 *           format: email
 *           example: "joao@email.com"
 *         phone:
 *           type: string
 *           maxLength: 20
 *           example: "(11) 99999-0000"
 *         avatar:
 *           type: string
 *           format: uri
 *     UpdateEmployeeInput:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         email:
 *           type: string
 *         phone:
 *           type: string
 *         avatar:
 *           type: string
 *     AssignProductsInput:
 *       type: object
 *       required:
 *         - productIds
 *       properties:
 *         productIds:
 *           type: array
 *           items:
 *             type: string
 *           description: "Array com IDs dos produtos a serem atribuídos"
 *           example: ["clxx123", "clxx456"]
 */

/**
 * @swagger
 * /api/employees:
 *   get:
 *     summary: Listar todos os funcionários
 *     description: Retorna todos os funcionários ativos com seus produtos. Admins podem incluir inativos.
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *         description: Incluir funcionários inativos (apenas admin)
 *     responses:
 *       200:
 *         description: Lista de funcionários
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
 *                     employees:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Employee'
 */
employeeRouter.get('/', authMiddleware, (req, res, next) =>
  employeeController.findAll(req, res, next),
);

/**
 * @swagger
 * /api/employees/{id}:
 *   get:
 *     summary: Buscar funcionário por ID
 *     tags: [Employees]
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
 *         description: Funcionário encontrado
 *       404:
 *         description: Funcionário não encontrado
 */
employeeRouter.get('/:id', authMiddleware, (req, res, next) =>
  employeeController.findById(req, res, next),
);

/**
 * @swagger
 * /api/employees:
 *   post:
 *     summary: Cadastrar novo funcionário (Admin)
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateEmployeeInput'
 *     responses:
 *       201:
 *         description: Funcionário cadastrado com sucesso
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: E-mail já cadastrado
 *       403:
 *         description: Acesso restrito a administradores
 */
employeeRouter.post('/', authMiddleware, adminMiddleware, (req, res, next) =>
  employeeController.create(req, res, next),
);

/**
 * @swagger
 * /api/employees/{id}:
 *   put:
 *     summary: Atualizar funcionário (Admin)
 *     tags: [Employees]
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
 *             $ref: '#/components/schemas/UpdateEmployeeInput'
 *     responses:
 *       200:
 *         description: Funcionário atualizado
 *       404:
 *         description: Funcionário não encontrado
 *       409:
 *         description: E-mail já cadastrado
 */
employeeRouter.put('/:id', authMiddleware, adminMiddleware, (req, res, next) =>
  employeeController.update(req, res, next),
);

/**
 * @swagger
 * /api/employees/{id}/toggle:
 *   patch:
 *     summary: Ativar/desativar funcionário (Admin)
 *     tags: [Employees]
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
 *         description: Status do funcionário alterado
 */
employeeRouter.patch('/:id/toggle', authMiddleware, adminMiddleware, (req, res, next) =>
  employeeController.toggleActive(req, res, next),
);

/**
 * @swagger
 * /api/employees/{id}:
 *   delete:
 *     summary: Excluir funcionário (Admin)
 *     tags: [Employees]
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
 *         description: Funcionário excluído
 *       404:
 *         description: Funcionário não encontrado
 */
employeeRouter.delete('/:id', authMiddleware, adminMiddleware, (req, res, next) =>
  employeeController.delete(req, res, next),
);

/**
 * @swagger
 * /api/employees/{id}/products:
 *   put:
 *     summary: Atribuir produtos a um funcionário (Admin)
 *     description: Substitui todos os produtos atribuídos ao funcionário pelos informados no body.
 *     tags: [Employees]
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
 *             $ref: '#/components/schemas/AssignProductsInput'
 *     responses:
 *       200:
 *         description: Produtos atribuídos com sucesso
 *       400:
 *         description: Um ou mais produtos não encontrados
 *       404:
 *         description: Funcionário não encontrado
 */
employeeRouter.put('/:id/products', authMiddleware, adminMiddleware, (req, res, next) =>
  employeeController.assignProducts(req, res, next),
);

export { employeeRouter };
