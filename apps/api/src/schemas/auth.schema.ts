import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string({ error: 'Nome é obrigatório' })
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .trim(),
  email: z
    .string({ error: 'E-mail é obrigatório' })
    .email({ error: 'E-mail inválido' })
    .toLowerCase()
    .trim(),
  password: z
    .string({ error: 'Senha é obrigatória' })
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .max(128, 'Senha deve ter no máximo 128 caracteres'),
  phone: z
    .string()
    .regex(/^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/, 'Telefone inválido')
    .optional()
    .or(z.literal('')),
});

export const loginSchema = z.object({
  email: z
    .string({ error: 'E-mail é obrigatório' })
    .email({ error: 'E-mail inválido' })
    .toLowerCase()
    .trim(),
  password: z
    .string({ error: 'Senha é obrigatória' })
    .min(1, 'Senha é obrigatória'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
