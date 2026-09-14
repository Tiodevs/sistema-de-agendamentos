import { Router } from 'express';
import { ProfessionalController } from '../controllers/professional.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { professionalMiddleware } from '../middlewares/professional.middleware';

const professionalRouter = Router();
const professionalController = new ProfessionalController();

/**
 * @swagger
 * tags:
 *   name: Professional
 *   description: Endpoints para o painel do profissional
 */

/**
 * @swagger
 * /api/professional/dashboard:
 *   get:
 *     summary: Obter estatísticas do profissional
 *     tags: [Professional]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month, last7, last30]
 *         description: Recorte do dashboard
 *       - in: query
 *         name: productId
 *         schema:
 *           type: string
 *         description: Filtrar por serviço
 *     responses:
 *       200:
 *         description: Estatísticas retornadas com sucesso
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso restrito a profissionais
 */
professionalRouter.get(
  '/dashboard',
  authMiddleware,
  professionalMiddleware,
  professionalController.getDashboard.bind(professionalController),
);

/**
 * @swagger
 * /api/professional/appointments:
 *   get:
 *     summary: Listar agendamentos do profissional
 *     tags: [Professional]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Data inicial
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: Data final
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SCHEDULED, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW]
 *         description: Filtrar por status
 *     responses:
 *       200:
 *         description: Lista de agendamentos
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso restrito a profissionais
 */
professionalRouter.get(
  '/appointments',
  authMiddleware,
  professionalMiddleware,
  professionalController.getAppointments.bind(professionalController),
);

/**
 * @swagger
 * /api/professional/appointments/{id}/status:
 *   patch:
 *     summary: Atualizar status de um agendamento (CONFIRMED, IN_PROGRESS, COMPLETED)
 *     tags: [Professional]
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
 *                 enum: [CONFIRMED, IN_PROGRESS, COMPLETED]
 *     responses:
 *       200:
 *         description: Status atualizado
 *       403:
 *         description: Agendamento não pertence ao profissional
 *       404:
 *         description: Agendamento não encontrado
 */
professionalRouter.patch(
  '/appointments/:id/status',
  authMiddleware,
  professionalMiddleware,
  professionalController.updateAppointmentStatus.bind(professionalController),
);

export { professionalRouter };
