import { Request, Response, NextFunction } from 'express';
import { ProfessionalService } from '../services/professional.service';
import { ProfessionalRequest } from '../middlewares/professional.middleware';

const professionalService = new ProfessionalService();

export class ProfessionalController {
  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = (req as ProfessionalRequest).employeeId;
      const data = await professionalService.getDashboard(employeeId);

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
      const { from, to, status } = req.query;

      const appointments = await professionalService.getAppointments(employeeId, {
        from: from as string | undefined,
        to: to as string | undefined,
        status: status as string | undefined,
      });

      res.json({
        status: 'success',
        data: { appointments },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateAppointmentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = (req as ProfessionalRequest).employeeId;
      const { id } = req.params;
      const { status } = req.body;

      const appointment = await professionalService.updateAppointmentStatus(
        employeeId,
        id as string,
        status,
      );

      res.json({
        status: 'success',
        message: 'Status atualizado com sucesso',
        data: { appointment },
      });
    } catch (error) {
      next(error);
    }
  }
}
