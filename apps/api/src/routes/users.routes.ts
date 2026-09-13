import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

const usersRouter = Router();
const authController = new AuthController();

/**
 * @swagger
 * /api/users/{id}/avatar:
 *   get:
 *     summary: Foto de perfil pública
 *     description: Entrega a foto armazenada no bucket, se existir.
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
 */
usersRouter.get('/:id/avatar', (req, res, next) => authController.getAvatar(req, res, next));

export { usersRouter };
