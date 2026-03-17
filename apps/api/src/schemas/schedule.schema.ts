import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const upsertBusinessHourSchema = z.object({
  dayOfWeek: z.number({ error: 'Dia da semana é obrigatório' }).int().min(0).max(6),
  openTime: z.string({ error: 'Horário de abertura é obrigatório' }).regex(timeRegex, 'Formato inválido (use HH:mm)'),
  closeTime: z.string({ error: 'Horário de fechamento é obrigatório' }).regex(timeRegex, 'Formato inválido (use HH:mm)'),
  isClosed: z.boolean().optional().default(false),
});

export const upsertAllBusinessHoursSchema = z.object({
  hours: z.array(upsertBusinessHourSchema).min(7).max(7),
});

export const createSpecialDaySchema = z.object({
  date: z.string({ error: 'Data é obrigatória' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  title: z.string({ error: 'Título é obrigatório' }).min(1, 'Título é obrigatório').max(100, 'Título deve ter no máximo 100 caracteres'),
  description: z.string().max(500, 'Descrição deve ter no máximo 500 caracteres').optional().or(z.literal('')),
  isClosed: z.boolean().optional().default(true),
  openTime: z.string().regex(timeRegex, 'Formato inválido (use HH:mm)').optional().or(z.literal('')).or(z.null()),
  closeTime: z.string().regex(timeRegex, 'Formato inválido (use HH:mm)').optional().or(z.literal('')).or(z.null()),
});

export const updateSpecialDaySchema = createSpecialDaySchema.partial();

export type UpsertBusinessHourInput = z.infer<typeof upsertBusinessHourSchema>;
export type UpsertAllBusinessHoursInput = z.infer<typeof upsertAllBusinessHoursSchema>;
export type CreateSpecialDayInput = z.infer<typeof createSpecialDaySchema>;
export type UpdateSpecialDayInput = z.infer<typeof updateSpecialDaySchema>;
