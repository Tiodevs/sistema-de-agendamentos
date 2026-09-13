import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/admin.middleware';

const dashboardRouter = Router();
const dashboardController = new DashboardController();

/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     summary: Estatísticas do painel administrativo (Admin)
 *     description: Retorna métricas consolidadas da empresa — agendamentos, receita, ocupação, produtos e profissionais — com filtros de período.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month, last7, last30]
 *         description: Recorte temporal das métricas (padrão month)
 *       - in: query
 *         name: employeeId
 *         schema:
 *           type: string
 *         description: Filtrar por profissional
 *       - in: query
 *         name: productId
 *         schema:
 *           type: string
 *         description: Filtrar por serviço
 *     responses:
 *       200:
 *         description: Estatísticas do dashboard
 */
dashboardRouter.get('/stats', authMiddleware, adminMiddleware, (req, res, next) =>
  dashboardController.getStats(req, res, next),
);

export { dashboardRouter };
