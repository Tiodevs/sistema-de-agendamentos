import { Request, Response } from 'express';
import { ScheduleService, type ScheduleMutationOptions } from '../services/schedule.service';
import {
  upsertBusinessHourSchema,
  upsertAllBusinessHoursSchema,
  createSpecialDaySchema,
  updateSpecialDaySchema,
  upsertAllEmployeeHoursSchema,
  createEmployeeSpecialDaySchema,
  updateEmployeeSpecialDaySchema,
  affectedDecisionQuerySchema,
} from '../schemas/schedule.schema';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';

const scheduleService = new ScheduleService();

/** Admin que salva + decisão sobre os agendamentos afetados (`?onAffected=keep|cancel`). */
function mutationOptions(req: Request): ScheduleMutationOptions {
  const { onAffected } = affectedDecisionQuerySchema.parse(req.query);
  return { actor: { role: 'ADMIN', userId: (req as AuthenticatedRequest).user.id }, onAffected };
}

/** Sem try/catch: o `asyncController` das rotas leva ZodError e erros de regra ao errorHandler. */
export class ScheduleController {
  /* ─── Business Hours ─── */

  async getBusinessHours(_req: Request, res: Response) {
    const hours = await scheduleService.getBusinessHours();
    res.status(200).json({
      status: 'success',
      data: { hours },
    });
  }

  async upsertBusinessHour(req: Request, res: Response) {
    const data = upsertBusinessHourSchema.parse(req.body);
    const { hour, impact } = await scheduleService.upsertBusinessHour(data, mutationOptions(req));
    res.status(200).json({
      status: 'success',
      message: 'Horário atualizado com sucesso',
      data: { hour, impact },
    });
  }

  async upsertAllBusinessHours(req: Request, res: Response) {
    const { hours } = upsertAllBusinessHoursSchema.parse(req.body);
    const result = await scheduleService.upsertAllBusinessHours(hours, mutationOptions(req));
    res.status(200).json({
      status: 'success',
      message: 'Horários atualizados com sucesso',
      data: result,
    });
  }

  /* ─── Special Days ─── */

  async getSpecialDays(_req: Request, res: Response) {
    const days = await scheduleService.getSpecialDays();
    res.status(200).json({
      status: 'success',
      data: { days },
    });
  }

  async createSpecialDay(req: Request, res: Response) {
    const data = createSpecialDaySchema.parse(req.body);
    const result = await scheduleService.createSpecialDay(data, mutationOptions(req));
    res.status(201).json({
      status: 'success',
      message: 'Dia especial criado com sucesso',
      data: result,
    });
  }

  async updateSpecialDay(req: Request, res: Response) {
    const data = updateSpecialDaySchema.parse(req.body);
    const result = await scheduleService.updateSpecialDay(
      req.params.id as string,
      data,
      mutationOptions(req),
    );
    res.status(200).json({
      status: 'success',
      message: 'Dia especial atualizado com sucesso',
      data: result,
    });
  }

  async deleteSpecialDay(req: Request, res: Response) {
    const result = await scheduleService.deleteSpecialDay(
      req.params.id as string,
      mutationOptions(req),
    );
    res.status(200).json({
      status: 'success',
      message: 'Dia especial excluído com sucesso',
      data: result,
    });
  }

  async listEmployeeSchedules(_req: Request, res: Response) {
    const employees = await scheduleService.listEmployeeScheduleSummaries();
    res.status(200).json({
      status: 'success',
      data: { employees },
    });
  }

  async getEmployeeSchedule(req: Request, res: Response) {
    const schedule = await scheduleService.getEmployeeSchedule(req.params.employeeId as string);
    res.status(200).json({
      status: 'success',
      data: schedule,
    });
  }

  async upsertEmployeeHours(req: Request, res: Response) {
    const { hours } = upsertAllEmployeeHoursSchema.parse(req.body);
    const schedule = await scheduleService.upsertEmployeeHours(
      req.params.employeeId as string,
      hours,
      mutationOptions(req),
    );
    res.status(200).json({
      status: 'success',
      message: 'Horário do profissional atualizado com sucesso',
      data: schedule,
    });
  }

  async resetEmployeeHours(req: Request, res: Response) {
    const schedule = await scheduleService.resetEmployeeHours(
      req.params.employeeId as string,
      mutationOptions(req),
    );
    res.status(200).json({
      status: 'success',
      message: 'Profissional voltou a usar o horário do estabelecimento',
      data: schedule,
    });
  }

  async createEmployeeSpecialDay(req: Request, res: Response) {
    const data = createEmployeeSpecialDaySchema.parse(req.body);
    const result = await scheduleService.createEmployeeSpecialDay(
      req.params.employeeId as string,
      data,
      mutationOptions(req),
    );
    res.status(201).json({
      status: 'success',
      message: 'Exceção do profissional criada com sucesso',
      data: result,
    });
  }

  async updateEmployeeSpecialDay(req: Request, res: Response) {
    const data = updateEmployeeSpecialDaySchema.parse(req.body);
    const result = await scheduleService.updateEmployeeSpecialDay(
      req.params.employeeId as string,
      req.params.id as string,
      data,
      mutationOptions(req),
    );
    res.status(200).json({
      status: 'success',
      message: 'Exceção do profissional atualizada com sucesso',
      data: result,
    });
  }

  async deleteEmployeeSpecialDay(req: Request, res: Response) {
    const result = await scheduleService.deleteEmployeeSpecialDay(
      req.params.employeeId as string,
      req.params.id as string,
      mutationOptions(req),
    );
    res.status(200).json({
      status: 'success',
      message: 'Exceção do profissional excluída com sucesso',
      data: result,
    });
  }
}
