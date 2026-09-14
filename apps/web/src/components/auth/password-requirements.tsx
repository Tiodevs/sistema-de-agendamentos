'use client';

import { Check, X } from 'lucide-react';
import { evaluatePasswordRules, PASSWORD_MIN_LENGTH } from '@/lib/password-policy';
import { cn } from '@/lib/utils';

type PasswordRequirementsProps = {
  password: string;
  id?: string;
  className?: string;
};

function strengthLabel(hasValue: boolean, metCount: number) {
  if (!hasValue) return 'Comece a digitar';
  if (metCount <= 1) return 'Fraca';
  if (metCount === 2) return 'Quase lá';
  return 'Pronto';
}

export function PasswordRequirements({ password, id, className }: PasswordRequirementsProps) {
  const { rules, metCount, valid } = evaluatePasswordRules(password);
  const hasValue = password.length > 0;
  const label = strengthLabel(hasValue, metCount);

  return (
    <div
      id={id}
      className={cn(
        'rounded-[1.15rem] bg-[var(--admin-card-muted)] p-3.5 transition-[box-shadow,background-color] duration-300',
        valid && 'ring-1 ring-[var(--admin-accent)]/30',
        className,
      )}
    >
      <p className="sr-only">
        A senha precisa ter no mínimo {PASSWORD_MIN_LENGTH} caracteres, uma letra maiúscula e um
        caractere especial.
      </p>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Força da senha
        </p>
        <p
          data-testid="password-strength"
          className={cn(
            'text-xs font-medium tabular-nums transition-colors duration-300',
            !hasValue && 'text-muted-foreground',
            hasValue && metCount <= 1 && 'text-amber-500',
            metCount === 2 && 'text-[var(--admin-accent)]',
            valid && 'text-[var(--admin-accent)]',
          )}
        >
          {label}
        </p>
      </div>

      <div className="mt-2 flex gap-1" aria-hidden="true">
        {rules.map((rule, index) => (
          <span
            key={rule.id}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-300',
              index < metCount ? 'bg-[var(--admin-accent)]' : 'bg-[var(--admin-track)]',
            )}
          />
        ))}
      </div>

      <ul className="mt-3 space-y-1.5" aria-label="Requisitos da senha">
        {rules.map((rule) => (
          <li
            key={rule.id}
            data-testid={`password-rule-${rule.id}`}
            data-met={rule.met}
            className="flex items-center gap-2.5"
          >
            <span
              className={cn(
                'password-rule-check flex size-4 shrink-0 items-center justify-center rounded-full transition-colors duration-200',
                rule.met
                  ? 'bg-[var(--admin-accent)] text-[var(--admin-accent-foreground)]'
                  : 'bg-transparent text-muted-foreground/50 ring-1 ring-inset ring-muted-foreground/25',
              )}
              data-met={rule.met}
              aria-hidden="true"
            >
              {rule.met ? (
                <Check className="size-2.5 stroke-[3]" />
              ) : (
                <span className="size-1 rounded-full bg-current" />
              )}
            </span>
            <span
              className={cn(
                'min-w-0 flex-1 text-[13px] leading-5 transition-colors duration-200',
                rule.met ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {rule.label}
              {rule.hint ? (
                <span className="ml-1.5 font-normal text-muted-foreground/80">{rule.hint}</span>
              ) : null}
            </span>
            {rule.id === 'length' && hasValue && !rule.met ? (
              <span className="tabular-nums text-[11px] text-muted-foreground">
                {Math.min(password.length, PASSWORD_MIN_LENGTH)}/{PASSWORD_MIN_LENGTH}
              </span>
            ) : null}
            <span className="sr-only">{rule.met ? 'atendido' : 'pendente'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PasswordMatchHint({
  password,
  confirmPassword,
  className,
}: {
  password: string;
  confirmPassword: string;
  className?: string;
}) {
  if (!password && !confirmPassword) return null;

  const match = password.length > 0 && password === confirmPassword;
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <p
      data-testid="password-match"
      data-met={match}
      className={cn(
        'flex items-center gap-2 text-[13px] leading-5 transition-colors duration-200',
        match && 'text-foreground',
        mismatch && 'text-destructive',
        !match && !mismatch && 'text-muted-foreground',
        className,
      )}
    >
      <span
        className={cn(
          'password-rule-check flex size-4 shrink-0 items-center justify-center rounded-full transition-colors duration-200',
          match && 'bg-[var(--admin-accent)] text-[var(--admin-accent-foreground)]',
          mismatch && 'bg-destructive/15 text-destructive',
          !match && !mismatch && 'ring-1 ring-inset ring-muted-foreground/25',
        )}
        data-met={match}
        aria-hidden="true"
      >
        {match ? (
          <Check className="size-2.5 stroke-[3]" />
        ) : mismatch ? (
          <X className="size-2.5 stroke-[3]" />
        ) : null}
      </span>
      {match ? 'Senhas iguais' : mismatch ? 'Ainda não coincidem' : 'Repita a senha para confirmar'}
    </p>
  );
}
