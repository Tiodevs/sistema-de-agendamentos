import { Router } from 'express';
import { asyncController } from '../lib/async-handler';
import { AppointmentController } from '../controllers/appointment.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/admin.middleware';
import { rateLimitByUser } from '../middlewares/rate-limit.middleware';

const appointmentRouter = Router();
const appointmentController = asyncController(new AppointmentController());

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
 *     description: >
 *       Permite que o usuário autenticado crie um agendamento para si mesmo. Exige e-mail
 *       confirmado, aceita até 3 agendamentos futuros por cliente e até 60 dias de antecedência.
 *       Limite de 30 pedidos por hora por usuário.
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
 *         description: Dados inválidos ou além da antecedência máxima (code BOOKING_TOO_FAR)
 *       403:
 *         description: E-mail não confirmado (code EMAIL_NOT_VERIFIED)
 *       409:
 *         description: Conflito de horário ou teto de agendamentos futuros (code BOOKING_LIMIT_REACHED)
 *       429:
 *         description: Muitas tentativas
 */
appointmentRouter.post(
  '/book',
  authMiddleware,
  rateLimitByUser('book', 30, 60 * 60 * 1000),
  (req, res, next) => appointmentController.createForUser(req, res, next),
);

/**
 * @swagger
 * /api/appointments/{id}/cancel:
 *   patch:
 *     summary: Cancelar meu agendamento (Usuário)
 *     description: >
 *       Permite que o usuário cancele um agendamento próprio, marcado ou confirmado, até a
 *       antecedência mínima (CANCELLATION_NOTICE_HOURS, padrão 2h). O cliente e o profissional
 *       recebem o aviso por e-mail. Cada agendamento da resposta traz `cancellableUntil`.
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
 *       409:
 *         description: Fora do prazo (code CANCELLATION_WINDOW_CLOSED) ou status final
 */
appointmentRouter.patch('/:id/cancel', authMiddleware, (req, res, next) =>
  appointmentController.cancelOwn(req, res, next),
);

/**
 * @swagger
 * /api/appointments:
 *   get:
 *     summary: Listar agendamentos (Admin)
 *     description: >-
 *       Agenda paginada, do mais próximo para o mais distante. Sem `from`, `to` ou `clientId`, a
 *       lista começa em hoje. A resposta traz `pagination` e o `period` aplicado.
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
 *       - in: query
 *         name: search
 *         description: Nome, e-mail ou telefone do cliente
 *         schema:
 *           type: string
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *     responses:
 *       200:
 *         description: Página de agendamentos, com `pagination` e `period`
 */
appointmentRouter.get('/', authMiddleware, adminMiddleware, (req, res, next) =>
  appointmentController.findAll(req, res, next),
);

/**
 * @swagger
 * /api/appointments/{id}:
 *   get:
 *     summary: Buscar agendamento por ID
 *     description: Admin vê qualquer agendamento. O cliente só vê o próprio.
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
 *     description: >
 *       Passa pela máquina de estados (DOM-01). Concluído, cancelado e falta são finais;
 *       concluir e registrar falta só depois do início. Cada agendamento das listas traz
 *       `allowedStatuses` com as mudanças possíveis agora. A resposta traz `undoUntil`: até lá, a
 *       mudança pode ser desfeita em `POST /appointments/{id}/status/undo` (cancelamento não).
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
 *       409:
 *         description: Transição inválida (codes FINAL_STATUS, INVALID_TRANSITION, TOO_EARLY, STATUS_CHANGED)
 */
appointmentRouter.patch('/:id/status', authMiddleware, adminMiddleware, (req, res, next) =>
  appointmentController.updateStatus(req, res, next),
);

/**
 * @swagger
 * /api/appointments/{id}/status/undo:
 *   post:
 *     summary: Desfazer a última mudança de status (Admin)
 *     description: Vale para a mudança feita pela mesma pessoa há até 10 minutos. Cancelamento não se desfaz.
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
 *         description: Mudança desfeita
 *       409:
 *         description: Nada para desfazer, prazo vencido ou horário já ocupado
 */
appointmentRouter.post('/:id/status/undo', authMiddleware, adminMiddleware, (req, res, next) =>
  appointmentController.undoStatus(req, res, next),
);

/**
 * @swagger
 * /api/appointments/{id}:
 *   delete:
 *     summary: Excluir agendamento (desativado)
 *     description: >
 *       Agendamentos não são excluídos, para preservar o histórico (DOM-04). Responde sempre 409
 *       APPOINTMENT_DELETE_DISABLED: use `PATCH /appointments/{id}/status` com CANCELLED.
 *     deprecated: true
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
 *       404:
 *         description: Agendamento não encontrado
 *       409:
 *         description: Exclusão desativada (code APPOINTMENT_DELETE_DISABLED)
 */
appointmentRouter.delete('/:id', authMiddleware, adminMiddleware, (req, res, next) =>
  appointmentController.delete(req, res, next),
);

export { appointmentRouter };
