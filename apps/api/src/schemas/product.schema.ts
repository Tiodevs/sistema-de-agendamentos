import { z } from 'zod';

export const createProductSchema = z.object({
  name: z
    .string({ error: 'Nome é obrigatório' })
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(150, 'Nome deve ter no máximo 150 caracteres')
    .trim(),
  description: z
    .string()
    .max(500, 'Descrição deve ter no máximo 500 caracteres')
    .trim()
    .optional()
    .or(z.literal('')),
  price: z
    .number({ error: 'Preço é obrigatório' })
    .positive('Preço deve ser maior que zero')
    .multipleOf(0.01, 'Preço deve ter no máximo 2 casas decimais'),
  duration: z
    .number({ error: 'Duração é obrigatória' })
    .int('Duração deve ser um número inteiro')
    .min(5, 'Duração mínima é 5 minutos')
    .max(480, 'Duração máxima é 480 minutos (8 horas)'),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
