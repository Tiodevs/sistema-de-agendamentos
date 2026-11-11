import { z } from 'zod';

export const createEmployeeSchema = z.object({
  name: z
    .string({ error: 'Nome é obrigatório' })
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(150, 'Nome deve ter no máximo 150 caracteres')
    .trim(),
  email: z
    .string({ error: 'E-mail é obrigatório' })
    .email({ error: 'E-mail inválido' })
    .trim()
    .toLowerCase(),
  phone: z
    .string()
    .max(20, 'Telefone deve ter no máximo 20 caracteres')
    .trim()
    .optional()
    .or(z.literal('')),
  avatar: z.string().url('URL do avatar inválida').trim().optional().or(z.literal('')),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  /** UX-12: respiro, em minutos, entre dois atendimentos do profissional. */
  bufferMinutes: z
    .number({ error: 'Respiro inválido' })
    .int('Respiro inválido')
    .min(0, 'Respiro inválido')
    .max(120, 'O respiro pode ter no máximo 120 minutos')
    .optional(),
});

export const assignProductsSchema = z.object({
  productIds: z.array(z.string({ error: 'ID do produto inválido' })),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type AssignProductsInput = z.infer<typeof assignProductsSchema>;
