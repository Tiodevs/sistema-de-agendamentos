export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRuleId = 'length' | 'uppercase' | 'special';

export const PASSWORD_RULES: Array<{
  id: PasswordRuleId;
  label: string;
  hint?: string;
  test: (password: string) => boolean;
}> = [
  {
    id: 'length',
    label: 'Pelo menos 8 caracteres',
    test: (password) =>
      password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
  },
  {
    id: 'uppercase',
    label: 'Uma letra maiúscula',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: 'special',
    label: 'Um caractere especial',
    hint: '! @ # $ %',
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

export function evaluatePasswordRules(password: string) {
  const rules = PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    hint: rule.hint,
    met: rule.test(password),
  }));
  const metCount = rules.filter((rule) => rule.met).length;

  return {
    rules,
    metCount,
    total: rules.length,
    valid: metCount === rules.length,
    tooLong: password.length > PASSWORD_MAX_LENGTH,
  };
}

export function passwordPolicyMessage(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return 'Senha deve ter no mínimo 8 caracteres';
  if (password.length > PASSWORD_MAX_LENGTH) return 'Senha deve ter no máximo 128 caracteres';
  if (!/[A-Z]/.test(password)) return 'Senha deve ter pelo menos uma letra maiúscula';
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Senha deve ter pelo menos um caractere especial';
  }
  return null;
}
