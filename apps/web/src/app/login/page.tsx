'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useRedirectAuthenticated } from '@/hooks/use-auth';
import { apiErrorMessage, apiFieldErrors, loginUser } from '@/lib/api';
import { safeNextPath, withNext } from '@/lib/safe-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, LogIn } from 'lucide-react';
import { LogoWithText } from '@/components/logo';
import { AuthScreen } from '@/components/motion/auth-screen';
import { PasswordInput } from '@/components/auth/password-input';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const resetDone = searchParams.get('reset') === '1';
  // UX-08: `?next=` só vale se for caminho deste site; quem entra segue para ele.
  const next = safeNextPath(searchParams.get('next'));

  // Quem já tem sessão, ou acabou de entrar, segue para o `next` ou para a home do papel.
  useRedirectAuthenticated(next);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const response = await loginUser({ email, password });

      if (response.data) {
        // O redirecionamento sai do `useRedirectAuthenticated`, assim que a sessão entra.
        login(response.data.user, response.data.token);
      }
    } catch (err: unknown) {
      const fields = apiFieldErrors(err);
      if (fields) {
        setFieldErrors(fields);
      } else {
        setError(apiErrorMessage(err, 'Não foi possível entrar. Tente de novo.'));
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthScreen>
      <div className="flex flex-col items-center text-center">
        <LogoWithText logoSize={40} textClassName="text-2xl font-semibold tracking-tight" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Entrar</h1>
        <p className="mt-1 text-sm text-muted-foreground">Acesse sua conta para continuar</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {resetDone ? (
          <div className="rounded-[1.35rem] bg-primary/10 p-3 text-sm text-foreground">
            Senha redefinida. Entre com a nova senha.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[1.35rem] bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

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
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password">Senha</Label>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              Esqueceu a senha?
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            placeholder="Sua senha"
            required
            disabled={isLoading}
            autoComplete="current-password"
          />
          {fieldErrors.password ? (
            <p className="text-sm text-destructive">{fieldErrors.password}</p>
          ) : null}
        </div>

        <Button type="submit" className="w-full rounded-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" />
              Entrando...
            </>
          ) : (
            <>
              <LogIn />
              Entrar
            </>
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Não tem uma conta?{' '}
          <Link
            href={withNext('/register', next)}
            className="font-medium text-foreground hover:underline"
          >
            Criar conta
          </Link>
        </p>
      </form>
    </AuthScreen>
  );
}
