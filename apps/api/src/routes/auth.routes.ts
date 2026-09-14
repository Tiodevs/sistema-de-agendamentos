import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { adminMiddleware } from '../middlewares/admin.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import { rateLimitByIp } from '../middlewares/rate-limit.middleware';
import { handleAvatarUpload } from '../middlewares/upload.middleware';

const authRouter = Router();
const authController = new AuthController();

/**
 * @swagger
 * components:
 *   schemas:
 *     RegisterInput:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *       properties:
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           example: "João Silva"
 *         email:
 *           type: string
 *           format: email
 *           example: "joao@email.com"
 *         password:
 *           type: string
 *           minLength: 8
 *           example: "Senha@123"
 *         phone:
 *           type: string
 *           example: "(11) 99999-9999"
 *     LoginInput:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "joao@email.com"
 *         password:
 *           type: string
 *           example: "Senha@123"
 *     AuthResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 phone:
 *                   type: string
 *                   nullable: true
 *                 role:
 *                   type: string
 *                 avatarUrl:
 *                   type: string
 *                   nullable: true
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *             token:
 *               type: string
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: error
 *         message:
 *           type: string
 *         errors:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *               message:
 *                 type: string
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Criar nova conta
 *     description: Registra um novo usuário no sistema.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterInput'
 *     responses:
 *       201:
 *         description: Conta criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: E-mail já em uso
 */
authRouter.post('/register', rateLimitByIp('register', 40, 60 * 60 * 1000), (req, res, next) =>
  authController.register(req, res, next),
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login na conta
 *     description: Autentica o usuário e retorna um token JWT (HS256). Sessões anteriores continuam válidas até expirar, logout ou troca de senha.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Credenciais inválidas
 */
authRouter.post('/login', rateLimitByIp('login', 80, 15 * 60 * 1000), (req, res, next) =>
  authController.login(req, res, next),
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Encerrar sessão no servidor
 *     description: Incrementa a versão da sessão do usuário. O JWT atual e os demais deixam de valer.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sessão encerrada
 *       401:
 *         description: Não autenticado
 */
authRouter.post('/logout', authMiddleware, (req, res, next) =>
  authController.logout(req, res, next),
);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Solicitar redefinição de senha
 *     description: Envia um e-mail com link temporário se o endereço estiver cadastrado. A resposta é sempre a mesma para não revelar contas existentes.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Pedido aceito
 *       400:
 *         description: Dados inválidos
 *       429:
 *         description: Muitas tentativas
 */
authRouter.post(
  '/forgot-password',
  rateLimitByIp('forgot-password', 8, 60 * 60 * 1000),
  (req, res, next) => authController.forgotPassword(req, res, next),
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Redefinir senha com o token do e-mail
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Senha redefinida
 *       400:
 *         description: Token inválido ou senha inválida
 *       429:
 *         description: Muitas tentativas
 */
authRouter.post(
  '/reset-password',
  rateLimitByIp('reset-password', 20, 60 * 60 * 1000),
  (req, res, next) => authController.resetPassword(req, res, next),
);

/**
 * @swagger
 * /api/auth/confirm-email:
 *   post:
 *     summary: Confirmar o novo e-mail do perfil
 *     description: Consome o token enviado ao endereço novo. Sem o link, o e-mail da conta não muda.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: E-mail confirmado
 *       400:
 *         description: Token inválido
 *       409:
 *         description: E-mail já em uso
 */
authRouter.post(
  '/confirm-email',
  rateLimitByIp('confirm-email', 20, 60 * 60 * 1000),
  (req, res, next) => authController.confirmEmail(req, res, next),
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Perfil do usuário autenticado
 *     description: Retorna os dados do usuário logado.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do perfil
 *       401:
 *         description: Não autenticado
 */
authRouter.get('/me', authMiddleware, (req, res, next) => authController.me(req, res, next));

/**
 * @swagger
 * /api/auth/profile:
 *   patch:
 *     summary: Atualizar perfil
 *     description: Atualiza nome e telefone na hora. E-mail novo só entra depois da confirmação pelo link enviado ao endereço novo.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Perfil atualizado
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autenticado
 *       409:
 *         description: E-mail já em uso
 */
authRouter.patch('/profile', authMiddleware, (req, res, next) =>
  authController.updateProfile(req, res, next),
);

/**
 * @swagger
 * /api/auth/password:
 *   post:
 *     summary: Alterar senha autenticado
 *     description: Exige a senha atual. Encerra as demais sessões e devolve um novo token.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Senha atualizada
 *       400:
 *         description: Senha atual incorreta ou nova senha inválida
 *       401:
 *         description: Não autenticado
 *       429:
 *         description: Muitas tentativas
 */
authRouter.post('/password', authMiddleware, (req, res, next) =>
  authController.changePassword(req, res, next),
);

/**
 * @swagger
 * /api/auth/profile/avatar:
 *   post:
 *     summary: Enviar foto de perfil
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Foto atualizada
 *       400:
 *         description: Arquivo inválido
 *   delete:
 *     summary: Remover foto de perfil
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Foto removida
 */
authRouter.post('/profile/avatar', authMiddleware, handleAvatarUpload, (req, res, next) =>
  authController.updateAvatar(req, res, next),
);
authRouter.delete('/profile/avatar', authMiddleware, (req, res, next) =>
  authController.deleteAvatar(req, res, next),
);

/**
 * @swagger
 * /api/auth/clients:
 *   get:
 *     summary: Listar clientes (Admin)
 *     description: Retorna usuários para a agenda e para a ficha de clientes. Sem filtros, só ativos (até 50).
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Filtrar por nome, e-mail ou telefone
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: string
 *           enum: [true, false]
 *       - in: query
 *         name: active
 *         schema:
 *           type: string
 *           enum: [true, false]
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [USER, ADMIN, EMPLOYEE]
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
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Lista de clientes
 */
authRouter.get('/clients', authMiddleware, adminMiddleware, (req, res, next) =>
  authController.getClients(req, res, next),
);

/**
 * @swagger
 * /api/auth/clients/{id}:
 *   get:
 *     summary: Ficha do cliente (Admin)
 *     description: Perfil, estatísticas e histórico de agendamentos de um usuário.
 *     tags: [Auth]
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
 *         description: Ficha do cliente
 *       404:
 *         description: Cliente não encontrado
 */
authRouter.get('/clients/:id', authMiddleware, adminMiddleware, (req, res, next) =>
  authController.getClientById(req, res, next),
);

export { authRouter };
