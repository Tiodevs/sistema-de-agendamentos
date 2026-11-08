import { Request, Response, NextFunction } from 'express';
import { ProfessionalService } from '../services/professional.service';
import { withStatusActions } from '../services/appointment-status.service';
import { ProfessionalRequest } from '../middlewares/professional.middleware';
import { DASHBOARD_PERIODS, type DashboardPeriod } from '../services/dashboard.service';
import {
  professionalAppointmentsQuerySchema,
  updateAppointmentStatusSchema,
} from '../schemas/appointment.schema';

const professionalService = new ProfessionalService();

function asOptionalId(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function employeeActor(req: Request) {
  const professional = req as ProfessionalRequest;
  return {
    role: 'EMPLOYEE' as const,
    userId: professional.user.id,
    employeeId: professional.employeeId,
  };
}

/** O profissional não precisa do próprio contato em cada agendamento. */
function withoutEmployee<T extends { employee?: unknown }>(appointment: T) {
  const { employee: _employee, ...rest } = appointment;
  return rest;
}

export class ProfessionalController {
  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = (req as ProfessionalRequest).employeeId;
      const rawPeriod = String(req.query.period || 'month');
      const period = (
        DASHBOARD_PERIODS.includes(rawPeriod as DashboardPeriod) ? rawPeriod : 'month'
      ) as DashboardPeriod;
      const data = await professionalService.getDashboard(employeeId, {
        period,
        productId: asOptionalId(req.query.productId),
      });

      res.json({
        status: 'success',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAppointments(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = (req as ProfessionalRequest).employeeId;
      // Filtro inválido vira ZodError, e o errorHandler responde 400.
      const filters = professionalAppointmentsQuerySchema.parse(req.query);
      const appointments = await professionalService.getAppointments(employeeId, filters);
      const now = new Date();

      res.json({
        status: 'success',
        data: {
          appointments: appointments.map((item) => withStatusActions(item, 'EMPLOYEE', now)),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateAppointmentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = updateAppointmentStatusSchema.parse(req.body);
      const { appointment, undoUntil } = await professionalService.updateAppointmentStatus(
        employeeActor(req),
        req.params.id as string,
        status,
      );

      res.json({
        status: 'success',
        message: 'Status atualizado com sucesso',
        data: {
          appointment: withStatusActions(withoutEmployee(appointment), 'EMPLOYEE'),
          undoUntil,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async undoAppointmentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const appointment = await professionalService.undoAppointmentStatus(
        employeeActor(req),
        req.params.id as string,
      );

      res.json({
        status: 'success',
        message: 'Mudança desfeita',
        data: { appointment: withStatusActions(withoutEmployee(appointment), 'EMPLOYEE') },
      });
    } catch (error) {
      next(error);
    }
  }
}
