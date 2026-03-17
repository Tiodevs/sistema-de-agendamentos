import { Router, Request, Response } from 'express';

const healthRouter = Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Verificar saúde da API
 *     description: Retorna o status atual da API, timestamp e uptime do servidor.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API funcionando corretamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2026-03-17T12:00:00.000Z"
 *                 uptime:
 *                   type: number
 *                   description: Tempo de atividade do servidor em segundos
 *                   example: 1234.56
 */
healthRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export { healthRouter };
