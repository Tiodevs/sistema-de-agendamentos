import { z } from 'zod';
import { zonedDate } from '../lib/datetime';

export const APPOINTMENT_STATUSES = [
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

const statusSchema = z.enum(APPOINTMENT_STATUSES, { error: 'Status inválido' });

/** `YYYY-MM-DD` que existe no calendário: recusa 2026-13-45 e 29/02 fora de ano bissexto. */
const dateKeySchema = z.iso.date({ error: 'Data inválida. Use o formato YYYY-MM-DD.' });

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Limite de período nos filtros: um dia (`YYYY-MM-DD`, no fuso de São Paulo) ou um instante
 * ISO 8601 com fuso. Um dia em `from` vale desde 00:00; em `to`, até 23:59:59.999.
 */
function periodBoundary(edge: 'start' | 'end') {
  return z
    .union([z.iso.date(), z.iso.datetime({ offset: true })], { error: 'Data inválida' })
    .transform((value) => {
      const match = DATE_KEY.exec(value);
      if (!match) return new Date(value);
      const [year, month, day] = match.slice(1).map(Number);
      return edge === 'start'
        ? zonedDate(year, month, day, 0, 0, 0, 0)
        : zonedDate(year, month, day, 23, 59, 59, 999);
    });
}

const idFilterSchema = z.string().trim().min(1, 'Id inválido').max(64, 'Id inválido');

export const createAppointmentSchema = z.object({
  productId: z.string({ error: 'Produto é obrigatório' }),
  employeeId: z.string({ error: 'Funcionário é obrigatório' }),
  clientId: z.string({ error: 'Cliente é obrigatório' }),
  date: z.string({ error: 'Data é obrigatória' }).datetime({ error: 'Data inválida' }),
  notes: z
    .string()
    .max(500, 'Observações devem ter no máximo 500 caracteres')
    .trim()
    .optional()
    .or(z.literal('')),
});

export const updateAppointmentStatusSchema = z.object({
  status: statusSchema,
});

export const availabilitySlotsSchema = z.object({
  employeeId: z.string({ error: 'Funcionário é obrigatório' }),
  productId: z.string({ error: 'Produto é obrigatório' }),
  date: dateKeySchema,
});

/**
 * `GET /appointments` (admin). UX-09: a lista é paginada e, sem `from`/`to`/`clientId`, começa em
 * hoje (o serviço aplica o padrão), em vez de trazer a agenda inteira desde o primeiro dia.
 */
export const listAppointmentsQuerySchema = z.object({
  employeeId: idFilterSchema.optional(),
  clientId: idFilterSchema.optional(),
  status: statusSchema.optional(),
  from: periodBoundary('start').optional(),
  to: periodBoundary('end').optional(),
  /** Nome, e-mail ou telefone do cliente. */
  search: z.string().trim().max(120).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

/** `GET /appointments/my`. */
export const myAppointmentsQuerySchema = z.object({
  status: statusSchema.optional(),
});

/** `GET /professional/appointments`. */
export const professionalAppointmentsQuerySchema = z.object({
  status: statusSchema.optional(),
  from: periodBoundary('start').optional(),
  to: periodBoundary('end').optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusSchema>;
export type AvailabilitySlotsInput = z.infer<typeof availabilitySlotsSchema>;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export type AppointmentListFilters = z.infer<typeof listAppointmentsQuerySchema>;
export type ProfessionalAppointmentFilters = z.infer<typeof professionalAppointmentsQuerySchema>;
