import { Request, Response, NextFunction } from 'express';
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
} from '../schemas/auth.schema';
import { z } from 'zod';
import { clientIp } from '../lib/request-ip';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';

const authService = new AuthService();

function formatZodErrors(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const data = registerSchema.parse(req.body);
      const result = await authService.register(data);

      res.status(201).json({
        status: 'success',
        message: 'Conta criada com sucesso',
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          status: 'error',
          message: 'Dados inválidos',
          errors: formatZodErrors(error),
        });
        return;
      }
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data = loginSchema.parse(req.body);
      const result = await authService.login(data, clientIp(req));

      res.status(200).json({
        status: 'success',
        message: 'Login realizado com sucesso',
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          status: 'error',
          message: 'Dados inválidos',
          errors: formatZodErrors(error),
        });
        return;
      }
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as Request & { user: { id: string } }).user.id;
      await authService.logout(userId);

      res.status(200).json({
        status: 'success',
        message: 'Sessão encerrada',
      });
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as Request & { user: { id: string } }).user.id;
      const user = await authService.getProfile(userId);

      res.status(200).json({
        status: 'success',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as Request & { user: { id: string } }).user.id;
      const data = updateProfileSchema.parse(req.body);
      const user = await authService.updateProfile(userId, data);

      res.status(200).json({
        status: 'success',
        message: 'Perfil atualizado com sucesso',
        data: { user },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          status: 'error',
          message: 'Dados inválidos',
          errors: formatZodErrors(error),
        });
        return;
      }
      next(error);
    }
  }

  async updateAvatar(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as Request & { user: { id: string } }).user.id;
      const file = req.file;

      if (!file) {
        res.status(400).json({
          status: 'error',
          message: 'Envie uma foto de perfil',
        });
        return;
      }

      const user = await authService.updateAvatar(userId, {
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
      });

      res.status(200).json({
        status: 'success',
        message: 'Foto de perfil atualizada',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteAvatar(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as Request & { user: { id: string } }).user.id;
      const user = await authService.deleteAvatar(userId);

      res.status(200).json({
        status: 'success',
        message: 'Foto de perfil removida',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  async getAvatar(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.params.id as string;
      const file = await authService.getAvatarFile(userId);
      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.send(file.body);
    } catch (error) {
      next(error);
    }
  }

  async getClients(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listClientsQuerySchema.parse(req.query);
      const result = await authService.getClients(query);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          status: 'error',
          message: 'Dados inválidos',
          errors: formatZodErrors(error),
        });
        return;
      }
      next(error);
    }
  }

  async getClientById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.getClientById(req.params.id as string);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const data = forgotPasswordSchema.parse(req.body);
      const message = await authService.requestPasswordReset(data.email);

      res.status(200).json({
        status: 'success',
        message,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          status: 'error',
          message: 'Dados inválidos',
          errors: formatZodErrors(error),
        });
        return;
      }
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const data = resetPasswordSchema.parse(req.body);
      await authService.resetPassword(data);

      res.status(200).json({
        status: 'success',
        message: 'Senha redefinida com sucesso. Entre com a nova senha.',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          status: 'error',
          message: 'Dados inválidos',
          errors: formatZodErrors(error),
        });
        return;
      }
      next(error);
    }
  }

  /** SEC-03: dados do convite para a tela decidir entre entrar e criar senha. */
  async previewInvite(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = invitePreviewSchema.parse(req.body);
      const invite = await authService.previewEmployeeInvite(token);
      res.status(200).json({ status: 'success', data: { invite } });
    } catch (error) {
      next(error);
    }
  }

  /** SEC-03: aceita o convite e devolve a sessão já com o papel de profissional. */
  async acceptInvite(req: Request, res: Response, next: NextFunction) {
    try {
      const data = acceptInviteSchema.parse(req.body);
      const sessionUserId = (req as Partial<AuthenticatedRequest>).user?.id;
      const result = await authService.acceptEmployeeInvite(data, sessionUserId, clientIp(req));
      res.status(200).json({
        status: 'success',
        message: 'Convite aceito. Sua agenda já está disponível.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async confirmEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const data = confirmEmailSchema.parse(req.body);
      const result = await authService.confirmEmailChange(data.token);

      res.status(200).json({
        status: 'success',
        message: result.changed
          ? 'E-mail confirmado com sucesso. Entre de novo se a sessão não atualizar.'
          : 'E-mail confirmado. Você já pode agendar.',
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          status: 'error',
          message: 'Dados inválidos',
          errors: formatZodErrors(error),
        });
        return;
      }
      next(error);
    }
  }

  async resendEmailVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as Request & { user: { id: string } }).user.id;
      const result = await authService.resendEmailVerification(userId);

      res.status(200).json({
        status: 'success',
        message: result.alreadyVerified
          ? 'Seu e-mail já está confirmado.'
          : 'Enviamos um novo link de confirmação para o seu e-mail.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as Request & { user: { id: string } }).user.id;
      const data = changePasswordSchema.parse(req.body);
      const result = await authService.changePassword(userId, data);

      res.status(200).json({
        status: 'success',
        message: 'Senha atualizada com sucesso',
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          status: 'error',
          message: 'Dados inválidos',
          errors: formatZodErrors(error),
        });
        return;
      }
      next(error);
    }
  }
}
