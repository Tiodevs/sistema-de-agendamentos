import { Request, Response } from 'express';
import { DashboardService, parseDashboardPeriod } from '../services/dashboard.service';

const dashboardService = new DashboardService();

function asOptionalId(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export class DashboardController {
  async getStats(req: Request, res: Response) {
    const period = parseDashboardPeriod(req.query.period);

    const stats = await dashboardService.getStats({
      period,
      employeeId: asOptionalId(req.query.employeeId),
      productId: asOptionalId(req.query.productId),
    });

    res.status(200).json({
      status: 'success',
      data: stats,
    });
  }
}
