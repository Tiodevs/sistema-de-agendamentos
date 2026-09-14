import { Request, Response, NextFunction } from 'express';
import { EmployeeService } from '../services/employee.service';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  assignProductsSchema,
} from '../schemas/employee.schema';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { httpError } from '../lib/http-error';

const employeeService = new EmployeeService();

function formatZodErrors(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

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
        message: 'Funcionário cadastrado com sucesso',
        data: { employee },
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

  async toggleActive(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await employeeService.toggleActive(req.params.id as string);

      res.status(200).json({
        status: 'success',
        message: employee.active ? 'Funcionário ativado' : 'Funcionário desativado',
        data: { employee },
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

function toPublicEmployee<T extends { email?: string; phone?: string | null }>(employee: T) {
  const { email: _email, phone: _phone, ...rest } = employee;
  return rest;
}
