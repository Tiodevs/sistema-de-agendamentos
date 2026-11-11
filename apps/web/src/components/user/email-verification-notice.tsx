'use client';

import { useState } from 'react';
import { Loader2, MailWarning, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { apiErrorMessage, resendEmailVerification } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Aviso para o cliente que ainda não confirmou o e-mail: sem isso, a API recusa a reserva. */
export function EmailVerificationNotice({ className }: { className?: string }) {
  const { user, refreshUser } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || user.role !== 'USER' || user.emailVerified !== false) return null;

  async function handleResend() {
    setSending(true);
    try {
      const response = await resendEmailVerification();
      if (response.data?.alreadyVerified) {
        await refreshUser();
        toast.success('Seu e-mail já está confirmado.');
        return;
      }
      setSent(true);
      toast.success(response.message || 'Enviamos um novo link de confirmação.');
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Não foi possível reenviar o link.'));
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      role="status"
      data-testid="email-verification-notice"
      className={cn(
        'admin-surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5',
        className,
      )}
    >
      <MailWarning className="size-5 shrink-0 text-brand-ink" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Confirme seu e-mail para agendar</p>
        <p className="text-sm text-muted-foreground">
          Enviamos um link para <span className="font-medium text-foreground">{user.email}</span>.
          Abra o e-mail e toque em “Confirmar e-mail”.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="rounded-full"
        disabled={sending || sent}
        onClick={() => void handleResend()}
      >
        {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {sent ? 'Link enviado' : 'Reenviar link'}
      </Button>
    </section>
  );
}
