'use client';

import { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { KeyRound, Loader2, LogOut, MailWarning, UserCheck } from 'lucide-react';
import { homePathForUser, useAuth } from '@/hooks/use-auth';
import {
  ApiError,
  acceptEmployeeInvite,
  apiErrorMessage,
  previewEmployeeInvite,
  type EmployeeInvitePreview,
} from '@/lib/api';
import { readAuthLinkToken, stripAuthLinkTokenFromUrl } from '@/lib/auth-link-token';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordPolicyMessage,
} from '@/lib/password-policy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogoWithText } from '@/components/logo';
import { AuthScreen } from '@/components/motion/auth-screen';
import { PasswordInput } from '@/components/auth/password-input';
import { PasswordMatchHint, PasswordRequirements } from '@/components/auth/password-requirements';

type PreviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; invite: EmployeeInvitePreview };

/** Códigos em que o convite deixou de valer: a tela toda vira a mensagem de erro. */
const DEAD_INVITE_CODES = new Set(['INVITE_INVALID', 'ALREADY_LINKED', 'EMPLOYEE_INACTIVE']);

function formatDayMonth(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso));
}

/**
 * SEC-03: o profissional liga a própria conta ao cadastro feito pelo estúdio. O link prova que a
 * pessoa recebe o e-mail; a sessão ou a senha provam que a conta é dela.
 */
