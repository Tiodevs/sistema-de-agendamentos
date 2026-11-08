'use client';

import { AlertTriangle, Loader2, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PendingStatusChange } from '@/components/appointments/use-status-change';

const TIME_ZONE = 'America/Sao_Paulo';

function formatLongDay(iso: string) {
  const formatted = new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: TIME_ZONE,
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  });
}

/**
 * Confirmação de cancelar ou registrar falta (UX-06, DOM-03), com o resumo do horário para ninguém
 * cancelar o agendamento errado.
 */
export function StatusConfirmDialog({
  pending,
  loading,
  onConfirm,
  onDismiss,
  showEmployee = true,
}: {
  pending: PendingStatusChange | null;
  loading: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  /** Na agenda do próprio profissional, o nome dele não precisa aparecer. */
  showEmployee?: boolean;
}) {
  const appointment = pending?.appointment;
  const isCancel = pending?.status === 'CANCELLED';
  const Icon = isCancel ? AlertTriangle : UserX;

  const rows = appointment
    ? [
        { label: 'Cliente', value: appointment.client?.name },
        { label: 'Serviço', value: appointment.product?.name },
        ...(showEmployee ? [{ label: 'Profissional', value: appointment.employee?.name }] : []),
        { label: 'Data', value: formatLongDay(appointment.date) },
        {
          label: 'Horário',
          value: `${formatTime(appointment.date)} – ${formatTime(appointment.endDate)}`,
        },
      ].filter((row) => Boolean(row.value))
    : [];

  return (
    <Dialog open={!!pending} onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent className="rounded-3xl sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <Icon className="size-5 text-destructive" />
            </div>
            <div className="text-left">
              <DialogTitle>{isCancel ? 'Cancelar agendamento' : 'Registrar falta'}</DialogTitle>
              <DialogDescription>
                {isCancel
                  ? 'O cancelamento não pode ser desfeito.'
                  : 'Dá para desfazer por alguns minutos, se foi engano.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {rows.length > 0 ? (
          <dl className="divide-y divide-border rounded-[1.35rem] bg-[var(--admin-card-muted)] px-4">
            {rows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="text-right text-sm font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <p className="text-sm text-muted-foreground">
          {isCancel
            ? 'O cliente recebe um e-mail avisando do cancelamento e o horário fica livre para outra reserva.'
            : 'O horário fica registrado como falta do cliente e entra na taxa de faltas.'}
        </p>

        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={onDismiss} disabled={loading}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            className="rounded-full"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            {isCancel ? 'Cancelar agendamento' : 'Registrar falta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
