import { Router } from 'express';
import { ScheduleController } from '../controllers/schedule.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/admin.middleware';

const scheduleRouter = Router();
const scheduleController = new ScheduleController();

/**
 * @swagger
 * components:
 *   schemas:
 *     BusinessHour:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         dayOfWeek:
 *           type: integer
 *           minimum: 0
 *           maximum: 6
 *           description: "0 = Domingo, 1 = Segunda, ..., 6 = Sábado"
 *         openTime:
 *           type: string
 *           example: "08:00"
 *         closeTime:
 *           type: string
 *           example: "18:00"
 *         isClosed:
 *           type: boolean
 *         dayName:
 *           type: string
 *     SpecialDay:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         date:
 *           type: string
 *           format: date
 *         title:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         isClosed:
 *           type: boolean
 *         openTime:
 *           type: string
 *           nullable: true
 *         closeTime:
 *           type: string
 *           nullable: true
 */

/**
 * @swagger
 * /api/schedule/business-hours:
 *   get:
 *     summary: Listar horários de funcionamento
 *     description: Retorna os horários de funcionamento de cada dia da semana. Rota pública (autenticado).
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de horários
 */
scheduleRouter.get('/business-hours', authMiddleware, (req, res, next) =>
  scheduleController.getBusinessHours(req, res, next),
);

/**
 * @swagger
 * /api/schedule/business-hours:
 *   put:
 *     summary: Atualizar todos os horários de funcionamento (Admin)
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hours
 *             properties:
 *               hours:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - dayOfWeek
 *                     - openTime
 *                     - closeTime
 *                   properties:
 *                     dayOfWeek:
 *                       type: integer
 *                     openTime:
 *                       type: string
 *                     closeTime:
 *                       type: string
 *                     isClosed:
 *                       type: boolean
 *     responses:
 *       200:
 *         description: Horários atualizados
 */
scheduleRouter.put('/business-hours', authMiddleware, adminMiddleware, (req, res, next) =>
  scheduleController.upsertAllBusinessHours(req, res, next),
);

/**
 * @swagger
 * /api/schedule/business-hours/day:
 *   put:
 *     summary: Atualizar horário de um dia específico (Admin)
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dayOfWeek
 *               - openTime
 *               - closeTime
 *             properties:
 *               dayOfWeek:
 *                 type: integer
 *               openTime:
 *                 type: string
 *               closeTime:
 *                 type: string
 *               isClosed:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Horário atualizado
 */
scheduleRouter.put('/business-hours/day', authMiddleware, adminMiddleware, (req, res, next) =>
  scheduleController.upsertBusinessHour(req, res, next),
);

/**
 * @swagger
 * /api/schedule/special-days:
 *   get:
 *     summary: Listar dias especiais
 *     description: Retorna todos os feriados e dias especiais cadastrados.
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de dias especiais
 */
scheduleRouter.get('/special-days', authMiddleware, (req, res, next) =>
  scheduleController.getSpecialDays(req, res, next),
);

/**
 * @swagger
 * /api/schedule/special-days:
 *   post:
 *     summary: Criar dia especial (Admin)
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - title
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2026-12-25"
 *               title:
 *                 type: string
 *                 example: "Natal"
 *               description:
 *                 type: string
 *               isClosed:
 *                 type: boolean
 *                 default: true
 *               openTime:
 *                 type: string
 *               closeTime:
 *                 type: string
 *     responses:
 *       201:
 *         description: Dia especial criado
 *       409:
 *         description: Já existe dia especial nesta data
 */
scheduleRouter.post('/special-days', authMiddleware, adminMiddleware, (req, res, next) =>
  scheduleController.createSpecialDay(req, res, next),
);

/**
 * @swagger
 * /api/schedule/special-days/{id}:
 *   put:
 *     summary: Atualizar dia especial (Admin)
 *     tags: [Schedule]
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
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               isClosed:
 *                 type: boolean
 *               openTime:
 *                 type: string
 *               closeTime:
 *                 type: string
 *     responses:
 *       200:
 *         description: Dia especial atualizado
 *       404:
 *         description: Dia especial não encontrado
 */
scheduleRouter.put('/special-days/:id', authMiddleware, adminMiddleware, (req, res, next) =>
  scheduleController.updateSpecialDay(req, res, next),
);

/**
 * @swagger
 * /api/schedule/special-days/{id}:
 *   delete:
 *     summary: Excluir dia especial (Admin)
 *     tags: [Schedule]
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
 *         description: Dia especial excluído
 *       404:
 *         description: Dia especial não encontrado
 */
scheduleRouter.delete('/special-days/:id', authMiddleware, adminMiddleware, (req, res, next) =>
  scheduleController.deleteSpecialDay(req, res, next),
);

/**
 * @swagger
 * /api/schedule/employees:
 *   get:
 *     summary: Resumo do expediente por profissional (Admin)
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de profissionais com indicação de horário próprio
 */
scheduleRouter.get('/employees', authMiddleware, adminMiddleware, (req, res, next) =>
  scheduleController.listEmployeeSchedules(req, res, next),
);

/**
 * @swagger
 * /api/schedule/employees/{employeeId}:
 *   get:
 *     summary: Expediente efetivo de um profissional
 *     description: Sem horário próprio, devolve o expediente do estabelecimento.
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Expediente do profissional
 */
scheduleRouter.get('/employees/:employeeId', authMiddleware, (req, res, next) =>
  scheduleController.getEmployeeSchedule(req, res, next),
);

/**
 * @swagger
 * /api/schedule/employees/{employeeId}/hours:
 *   put:
 *     summary: Personalizar expediente semanal do profissional (Admin)
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Horário do profissional atualizado
 */
scheduleRouter.put(
  '/employees/:employeeId/hours',
  authMiddleware,
  adminMiddleware,
  (req, res, next) => scheduleController.upsertEmployeeHours(req, res, next),
);

/**
 * @swagger
 * /api/schedule/employees/{employeeId}/hours:
 *   delete:
 *     summary: Voltar ao expediente do estabelecimento (Admin)
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Horário próprio removido
 */
scheduleRouter.delete(
  '/employees/:employeeId/hours',
  authMiddleware,
  adminMiddleware,
  (req, res, next) => scheduleController.resetEmployeeHours(req, res, next),
);

/**
 * @swagger
 * /api/schedule/employees/{employeeId}/special-days:
 *   post:
 *     summary: Criar folga ou horário especial do profissional (Admin)
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Exceção criada
 */
scheduleRouter.post(
  '/employees/:employeeId/special-days',
  authMiddleware,
  adminMiddleware,
  (req, res, next) => scheduleController.createEmployeeSpecialDay(req, res, next),
);

/**
 * @swagger
 * /api/schedule/employees/{employeeId}/special-days/{id}:
 *   put:
 *     summary: Atualizar exceção do profissional (Admin)
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Exceção atualizada
 */
scheduleRouter.put(
  '/employees/:employeeId/special-days/:id',
  authMiddleware,
  adminMiddleware,
  (req, res, next) => scheduleController.updateEmployeeSpecialDay(req, res, next),
);

/**
 * @swagger
 * /api/schedule/employees/{employeeId}/special-days/{id}:
 *   delete:
 *     summary: Excluir exceção do profissional (Admin)
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Exceção excluída
 */
scheduleRouter.delete(
  '/employees/:employeeId/special-days/:id',
  authMiddleware,
  adminMiddleware,
  (req, res, next) => scheduleController.deleteEmployeeSpecialDay(req, res, next),
);

export { scheduleRouter };
