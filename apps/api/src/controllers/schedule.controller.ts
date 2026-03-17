import { Request, Response, NextFunction } from 'express';
import { ScheduleService } from '../services/schedule.service';
import {
  upsertBusinessHourSchema,
  upsertAllBusinessHoursSchema,
  createSpecialDaySchema,
  updateSpecialDaySchema,
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
}
