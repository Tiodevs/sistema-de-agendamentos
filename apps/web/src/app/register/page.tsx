'use client';

import { useState, useId } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useRedirectAuthenticated } from '@/hooks/use-auth';
import { apiErrorMessage, apiFieldErrors, registerUser } from '@/lib/api';
import { safeNextPath, withNext } from '@/lib/safe-next';
import { toast } from 'sonner';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordPolicyMessage,
} from '@/lib/password-policy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus } from 'lucide-react';
import { LogoWithText } from '@/components/logo';
import { AuthScreen } from '@/components/motion/auth-screen';
import { PasswordInput } from '@/components/auth/password-input';
import { PasswordMatchHint, PasswordRequirements } from '@/components/auth/password-requirements';

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const passwordHelpId = useId();
  // UX-08: quem veio de um serviço da landing volta para o agendamento depois do cadastro.
  const next = safeNextPath(searchParams.get('next'));

  // Quem já tem sessão, ou acabou de criar a conta, segue para o `next` ou para a home do papel.
  useRedirectAuthenticated(next);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    const phone = formData.get('phone') as string;

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'As senhas não coincidem' });
      setIsLoading(false);
      return;
    }

    const policyError = passwordPolicyMessage(password);
    if (policyError) {
      setFieldErrors({ password: policyError });
      setIsLoading(false);
      return;
    }

    try {
      const response = await registerUser({ name, email, password, phone: phone || undefined });

      if (response.data) {
        // O redirecionamento sai do `useRedirectAuthenticated`, assim que a sessão entra.
        login(response.data.user, response.data.token);
        toast.success('Conta criada. Enviamos um link para confirmar seu e-mail.');
      }
    } catch (err: unknown) {
      const fields = apiFieldErrors(err);
      if (fields) {
        setFieldErrors(fields);
      } else {
        setError(apiErrorMessage(err, 'Não foi possível criar a conta. Tente de novo.'));
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthScreen>
      <div className="flex flex-col items-center text-center">
        <LogoWithText logoSize={40} textClassName="text-2xl font-semibold tracking-tight" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Criar conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">Preencha os dados para se cadastrar</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {error ? (
          <div className="rounded-[1.35rem] bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="name">Nome completo</Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="Seu nome"
            required
            disabled={isLoading}
            autoComplete="name"
          />
          {fieldErrors.name ? <p className="text-sm text-destructive">{fieldErrors.name}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="seu@email.com"
            required
            disabled={isLoading}
            autoComplete="email"
          />
          {fieldErrors.email ? (
            <p className="text-sm text-destructive">{fieldErrors.email}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone (opcional)</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="(11) 99999-9999"
            disabled={isLoading}
            autoComplete="tel"
          />
          {fieldErrors.phone ? (
            <p className="text-sm text-destructive">{fieldErrors.phone}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <PasswordInput
            id="password"
            name="password"
            placeholder="Crie uma senha"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            disabled={isLoading}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby={passwordHelpId}
            aria-invalid={Boolean(fieldErrors.password)}
          />
          <PasswordRequirements id={passwordHelpId} password={password} />
          {fieldErrors.password ? (
            <p className="text-sm text-destructive">{fieldErrors.password}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar senha</Label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            placeholder="Repita a senha"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            disabled={isLoading}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
          />
          <PasswordMatchHint password={password} confirmPassword={confirmPassword} />
          {fieldErrors.confirmPassword ? (
            <p className="text-sm text-destructive">{fieldErrors.confirmPassword}</p>
          ) : null}
        </div>

        <Button type="submit" className="w-full rounded-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" />
              Criando conta...
            </>
          ) : (
            <>
              <UserPlus />
              Criar conta
            </>
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Já tem uma conta?{' '}
          <Link
            href={withNext('/login', next)}
            className="font-medium text-foreground hover:underline"
          >
            Fazer login
          </Link>
        </p>
      </form>
    </AuthScreen>
  );
}
