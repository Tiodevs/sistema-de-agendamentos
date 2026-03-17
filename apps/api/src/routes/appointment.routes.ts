import { Router } from 'express';
import { AppointmentController } from '../controllers/appointment.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/admin.middleware';

const appointmentRouter = Router();
const appointmentController = new AppointmentController();

/**
 * @swagger
 * components:
 *   schemas:
 *     Appointment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         date:
 *           type: string
 *           format: date-time
 *         endDate:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [SCHEDULED, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW]
 *         notes:
 *           type: string
 *           nullable: true
 *         price:
 *           type: number
 *         client:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             name:
 *               type: string
 *             email:
 *               type: string
 *             phone:
 *               type: string
 *         product:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             name:
 *               type: string
 *             duration:
 *               type: integer
 *             price:
 *               type: number
 *         employee:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             name:
 *               type: string
 *             email:
 *               type: string
 *             phone:
 *               type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     CreateAppointmentInput:
 *       type: object
 *       required:
 *         - productId
 *         - employeeId
 *         - clientId
 *         - date
 *       properties:
 *         productId:
 *           type: string
 *         employeeId:
 *           type: string
 *         clientId:
 *           type: string
 *         date:
 *           type: string
 *           format: date-time
 *           example: "2026-03-20T10:00:00.000Z"
 *         notes:
 *           type: string
 *           maxLength: 500
 *     AvailabilitySlot:
 *       type: object
 *       properties:
 *         start:
 *           type: string
 *           format: date-time
 *         end:
 *           type: string
 *           format: date-time
 *         available:
 *           type: boolean
 */

/**
 * @swagger
 * /api/appointments/availability:
 *   get:
 *     summary: Consultar horários disponíveis
 *     description: Retorna os slots disponíveis de um funcionário para um produto em uma data específica.
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-03-20"
 *     responses:
 *       200:
 *         description: Slots de disponibilidade
 */
appointmentRouter.get('/availability', authMiddleware, (req, res, next) =>
  appointmentController.getAvailableSlots(req, res, next),
);

/**
 * @swagger
 * /api/appointments/my:
 *   get:
 *     summary: Meus agendamentos (Usuário)
 *     description: Retorna os agendamentos do usuário autenticado.
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SCHEDULED, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW]
 *     responses:
 *       200:
 *         description: Meus agendamentos
 */
appointmentRouter.get('/my', authMiddleware, (req, res, next) =>
  appointmentController.findMyAppointments(req, res, next),
);

/**
 * @swagger
 * /api/appointments/book:
 *   post:
 *     summary: Agendar (Usuário)
 *     description: Permite que o usuário autenticado crie um agendamento para si mesmo.
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - employeeId
 *               - date
 *             properties:
 *               productId:
 *                 type: string
 *               employeeId:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-03-20T10:00:00.000Z"
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Agendamento criado com sucesso
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: Conflito de horário
 */
appointmentRouter.post('/book', authMiddleware, (req, res, next) =>
  appointmentController.createForUser(req, res, next),
);

/**
 * @swagger
 * /api/appointments/{id}/cancel:
 *   patch:
 *     summary: Cancelar meu agendamento (Usuário)
 *     description: Permite que o usuário cancele um agendamento próprio.
 *     tags: [Appointments]
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
 *         description: Agendamento cancelado
 *       403:
 *         description: Sem permissão
 *       404:
 *         description: Agendamento não encontrado
 */
appointmentRouter.patch('/:id/cancel', authMiddleware, (req, res, next) =>
  appointmentController.cancelOwn(req, res, next),
);

/**
 * @swagger
 * /api/appointments:
 *   get:
 *     summary: Listar agendamentos
 *     description: Retorna agendamentos com filtros opcionais.
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: employeeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SCHEDULED, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW]
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Lista de agendamentos
 */
appointmentRouter.get('/', authMiddleware, (req, res, next) =>
  appointmentController.findAll(req, res, next),
);

/**
 * @swagger
 * /api/appointments/{id}:
 *   get:
 *     summary: Buscar agendamento por ID
 *     tags: [Appointments]
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
 *         description: Agendamento encontrado
 *       404:
 *         description: Agendamento não encontrado
 */
appointmentRouter.get('/:id', authMiddleware, (req, res, next) =>
  appointmentController.findById(req, res, next),
);

/**
 * @swagger
 * /api/appointments:
 *   post:
 *     summary: Criar agendamento (Admin)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAppointmentInput'
 *     responses:
 *       201:
 *         description: Agendamento criado com sucesso
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: Conflito de horário
 */
appointmentRouter.post('/', authMiddleware, adminMiddleware, (req, res, next) =>
  appointmentController.create(req, res, next),
);

/**
 * @swagger
 * /api/appointments/{id}/status:
 *   patch:
 *     summary: Atualizar status do agendamento (Admin)
 *     tags: [Appointments]
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
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [SCHEDULED, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW]
 *     responses:
 *       200:
 *         description: Status atualizado
 *       404:
 *         description: Agendamento não encontrado
 */
appointmentRouter.patch('/:id/status', authMiddleware, adminMiddleware, (req, res, next) =>
  appointmentController.updateStatus(req, res, next),
);

/**
 * @swagger
 * /api/appointments/{id}:
 *   delete:
 *     summary: Excluir agendamento (Admin)
 *     tags: [Appointments]
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
 *         description: Agendamento excluído
 *       404:
 *         description: Agendamento não encontrado
 */
appointmentRouter.delete('/:id', authMiddleware, adminMiddleware, (req, res, next) =>
  appointmentController.delete(req, res, next),
);

export { appointmentRouter };
