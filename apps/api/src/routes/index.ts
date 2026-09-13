import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from './auth.routes';
import { productRouter } from './product.routes';
import { employeeRouter } from './employee.routes';
import { appointmentRouter } from './appointment.routes';
import { scheduleRouter } from './schedule.routes';
import { dashboardRouter } from './dashboard.routes';
import { professionalRouter } from './professional.routes';
import { usersRouter } from './users.routes';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/products', productRouter);
router.use('/employees', employeeRouter);
router.use('/appointments', appointmentRouter);
router.use('/schedule', scheduleRouter);
router.use('/dashboard', dashboardRouter);
router.use('/professional', professionalRouter);

export { router };
