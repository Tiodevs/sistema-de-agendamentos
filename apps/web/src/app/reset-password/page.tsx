'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { resetPassword } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound } from 'lucide-react';
import { LogoWithText } from '@/components/logo';
import { AuthScreen } from '@/components/motion/auth-screen';
import { PasswordInput } from '@/components/auth/password-input';

const TOKEN_STORAGE_KEY = 'leemia-password-reset-token';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { logout } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fromUrl = searchParams.get('token')?.trim();
    if (fromUrl) {
      try {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, fromUrl);
      } catch {
        // Private mode can block storage.
      }
      setToken(fromUrl);
      router.replace('/reset-password', { scroll: false });
      return;
    }

    setToken((current) => {
      if (current) return current;
      try {
        return sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? '';
      } catch {
        return '';
      }
    });
  }, [router, searchParams]);

  function clearStoredToken() {
    try {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;

    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const password = String(formData.get('password') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'As senhas não coincidem' });
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword({ token, password });
      clearStoredToken();
      logout();
      router.replace('/login?reset=1');
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
        setError(apiError.message || 'Não foi possível redefinir a senha');
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (token === null) {
    return (
      <AuthScreen>
        <div className="flex flex-col items-center text-center">
          <LogoWithText logoSize={40} textClassName="text-2xl font-semibold tracking-tight" />
          <p className="mt-6 text-sm text-muted-foreground">Carregando...</p>
        </div>
      </AuthScreen>
    );
  }

  if (!token) {
    return (
      <AuthScreen>
        <div className="flex flex-col items-center text-center">
          <LogoWithText logoSize={40} textClassName="text-2xl font-semibold tracking-tight" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Link inválido</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Este link de redefinição está incompleto ou já foi usado. Solicite um novo.
          </p>
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/forgot-password" className="font-medium text-foreground hover:underline">
            Pedir novo link
          </Link>
        </p>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <div className="flex flex-col items-center text-center">
        <LogoWithText logoSize={40} textClassName="text-2xl font-semibold tracking-tight" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Nova senha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha uma senha com no mínimo 8 caracteres. Depois você entra de novo na conta.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {error ? (
          <div className="rounded-[1.35rem] bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="password">Nova senha</Label>
          <PasswordInput
            id="password"
            name="password"
            placeholder="Mínimo 8 caracteres"
            required
            minLength={8}
            maxLength={128}
            disabled={isLoading}
            autoComplete="new-password"
          />
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
            minLength={8}
            maxLength={128}
            disabled={isLoading}
            autoComplete="new-password"
          />
          {fieldErrors.confirmPassword ? (
            <p className="text-sm text-destructive">{fieldErrors.confirmPassword}</p>
          ) : null}
        </div>

        <Button type="submit" className="w-full rounded-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <KeyRound />
              Redefinir senha
            </>
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Voltar ao login
          </Link>
        </p>
      </form>
    </AuthScreen>
  );
}