export default function AcceptInvitePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, login, logout } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ status: 'loading' });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const passwordHelpId = useId();

  // O token vem no #hash (não vai para logs de servidor) e sai da barra de endereço logo depois.
  useEffect(() => {
    const searchToken = new URLSearchParams(window.location.search).get('token');
    const fromUrl = readAuthLinkToken(searchToken);
    const hadTokenInUrl = Boolean(searchToken) || window.location.hash.includes('token=');

    setToken((current) => current || fromUrl);

    if (hadTokenInUrl) {
      stripAuthLinkTokenFromUrl('/accept-invite');
      router.replace('/accept-invite', { scroll: false });
    }
  }, [router]);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    setPreview({ status: 'loading' });
    previewEmployeeInvite(token)
      .then((response) => {
        if (cancelled) return;
        setPreview(
          response.data?.invite
            ? { status: 'ready', invite: response.data.invite }
            : { status: 'error', message: 'Não foi possível abrir o convite.' },
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPreview({
          status: 'error',
          message: apiErrorMessage(err, 'Não foi possível abrir o convite. Tente de novo.'),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const invite = preview.status === 'ready' ? preview.invite : null;
  const sameAccount = Boolean(
    invite && isAuthenticated && user && user.email.trim().toLowerCase() === invite.email,
  );
  const otherAccount = Boolean(invite && isAuthenticated && user && !sameAccount);

  async function accept(passwordValue?: string) {
    if (!token) return;
    setError(null);
    setFieldError(null);
    setSubmitting(true);
    try {
      const response = await acceptEmployeeInvite({
        token,
        ...(passwordValue !== undefined && { password: passwordValue }),
      });
      if (!response.data) throw new Error('Resposta inválida');
      login(response.data.user, response.data.token);
      toast.success('Convite aceito. Sua agenda já está disponível.');
      router.replace(homePathForUser(response.data.user));
    } catch (err: unknown) {
      if (!(err instanceof ApiError)) {
        setError('Não foi possível aceitar o convite. Tente de novo.');
        return;
      }
      if (err.code && DEAD_INVITE_CODES.has(err.code)) {
        setPreview({ status: 'error', message: err.message });
        return;
      }
      if (err.code === 'WEAK_PASSWORD') {
        setFieldError(err.message);
        return;
      }
      if (err.statusCode === 401 && passwordValue === undefined) {
        // A sessão salva expirou: segue sem ela, pedindo a senha.
        await logout({ notifyServer: false });
        setError('Sua sessão expirou. Entre com a senha da conta para aceitar.');
        return;
      }
      if (err.statusCode === 401) {
        setFieldError('Senha incorreta. Tente de novo ou redefina a senha.');
        return;
      }
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleExistingAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) {
      setFieldError('Informe a senha da sua conta.');
      return;
    }
    void accept(password);
  }

  function handleNewAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfirmError(null);
    const policyError = passwordPolicyMessage(password);
    if (policyError) {
      setFieldError(policyError);
      return;
    }
    if (password !== confirmPassword) {
      setConfirmError('As senhas não coincidem');
      return;
    }
    void accept(password);
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
      setPassword('');
      setConfirmPassword('');
      setError(null);
      setFieldError(null);
    } finally {
      setSigningOut(false);
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

  if (!token || preview.status === 'error') {
    return (
      <AuthScreen>
        <div className="flex flex-col items-center text-center">
          <LogoWithText logoSize={40} textClassName="text-2xl font-semibold tracking-tight" />
          <div className="mt-6 flex size-12 items-center justify-center rounded-full bg-amber-500/10">
            <MailWarning className="size-6 text-amber-500" aria-hidden />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Convite indisponível</h1>
          <p className="mt-1 text-sm text-muted-foreground" role="alert">
            {preview.status === 'error'
              ? preview.message
              : 'Este link de convite está incompleto. Abra de novo o link do e-mail ou peça um novo convite ao estúdio.'}
          </p>
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Ir para o login
          </Link>
        </p>
      </AuthScreen>
    );
  }

  if (!invite || authLoading) {
    return (
      <AuthScreen>
        <div className="flex flex-col items-center text-center">
          <LogoWithText logoSize={40} textClassName="text-2xl font-semibold tracking-tight" />
          <Loader2 className="mt-6 size-5 animate-spin text-muted-foreground" aria-hidden />
          <p className="mt-2 text-sm text-muted-foreground">Abrindo o convite...</p>
        </div>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <div className="flex flex-col items-center text-center">
        <LogoWithText logoSize={40} textClassName="text-2xl font-semibold tracking-tight" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Convite para a agenda</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Olá, {invite.employeeName}. O estúdio convidou{' '}
          <strong className="font-medium text-foreground">{invite.email}</strong> para o painel do
          profissional. O convite vale até {formatDayMonth(invite.expiresAt)}.
        </p>
      </div>

      <div className="mt-6 rounded-[1.15rem] bg-[var(--admin-card-muted)] p-3.5 text-[13px] leading-5 text-muted-foreground">
        Ao aceitar, esta conta passa a abrir o painel do profissional: sua agenda e o status dos
        atendimentos. Se você também agenda como cliente com esta conta, a área de cliente deixa de
        aparecer nela.
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-[1.35rem] bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {sameAccount ? (
        <div className="mt-6 space-y-3">
          <Button
            className="w-full rounded-full"
            onClick={() => void accept()}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="animate-spin" /> : <UserCheck />}
            Aceitar convite
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Você está conectado como {user?.email}.
          </p>
        </div>
      ) : otherAccount ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            Você está conectado como{' '}
            <strong className="font-medium text-foreground">{user?.email}</strong>, mas o convite é
            para <strong className="font-medium text-foreground">{invite.email}</strong>. Saia desta
            conta para continuar com o e-mail do convite.
          </p>
          <Button
            className="w-full rounded-full"
            variant="outline"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
          >
            {signingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
            Sair e continuar
          </Button>
        </div>
      ) : invite.accountExists ? (
        <form onSubmit={handleExistingAccount} className="mt-6 space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="invite-email">E-mail</Label>
            <Input
              id="invite-email"
              name="username"
              type="email"
              autoComplete="username"
              value={invite.email}
              readOnly
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-password">Senha da sua conta</Label>
            <PasswordInput
              id="invite-password"
              name="password"
              placeholder="Sua senha"
              autoComplete="current-password"
              maxLength={PASSWORD_MAX_LENGTH}
              disabled={submitting}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(fieldError)}
            />
            {fieldError ? (
              <p className="text-sm text-destructive" role="alert">
                {fieldError}
              </p>
            ) : null}
          </div>
          <Button type="submit" className="w-full rounded-full" disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : <KeyRound />}
            Entrar e aceitar
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Esqueceu a senha?{' '}
            <Link href="/forgot-password" className="font-medium text-foreground hover:underline">
              Redefina
            </Link>{' '}
            e depois abra de novo o link do convite no seu e-mail.
          </p>
        </form>
      ) : (
        <form onSubmit={handleNewAccount} className="mt-6 space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="invite-email">E-mail</Label>
            <Input
              id="invite-email"
              name="username"
              type="email"
              autoComplete="username"
              value={invite.email}
              readOnly
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-new-password">Crie uma senha</Label>
            <PasswordInput
              id="invite-new-password"
              name="password"
              placeholder="Nova senha"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              disabled={submitting}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby={passwordHelpId}
              aria-invalid={Boolean(fieldError)}
            />
            <PasswordRequirements id={passwordHelpId} password={password} />
            {fieldError ? (
              <p className="text-sm text-destructive" role="alert">
                {fieldError}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-confirm-password">Confirmar senha</Label>
            <PasswordInput
              id="invite-confirm-password"
              name="confirmPassword"
              placeholder="Repita a senha"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              disabled={submitting}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              aria-invalid={Boolean(confirmError)}
            />
            <PasswordMatchHint password={password} confirmPassword={confirmPassword} />
            {confirmError ? (
              <p className="text-sm text-destructive" role="alert">
                {confirmError}
              </p>
            ) : null}
          </div>
          <Button type="submit" className="w-full rounded-full" disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : <UserCheck />}
            Criar conta e aceitar
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            O e-mail já fica confirmado: o link chegou nele.
          </p>
        </form>
      )}
    </AuthScreen>
  );
}
