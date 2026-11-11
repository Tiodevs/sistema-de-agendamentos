import { z } from 'zod';

export const passwordSchema = z
  .string({ error: 'Senha é obrigatória' })
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .max(128, 'Senha deve ter no máximo 128 caracteres')
  .regex(/[A-Z]/, 'Senha deve ter pelo menos uma letra maiúscula')
  .regex(/[^A-Za-z0-9]/, 'Senha deve ter pelo menos um caractere especial');

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

const secretTokenSchema = z
  .string({ error: 'Link inválido ou expirado' })
  .regex(/^[A-Za-z0-9_-]{32,128}$/, 'Link inválido ou expirado');

export const resetPasswordSchema = z.object({
  token: secretTokenSchema,
  password: passwordSchema,
});

export const confirmEmailSchema = z.object({
  token: secretTokenSchema,
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

/** SEC-03: convite do profissional. */
export const invitePreviewSchema = z.object({
  token: secretTokenSchema,
});

/**
 * Com sessão do mesmo e-mail, só o token. Sem sessão: a senha da conta que já existe (prova que
 * a conta é sua) ou a senha nova (cria a conta com o e-mail do convite, que o link já confirmou).
 */
export const acceptInviteSchema = z.object({
  token: secretTokenSchema,
  password: z.string().max(128, 'Senha deve ter no máximo 128 caracteres').optional(),
});

const phoneSchema = z.string().regex(/^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/, 'Telefone inválido');

/**
 * UX-03: "cliente rápido" que a recepção cadastra ao telefone. Só o nome é obrigatório, mas é
 * preciso pelo menos um contato (telefone ou e-mail) para o cliente ser encontrado depois.
 */
export const createClientSchema = z
  .object({
    name: z
      .string({ error: 'Nome é obrigatório' })
      .trim()
      .min(2, 'Nome deve ter no mínimo 2 caracteres')
      .max(100, 'Nome deve ter no máximo 100 caracteres'),
    phone: phoneSchema.optional().or(z.literal('')),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email({ error: 'E-mail inválido' }))
      .optional()
      .or(z.literal('')),
  })
  .refine((data) => Boolean(data.phone || data.email), {
    message: 'Informe um telefone ou um e-mail',
    path: ['phone'],
  });

export const listClientsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
  active: z.enum(['true', 'false']).optional(),
  role: z.enum(['USER', 'ADMIN', 'EMPLOYEE']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ConfirmEmailInput = z.infer<typeof confirmEmailSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
