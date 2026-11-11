import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { httpError } from '../lib/http-error';
import { adminMiddleware } from '../middlewares/admin.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import { emailOutboxOverview, retryFailedEmail } from '../services/email-outbox.service';

const adminRouter = Router();

adminRouter.use(authMiddleware, adminMiddleware);

/**
 * @swagger
 * /api/admin/email-outbox:
 *   get:
 *     summary: Fila de e-mails (Admin)
 *     description: >-
 *       Contagem por status e os e-mails que ainda não saíram (pendentes ou com falha), sem o
 *       conteúdo. Serve para ver se algum aviso ficou preso.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Situação da fila
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     counts:
 *                       type: object
 *                       properties:
 *                         PENDING:
 *                           type: integer
 *                         SENT:
 *                           type: integer
 *                         FAILED:
 *                           type: integer
 *                         SKIPPED:
 *                           type: integer
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso restrito a administradores
 */
adminRouter.get(
  '/email-outbox',
  asyncHandler(async (_req, res) => {
    const overview = await emailOutboxOverview();
    res.status(200).json({ status: 'success', data: overview });
  }),
);

/**
 * @swagger
 * /api/admin/email-outbox/{id}/retry:
 *   post:
 *     summary: Reenviar um e-mail que falhou (Admin)
 *     description: >-
 *       Recoloca na fila um e-mail com status FAILED. E-mails com link de uso único (redefinição
 *       de senha, confirmação, convite) não podem ser reenviados por aqui: peça um link novo.
 *     tags: [Admin]
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
 *         description: E-mail de volta à fila
 *       409:
 *         description: O e-mail não está com falha ou não pode mais ser reenviado
 */
adminRouter.post(
  '/email-outbox/:id/retry',
  asyncHandler(async (req, res) => {
    const item = await retryFailedEmail(String(req.params.id));
    if (!item) {
      throw httpError('Este e-mail não pode ser reenviado', 409, 'EMAIL_NOT_RETRIABLE');
    }
    res.status(200).json({ status: 'success', message: 'E-mail de volta à fila', data: { item } });
  }),
);

export { adminRouter };
