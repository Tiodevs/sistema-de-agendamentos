import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { registerSchema, loginSchema, updateProfileSchema } from '../schemas/auth.schema';
import { z } from 'zod';

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
      const result = await authService.login(data);

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
      const search = req.query.search as string | undefined;
      const clients = await authService.getClients(search);

      res.status(200).json({
        status: 'success',
        data: { clients },
      });
    } catch (error) {
      next(error);
    }
  }
}
