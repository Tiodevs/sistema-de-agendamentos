import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** UX-12: pausas do dia (almoço, intervalo). Até 4, cada uma com início antes do fim. */
const breaksSchema = z
  .array(
    z
      .object({
        start: z.string().regex(timeRegex, 'Formato inválido (use HH:mm)'),
        end: z.string().regex(timeRegex, 'Formato inválido (use HH:mm)'),
      })
      .refine((range) => range.start < range.end, {
        message: 'O início da pausa deve ser anterior ao fim',
      }),
  )
  .max(4, 'No máximo 4 pausas por dia');

export const upsertBusinessHourSchema = z.object({
  dayOfWeek: z.number({ error: 'Dia da semana é obrigatório' }).int().min(0).max(6),
  openTime: z
    .string({ error: 'Horário de abertura é obrigatório' })
    .regex(timeRegex, 'Formato inválido (use HH:mm)'),
  closeTime: z
    .string({ error: 'Horário de fechamento é obrigatório' })
    .regex(timeRegex, 'Formato inválido (use HH:mm)'),
  isClosed: z.boolean().optional().default(false),
  /** Ausente = mantém as pausas que já estavam gravadas no dia. */
  breaks: breaksSchema.optional(),
});

export const upsertAllBusinessHoursSchema = z.object({
  hours: z
    .array(upsertBusinessHourSchema)
    .min(7)
    .max(7)
    .refine((hours) => new Set(hours.map((hour) => hour.dayOfWeek)).size === 7, {
      message: 'Informe os 7 dias da semana sem repetir',
    }),
});

export const createSpecialDaySchema = z.object({
  date: z
    .string({ error: 'Data é obrigatória' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  title: z
    .string({ error: 'Título é obrigatório' })
    .min(1, 'Título é obrigatório')
    .max(100, 'Título deve ter no máximo 100 caracteres'),
  description: z
    .string()
    .max(500, 'Descrição deve ter no máximo 500 caracteres')
    .optional()
    .or(z.literal('')),
  isClosed: z.boolean().optional().default(true),
  openTime: z
    .string()
    .regex(timeRegex, 'Formato inválido (use HH:mm)')
    .optional()
    .or(z.literal(''))
    .or(z.null()),
  closeTime: z
    .string()
    .regex(timeRegex, 'Formato inválido (use HH:mm)')
    .optional()
    .or(z.literal(''))
    .or(z.null()),
});

export const updateSpecialDaySchema = createSpecialDaySchema.partial();

export const upsertAllEmployeeHoursSchema = upsertAllBusinessHoursSchema;

/**
 * DOM-02: o que fazer com os agendamentos marcados que ficariam fora do expediente. Sem o
 * parâmetro, a API responde 409 `AFFECTED_APPOINTMENTS` com a lista para a tela perguntar.
 */
export const affectedDecisionQuerySchema = z.object({
  onAffected: z
    .enum(['keep', 'cancel'], { error: 'Use onAffected=keep ou onAffected=cancel' })
    .optional(),
});

export const createEmployeeSpecialDaySchema = createSpecialDaySchema;
export const updateEmployeeSpecialDaySchema = updateSpecialDaySchema;

export type UpsertBusinessHourInput = z.infer<typeof upsertBusinessHourSchema>;
export type UpsertAllBusinessHoursInput = z.infer<typeof upsertAllBusinessHoursSchema>;
export type CreateSpecialDayInput = z.infer<typeof createSpecialDaySchema>;
export type UpdateSpecialDayInput = z.infer<typeof updateSpecialDaySchema>;
export type UpsertAllEmployeeHoursInput = z.infer<typeof upsertAllEmployeeHoursSchema>;
export type CreateEmployeeSpecialDayInput = z.infer<typeof createEmployeeSpecialDaySchema>;
export type UpdateEmployeeSpecialDayInput = z.infer<typeof updateEmployeeSpecialDaySchema>;
