import { z } from 'zod';

export const passwordSchema = z
  .string({ error: 'Senha é obrigatória' })
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .max(128, 'Senha deve ter no máximo 128 caracteres');

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
  password: passwordSchema,
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
  password: z.string({ error: 'Senha é obrigatória' }).min(1, 'Senha é obrigatória'),
});

export const updateProfileSchema = z.object({
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
  phone: z
    .string()
    .regex(/^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/, 'Telefone inválido')
    .optional()
    .or(z.literal('')),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string({ error: 'E-mail é obrigatório' })
    .email({ error: 'E-mail inválido' })
    .toLowerCase()
    .trim(),
});

export const resetPasswordSchema = z.object({
  token: z
    .string({ error: 'Link inválido ou expirado' })
    .regex(/^[A-Za-z0-9_-]{32,128}$/, 'Link inválido ou expirado'),
  password: passwordSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: 'Senha atual é obrigatória' })
      .min(1, 'Senha atual é obrigatória')
      .max(128, 'Senha deve ter no máximo 128 caracteres'),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'A nova senha deve ser diferente da atual',
    path: ['newPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
