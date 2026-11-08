import { Request, Response, NextFunction } from 'express';
import { AppointmentService } from '../services/appointment.service';
import { withStatusActions } from '../services/appointment-status.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import {
  createAppointmentSchema,
  updateAppointmentStatusSchema,
  availabilitySlotsSchema,
  listAppointmentsQuerySchema,
  myAppointmentsQuerySchema,
} from '../schemas/appointment.schema';
import { httpError } from '../lib/http-error';

const appointmentService = new AppointmentService();

function adminActor(req: Request) {
  return { role: 'ADMIN' as const, userId: (req as AuthenticatedRequest).user.id };
}

/** Erros de validação (ZodError) e de regra seguem para o errorHandler. */
export class AppointmentController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = listAppointmentsQuerySchema.parse(req.query);
      const appointments = await appointmentService.findAll(filters);
      const now = new Date();

      res.status(200).json({
        status: 'success',
        data: {
          appointments: appointments.map((item) => withStatusActions(item, 'ADMIN', now)),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /** Listar apenas os agendamentos do usuário autenticado */
  async findMyAppointments(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const { status } = myAppointmentsQuerySchema.parse(req.query);
      const appointments = await appointmentService.findAll({
        clientId: authReq.user.id,
        status,
      });
      const now = new Date();

      res.status(200).json({
        status: 'success',
        data: {
          appointments: appointments.map((item) =>
            withStatusActions(stripEmployeeContact(item), 'CLIENT', now),
          ),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const appointment = await appointmentService.findById(req.params.id as string);

      if (!canReadAppointment(authReq, appointment)) {
        throw httpError('Você não tem permissão para ver este agendamento', 403);
      }

      res.status(200).json({
        status: 'success',
        data: {
          appointment:
            authReq.user.role === 'ADMIN'
              ? withStatusActions(appointment, 'ADMIN')
              : withStatusActions(stripEmployeeContact(appointment), 'CLIENT'),
        },
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
        data: { appointment: withStatusActions(appointment, 'ADMIN') },
      });
    } catch (error) {
      next(error);
    }
  }

  /** Usuário cria agendamento para si mesmo (clientId = req.user.id) */
  async createForUser(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      if (authReq.user.role !== 'USER') {
        throw httpError('Apenas clientes podem usar o fluxo de agendamento', 403);
      }

      const body = { ...req.body, clientId: authReq.user.id };
      const data = createAppointmentSchema.parse(body);
      const appointment = await appointmentService.create(data, { selfService: true });

      res.status(201).json({
        status: 'success',
        message: 'Agendamento criado com sucesso',
        data: { appointment: withStatusActions(stripEmployeeContact(appointment), 'CLIENT') },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = updateAppointmentStatusSchema.parse(req.body);
      const { appointment, undoUntil } = await appointmentService.updateStatus(
        req.params.id as string,
        status,
        adminActor(req),
      );

      res.status(200).json({
        status: 'success',
        message: 'Status atualizado com sucesso',
        data: { appointment: withStatusActions(appointment, 'ADMIN'), undoUntil },
      });
    } catch (error) {
      next(error);
    }
  }

  async undoStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const appointment = await appointmentService.undoStatus(
        req.params.id as string,
        adminActor(req),
      );

      res.status(200).json({
        status: 'success',
        message: 'Mudança desfeita',
        data: { appointment: withStatusActions(appointment, 'ADMIN') },
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await appointmentService.delete(req.params.id as string);
      res.status(200).json({ status: 'success' });
    } catch (error) {
      next(error);
    }
  }

  /** Usuário cancela apenas seu próprio agendamento */
  async cancelOwn(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const updated = await appointmentService.cancelOwn(req.params.id as string, authReq.user.id);

      res.status(200).json({
        status: 'success',
        message: 'Agendamento cancelado com sucesso',
        data: { appointment: withStatusActions(stripEmployeeContact(updated), 'CLIENT') },
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
      next(error);
    }
  }
}

function canReadAppointment(
  req: AuthenticatedRequest,
  appointment: {
    client: { id: string };
  },
) {
  if (req.user.role === 'ADMIN') return true;
  if (appointment.client.id === req.user.id) return true;
  return false;
}

function stripEmployeeContact<T extends { employee: { email?: string; phone?: string | null } }>(
  appointment: T,
) {
  const { email: _email, phone: _phone, ...employee } = appointment.employee;
  return { ...appointment, employee };
}
