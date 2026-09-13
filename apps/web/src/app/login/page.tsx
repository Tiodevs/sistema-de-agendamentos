'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { homePathForUser, useAuth } from '@/hooks/use-auth';
import { loginUser } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, LogIn } from 'lucide-react';
import { LogoWithText } from '@/components/logo';
import { AuthScreen } from '@/components/motion/auth-screen';

export default function LoginPage() {
  const router = useRouter();
  const { login, user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) return;
    router.replace(homePathForUser(user));
  }, [authLoading, isAuthenticated, user, router]);

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
        login(response.data.user, response.data.token);
        const role = response.data.user.role;
        if (role === 'ADMIN') {
          router.push('/admin');
        } else if (role === 'EMPLOYEE' || response.data.user.employeeId) {
          router.push('/professional');
        } else {
          router.push('/');
        }
      }
    } catch (err: unknown) {
      const apiError = err as {
        message?: string;
        errors?: Array<{ field: string; message: string }>;
      };
      if (apiError.errors) {
        const errors: Record<string, string> = {};
        apiError.errors.forEach((fieldError) => {
          errors[fieldError.field] = fieldError.message;
        });
        setFieldErrors(errors);
      } else {
        setError(apiError.message || 'Erro ao fazer login');
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
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            name="password"
            type="password"
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
          <Link href="/register" className="font-medium text-foreground hover:underline">
            Criar conta
          </Link>
        </p>
      </form>
    </AuthScreen>
  );
}
