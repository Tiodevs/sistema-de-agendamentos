import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { buildSha } from '../lib/build-info';

const healthRouter = Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Verificar saúde da API
 *     description: >-
 *       Processo no ar, sem tocar no banco: é o health check do Railway. `build` é o commit da
 *       versão no ar, que a fumaça do deploy espera antes de testar.
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
 *                 build:
 *                   type: string
 *                   nullable: true
 *                   description: >-
 *                     Commit da versão no ar (`apps/api/BUILD_SHA`, gravado pelo deploy, ou
 *                     `RAILWAY_GIT_COMMIT_SHA`). `null` fora de um deploy.
 *                   example: 4c6e7e5652e08c84818a40f83b17463efce798f5
 */
healthRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    build: buildSha(),
  });
});

/**
 * @swagger
 * /api/health/ready:
 *   get:
 *     summary: Verificar se a API alcança o banco
 *     description: >-
 *       Faz um `SELECT 1` no Postgres. A fumaça do deploy e o E2E da CI usam esta rota para saber
 *       que a API está pronta para atender.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API e banco respondendo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 database:
 *                   type: string
 *                   example: ok
 *                 build:
 *                   type: string
 *                   nullable: true
 *                   example: 4c6e7e5652e08c84818a40f83b17463efce798f5
 *       503:
 *         description: O banco não respondeu
 */
healthRouter.get('/ready', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', database: 'ok', build: buildSha() });
  } catch (error) {
    console.error(
      `[health] banco indisponível: ${error instanceof Error ? error.message : String(error)}`,
    );
    res.status(503).json({
      status: 'error',
      message: 'Banco de dados indisponível',
      requestId: res.locals.requestId,
    });
  }
});

export { healthRouter };
