import { pipeline } from 'node:stream/promises';
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  confirmEmailSchema,
  invitePreviewSchema,
  acceptInviteSchema,
  changePasswordSchema,
  listClientsQuerySchema,
  createClientSchema,
} from '../schemas/auth.schema';
import { clientIp } from '../lib/request-ip';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response) {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data);

    res.status(201).json({
      status: 'success',
      message: 'Conta criada com sucesso',
      data: result,
    });
  }

  async login(req: Request, res: Response) {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data, clientIp(req));

    res.status(200).json({
      status: 'success',
      message: 'Login realizado com sucesso',
      data: result,
    });
  }

  async logout(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    await authService.logout(userId);

    res.status(200).json({
      status: 'success',
      message: 'Sessão encerrada',
    });
  }

  async me(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const user = await authService.getProfile(userId);

    res.status(200).json({
      status: 'success',
      data: { user },
    });
  }

  async updateProfile(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const data = updateProfileSchema.parse(req.body);
    const user = await authService.updateProfile(userId, data);

    res.status(200).json({
      status: 'success',
      message: 'Perfil atualizado com sucesso',
      data: { user },
    });
  }

  async updateAvatar(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const file = req.file;

    if (!file) {
      res.status(400).json({
        status: 'error',
        message: 'Envie uma foto de perfil',
      });
      return;
    }

    const user = await authService.updateAvatar(userId, { buffer: file.buffer });

    res.status(200).json({
      status: 'success',
      message: 'Foto de perfil atualizada',
      data: { user },
    });
  }

  async deleteAvatar(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const user = await authService.deleteAvatar(userId);

    res.status(200).json({
      status: 'success',
      message: 'Foto de perfil removida',
      data: { user },
    });
  }

  async getAvatar(req: Request, res: Response) {
    const userId = req.params.id as string;
    const file = await authService.getAvatarFile(userId);
    res.setHeader('Content-Type', file.contentType);
    if (file.contentLength) res.setHeader('Content-Length', String(file.contentLength));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    // SEC-09: stream direto do bucket para a resposta, sem carregar a foto inteira na memória.
    await pipeline(file.stream, res);
  }

  async getClients(req: Request, res: Response) {
    const query = listClientsQuerySchema.parse(req.query);
    const result = await authService.getClients(query);

    res.status(200).json({
      status: 'success',
      data: result,
    });
  }

  /** UX-03: cadastro rápido de cliente pela recepção. */
  async createClient(req: Request, res: Response) {
    const data = createClientSchema.parse(req.body);
    const result = await authService.createClient(data);

    res.status(201).json({
      status: 'success',
      message: result.activationSent
        ? 'Cliente cadastrado. Enviamos um e-mail para ele criar a senha.'
        : 'Cliente cadastrado.',
      data: result,
    });
  }

  async getClientById(req: Request, res: Response) {
    const result = await authService.getClientById(req.params.id as string);

    res.status(200).json({
      status: 'success',
      data: result,
    });
  }

  async forgotPassword(req: Request, res: Response) {
    const data = forgotPasswordSchema.parse(req.body);
    const message = await authService.requestPasswordReset(data.email);

    res.status(200).json({
      status: 'success',
      message,
    });
  }

  async resetPassword(req: Request, res: Response) {
    const data = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(data);

    res.status(200).json({
      status: 'success',
      message: 'Senha redefinida com sucesso. Entre com a nova senha.',
    });
  }

  /** SEC-03: dados do convite para a tela decidir entre entrar e criar senha. */
  async previewInvite(req: Request, res: Response) {
    const { token } = invitePreviewSchema.parse(req.body);
    const invite = await authService.previewEmployeeInvite(token);
    res.status(200).json({ status: 'success', data: { invite } });
  }

  /** SEC-03: aceita o convite e devolve a sessão já com o papel de profissional. */
  async acceptInvite(req: Request, res: Response) {
    const data = acceptInviteSchema.parse(req.body);
    const sessionUserId = (req as Partial<AuthenticatedRequest>).user?.id;
    const result = await authService.acceptEmployeeInvite(data, sessionUserId, clientIp(req));
    res.status(200).json({
      status: 'success',
      message: 'Convite aceito. Sua agenda já está disponível.',
      data: result,
    });
  }

  async confirmEmail(req: Request, res: Response) {
    const data = confirmEmailSchema.parse(req.body);
    const result = await authService.confirmEmailChange(data.token);

    res.status(200).json({
      status: 'success',
      message: result.changed
        ? 'E-mail confirmado com sucesso. Entre de novo se a sessão não atualizar.'
        : 'E-mail confirmado. Você já pode agendar.',
      data: result,
    });
  }

  async resendEmailVerification(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const result = await authService.resendEmailVerification(userId);

    res.status(200).json({
      status: 'success',
      message: result.alreadyVerified
        ? 'Seu e-mail já está confirmado.'
        : 'Enviamos um novo link de confirmação para o seu e-mail.',
      data: result,
    });
  }

  async changePassword(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const data = changePasswordSchema.parse(req.body);
    const result = await authService.changePassword(userId, data);

    res.status(200).json({
      status: 'success',
      message: 'Senha atualizada com sucesso',
      data: result,
    });
  }
}
