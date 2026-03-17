import { Request, Response, NextFunction } from 'express';
import { AppointmentService } from '../services/appointment.service';
import {
  createAppointmentSchema,
  updateAppointmentStatusSchema,
  availabilitySlotsSchema,
} from '../schemas/appointment.schema';
import { z } from 'zod';

const appointmentService = new AppointmentService();

function formatZodErrors(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

export class AppointmentController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId, clientId, status, from, to } = req.query;
      const appointments = await appointmentService.findAll({
        employeeId: employeeId as string | undefined,
        clientId: clientId as string | undefined,
        status: status as string | undefined,
        from: from as string | undefined,
        to: to as string | undefined,
      });

      res.status(200).json({
        status: 'success',
        data: { appointments },
      });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const appointment = await appointmentService.findById(req.params.id as string);

      res.status(200).json({
        status: 'success',
        data: { appointment },
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createAppointmentSchema.parse(req.body);
      const appointment = await appointmentService.create(data);

      res.status(201).json({
        status: 'success',
        message: 'Agendamento criado com sucesso',
        data: { appointment },
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

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = updateAppointmentStatusSchema.parse(req.body);
      const appointment = await appointmentService.updateStatus(req.params.id as string, status);

      res.status(200).json({
        status: 'success',
        message: 'Status atualizado com sucesso',
        data: { appointment },
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

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await appointmentService.delete(req.params.id as string);

      res.status(200).json({
        status: 'success',
        message: 'Agendamento excluído com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }

  async getAvailableSlots(req: Request, res: Response, next: NextFunction) {
    try {
      const data = availabilitySlotsSchema.parse(req.query);
      const availability = await appointmentService.getAvailableSlots(
        data.employeeId,
        data.productId,
        data.date,
      );

      res.status(200).json({
        status: 'success',
        data: availability,
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
