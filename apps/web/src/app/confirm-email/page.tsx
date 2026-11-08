'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { confirmEmailChange } from '@/lib/api';
import { readAuthLinkToken, stripAuthLinkTokenFromUrl } from '@/lib/auth-link-token';
import { Button } from '@/components/ui/button';
import { Loader2, MailCheck } from 'lucide-react';
import { LogoWithText } from '@/components/logo';
import { AuthScreen } from '@/components/motion/auth-screen';

export default function ConfirmEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, refreshUser } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  /** `true` quando o link era de troca de e-mail; `false` quando confirmou o e-mail do cadastro. */
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = readAuthLinkToken(searchParams.get('token'));
    const hadTokenInUrl =
      Boolean(searchParams.get('token')) || window.location.hash.includes('token=');

    setToken((current) => current || fromUrl);

    if (hadTokenInUrl) {
      stripAuthLinkTokenFromUrl('/confirm-email');
      router.replace('/confirm-email', { scroll: false });
    }
  }, [router, searchParams]);

  async function handleConfirm() {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await confirmEmailChange(token);
      setChanged(Boolean(response.data?.changed));
      if (isAuthenticated) {
        try {
          await refreshUser();
        } catch {
          // Profile refresh is optional after a successful confirm.
        }
      }
      setDone(true);
    } catch (err: unknown) {
      const apiError = err as { message?: string };
      setError(apiError.message || 'Não foi possível confirmar o e-mail.');
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
            Este link de confirmação está incompleto ou já foi usado. Peça um novo: na tela de
            agendamento, para confirmar o cadastro, ou no perfil, para trocar de e-mail.
          </p>
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/profile" className="font-medium text-foreground hover:underline">
            Ir ao perfil
          </Link>
        </p>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <div className="flex flex-col items-center text-center">
        <LogoWithText logoSize={40} textClassName="text-2xl font-semibold tracking-tight" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          {done ? 'E-mail confirmado' : 'Confirmar e-mail'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {done
            ? changed
              ? 'O novo endereço já vale para entrar na conta.'
              : 'Pronto. Você já pode agendar seus horários.'
            : 'Confirme que este endereço de e-mail é seu.'}
        </p>
      </div>

      {error ? (
        <div className="mt-6 rounded-[1.35rem] bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="mt-8 space-y-3">
        {done ? (
          <Button asChild className="w-full rounded-full">
            {!isAuthenticated ? (
              <Link href="/login">Entrar</Link>
            ) : changed ? (
              <Link href="/profile">Ir ao perfil</Link>
            ) : (
              <Link href="/book">Agendar agora</Link>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            className="w-full rounded-full"
            disabled={isLoading}
            onClick={() => void handleConfirm()}
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                <MailCheck />
                Confirmar e-mail
              </>
            )}
          </Button>
        )}
      </div>
    </AuthScreen>
  );
}
