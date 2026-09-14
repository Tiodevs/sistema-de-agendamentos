'use client';

import { useState } from 'react';
import Link from 'next/link';
import { requestPasswordReset } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail } from 'lucide-react';
import { LogoWithText } from '@/components/logo';
import { AuthScreen } from '@/components/motion/auth-screen';

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('email') ?? '');

    try {
      await requestPasswordReset(email);
      setSent(true);
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
        setError(apiError.message || 'Não foi possível enviar o e-mail');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthScreen>
      <div className="flex flex-col items-center text-center">
        <LogoWithText logoSize={40} textClassName="text-2xl font-semibold tracking-tight" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Recuperar senha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe o e-mail da conta. Se ele estiver cadastrado, você recebe um link para redefinir a
          senha.
        </p>
      </div>

      {sent ? (
        <div className="mt-8 space-y-4">
          <div className="rounded-[1.35rem] bg-primary/10 p-3 text-sm text-foreground">
            Se este e-mail estiver cadastrado, você receberá as instruções em instantes. O link
            expira em 30 minutos.
          </div>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-foreground hover:underline">
              Voltar ao login
            </Link>
          </p>
        </div>
      ) : (
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

          <Button type="submit" className="w-full rounded-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Mail />
                Enviar link
              </>
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Lembrou a senha?{' '}
            <Link href="/login" className="font-medium text-foreground hover:underline">
              Fazer login
            </Link>
          </p>
        </form>
      )}
    </AuthScreen>
  );
}
