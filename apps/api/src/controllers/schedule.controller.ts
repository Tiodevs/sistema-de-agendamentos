import { Request, Response, NextFunction } from 'express';
import { ScheduleService } from '../services/schedule.service';
import {
  upsertBusinessHourSchema,
  upsertAllBusinessHoursSchema,
  createSpecialDaySchema,
  updateSpecialDaySchema,
  upsertAllEmployeeHoursSchema,
  createEmployeeSpecialDaySchema,
  updateEmployeeSpecialDaySchema,
} from '../schemas/schedule.schema';
import { z } from 'zod';

const scheduleService = new ScheduleService();

function formatZodErrors(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

export class ScheduleController {
  /* ─── Business Hours ─── */

  async getBusinessHours(_req: Request, res: Response, next: NextFunction) {
    try {
      const hours = await scheduleService.getBusinessHours();
      res.status(200).json({
        status: 'success',
        data: { hours },
      });
    } catch (error) {
      next(error);
    }
  }

  async upsertBusinessHour(req: Request, res: Response, next: NextFunction) {
    try {
      const data = upsertBusinessHourSchema.parse(req.body);
      const hour = await scheduleService.upsertBusinessHour(data);
      res.status(200).json({
        status: 'success',
        message: 'Horário atualizado com sucesso',
        data: { hour },
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

  async upsertAllBusinessHours(req: Request, res: Response, next: NextFunction) {
    try {
      const { hours } = upsertAllBusinessHoursSchema.parse(req.body);
      const result = await scheduleService.upsertAllBusinessHours(hours);
      res.status(200).json({
        status: 'success',
        message: 'Horários atualizados com sucesso',
        data: { hours: result },
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

  /* ─── Special Days ─── */

  async getSpecialDays(_req: Request, res: Response, next: NextFunction) {
    try {
      const days = await scheduleService.getSpecialDays();
      res.status(200).json({
        status: 'success',
        data: { days },
      });
    } catch (error) {
      next(error);
    }
  }

  async createSpecialDay(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createSpecialDaySchema.parse(req.body);
      const day = await scheduleService.createSpecialDay(data);
      res.status(201).json({
        status: 'success',
        message: 'Dia especial criado com sucesso',
        data: { day },
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

  async updateSpecialDay(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateSpecialDaySchema.parse(req.body);
      const day = await scheduleService.updateSpecialDay(req.params.id as string, data);
      res.status(200).json({
        status: 'success',
        message: 'Dia especial atualizado com sucesso',
        data: { day },
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

  async deleteSpecialDay(req: Request, res: Response, next: NextFunction) {
    try {
      await scheduleService.deleteSpecialDay(req.params.id as string);
      res.status(200).json({
        status: 'success',
        message: 'Dia especial excluído com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }

  async listEmployeeSchedules(_req: Request, res: Response, next: NextFunction) {
    try {
      const employees = await scheduleService.listEmployeeScheduleSummaries();
      res.status(200).json({
        status: 'success',
        data: { employees },
      });
    } catch (error) {
      next(error);
    }
  }

  async getEmployeeSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const schedule = await scheduleService.getEmployeeSchedule(req.params.employeeId as string);
      res.status(200).json({
        status: 'success',
        data: schedule,
      });
    } catch (error) {
      next(error);
    }
  }

  async upsertEmployeeHours(req: Request, res: Response, next: NextFunction) {
    try {
      const { hours } = upsertAllEmployeeHoursSchema.parse(req.body);
      const schedule = await scheduleService.upsertEmployeeHours(
        req.params.employeeId as string,
        hours,
      );
      res.status(200).json({
        status: 'success',
        message: 'Horário do profissional atualizado com sucesso',
        data: schedule,
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

  async resetEmployeeHours(req: Request, res: Response, next: NextFunction) {
    try {
      const schedule = await scheduleService.resetEmployeeHours(req.params.employeeId as string);
      res.status(200).json({
        status: 'success',
        message: 'Profissional voltou a usar o horário do estabelecimento',
        data: schedule,
      });
    } catch (error) {
      next(error);
    }
  }

  async createEmployeeSpecialDay(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createEmployeeSpecialDaySchema.parse(req.body);
      const day = await scheduleService.createEmployeeSpecialDay(
        req.params.employeeId as string,
        data,
      );
      res.status(201).json({
        status: 'success',
        message: 'Exceção do profissional criada com sucesso',
        data: { day },
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

  async updateEmployeeSpecialDay(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateEmployeeSpecialDaySchema.parse(req.body);
      const day = await scheduleService.updateEmployeeSpecialDay(
        req.params.employeeId as string,
        req.params.id as string,
        data,
      );
      res.status(200).json({
        status: 'success',
        message: 'Exceção do profissional atualizada com sucesso',
        data: { day },
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

  async deleteEmployeeSpecialDay(req: Request, res: Response, next: NextFunction) {
    try {
      await scheduleService.deleteEmployeeSpecialDay(
        req.params.employeeId as string,
        req.params.id as string,
      );
      res.status(200).json({
        status: 'success',
        message: 'Exceção do profissional excluída com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }
}
