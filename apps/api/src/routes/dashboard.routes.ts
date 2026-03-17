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
 *     description: Retorna métricas consolidadas da empresa — agendamentos, receita, produtos, funcionários.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas do dashboard
 */
dashboardRouter.get('/stats', authMiddleware, adminMiddleware, (req, res, next) =>
  dashboardController.getStats(req, res, next),
);

export { dashboardRouter };
