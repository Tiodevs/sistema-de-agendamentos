import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { prisma } from '../config/database';

export interface ProfessionalRequest extends AuthenticatedRequest {
  employeeId: string;
}

export const professionalMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as AuthenticatedRequest).user;

  if (!user) {
    res.status(401).json({
      status: 'error',
      message: 'Não autenticado',
    });
    return;
  }

  // Buscar employee vinculado ao user
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
};
