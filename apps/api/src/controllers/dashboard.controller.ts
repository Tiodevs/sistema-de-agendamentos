import { Request, Response, NextFunction } from 'express';
import {
  DashboardService,
  DASHBOARD_PERIODS,
  type DashboardPeriod,
} from '../services/dashboard.service';

const dashboardService = new DashboardService();

function asOptionalId(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export class DashboardController {
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const rawPeriod = String(req.query.period || 'month');
      const period = (
        DASHBOARD_PERIODS.includes(rawPeriod as DashboardPeriod) ? rawPeriod : 'month'
      ) as DashboardPeriod;

      const stats = await dashboardService.getStats({
        period,
        employeeId: asOptionalId(req.query.employeeId),
        productId: asOptionalId(req.query.productId),
      });

      res.status(200).json({
        status: 'success',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}
