import { Router } from 'express';
import { asyncController } from '../lib/async-handler';
import { AuthController } from '../controllers/auth.controller';
import { rateLimitByIp } from '../middlewares/rate-limit.middleware';

const usersRouter = Router();
const authController = asyncController(new AuthController());

/**
 * @swagger
 * /api/users/{id}/avatar:
 *   get:
 *     summary: Foto de perfil pública
 *     description: >-
 *       Entrega a foto armazenada no bucket, se existir. Pública (um `<img>` não envia o token),
 *       com limite de requisições por IP.
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Imagem da foto de perfil
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Foto não encontrada
 *       429:
 *         description: Muitas requisições deste IP
 */
usersRouter.get('/:id/avatar', rateLimitByIp('avatar', 600, 60 * 1000), (req, res, next) =>
  authController.getAvatar(req, res, next),
);

export { usersRouter };
