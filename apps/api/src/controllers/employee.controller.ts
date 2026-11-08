import { Request, Response, NextFunction } from 'express';
import { EmployeeService } from '../services/employee.service';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  assignProductsSchema,
} from '../schemas/employee.schema';
import { affectedDecisionQuerySchema } from '../schemas/schedule.schema';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { httpError } from '../lib/http-error';

const employeeService = new EmployeeService();

/** Erros de validação (ZodError) e de regra seguem para o errorHandler. */
export class EmployeeController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const authReq = req as AuthenticatedRequest;
      if (includeInactive && authReq.user.role !== 'ADMIN') {
        throw httpError('Acesso restrito a administradores', 403);
      }

      const employees = await employeeService.findAll(includeInactive);
      const payload = authReq.user.role === 'ADMIN' ? employees : employees.map(toPublicEmployee);

      res.status(200).json({
        status: 'success',
        data: { employees: payload },
      });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const employee = await employeeService.findById(req.params.id as string);
      if (!employee.active && authReq.user.role !== 'ADMIN') {
        throw httpError('Funcionário não encontrado', 404);
      }

      res.status(200).json({
        status: 'success',
        data: {
          employee: authReq.user.role === 'ADMIN' ? employee : toPublicEmployee(employee),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createEmployeeSchema.parse(req.body);
      const employee = await employeeService.create(data);

      res.status(201).json({
        status: 'success',
        message: `Profissional cadastrado. Enviamos o convite de acesso para ${employee.email}.`,
        data: { employee },
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateEmployeeSchema.parse(req.body);
      const employee = await employeeService.update(req.params.id as string, data);

      res.status(200).json({
        status: 'success',
        message: 'Funcionário atualizado com sucesso',
        data: { employee },
      });
    } catch (error) {
      next(error);
    }
  }

  async toggleActive(req: Request, res: Response, next: NextFunction) {
    try {
      const { onAffected } = affectedDecisionQuerySchema.parse(req.query);
      const { employee, impact } = await employeeService.toggleActive(req.params.id as string, {
        actor: { role: 'ADMIN', userId: (req as AuthenticatedRequest).user.id },
        onAffected,
      });

      res.status(200).json({
        status: 'success',
        message: employee.active ? 'Funcionário ativado' : 'Funcionário desativado',
        data: { employee, impact },
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await employeeService.delete(req.params.id as string);

      res.status(200).json({
        status: 'success',
        message: 'Funcionário excluído com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }

  async sendInvite(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await employeeService.sendInvite(req.params.id as string);

      res.status(200).json({
        status: 'success',
        message: `Convite enviado para ${employee.email}.`,
        data: { employee },
      });
    } catch (error) {
      next(error);
    }
  }

  async revokeAccess(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await employeeService.revokeAccess(req.params.id as string);

      res.status(200).json({
        status: 'success',
        message: 'Acesso ao painel removido',
        data: { employee },
      });
    } catch (error) {
      next(error);
    }
  }

  async assignProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { productIds } = assignProductsSchema.parse(req.body);
      const employee = await employeeService.assignProducts(req.params.id as string, productIds);

      res.status(200).json({
        status: 'success',
        message: 'Produtos atribuídos com sucesso',
        data: { employee },
      });
    } catch (error) {
      next(error);
    }
  }
}

/** Para clientes: sem contato, sem dados de acesso e sem volume de agendamentos. */
function toPublicEmployee<
  T extends {
    email?: string;
    phone?: string | null;
    userId?: string | null;
    access?: unknown;
    appointmentCount?: number;
  },
>(employee: T) {
  const {
    email: _email,
    phone: _phone,
    userId: _userId,
    access: _access,
    appointmentCount: _appointmentCount,
    ...rest
  } = employee;
  return rest;
}
