import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { prisma } from '../config/database';
import { asyncHandler } from '../lib/async-handler';

export interface ProfessionalRequest extends AuthenticatedRequest {
  employeeId: string;
}

export const professionalMiddleware = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      res.status(401).json({
        status: 'error',
        message: 'Não autenticado',
      });
      return;
    }

    // Erro de banco aqui segue pelo asyncHandler até o errorHandler (vira 503).
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      select: { id: true, active: true },
    });

    if (!employee) {
      res.status(403).json({
        status: 'error',
        message: 'Acesso restrito a profissionais vinculados',
      });
      return;
    }

    if (!employee.active) {
      res.status(403).json({
        status: 'error',
        message: 'Conta de profissional desativada',
      });
      return;
    }

    (req as ProfessionalRequest).employeeId = employee.id;
    next();
  },
);
