import { z } from 'zod';

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
  status: z.enum(
    ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
    { error: 'Status inválido' },
  ),
});

export const availabilitySlotsSchema = z.object({
  employeeId: z.string({ error: 'Funcionário é obrigatório' }),
  productId: z.string({ error: 'Produto é obrigatório' }),
  date: z.string({ error: 'Data é obrigatória' }).regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Data deve estar no formato YYYY-MM-DD',
  ),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusSchema>;
export type AvailabilitySlotsInput = z.infer<typeof availabilitySlotsSchema>;
