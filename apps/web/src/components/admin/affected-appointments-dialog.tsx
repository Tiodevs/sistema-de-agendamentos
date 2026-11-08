'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, CalendarX2, Loader2 } from 'lucide-react';
import {
  affectedAppointmentsFrom,
  apiErrorMessage,
  type AffectedAppointment,
  type AffectedDecision,
} from '@/lib/api';
import { affectedTitle, countAppointments, formatAffectedWhen } from '@/lib/affected-appointments';
import { formatShortName } from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface AffectedPrompt {
  /** O que o admin estava fazendo, ex.: "Fechar o dia 24/12". */
  action: string;
  appointments: AffectedAppointment[];
  /** Repete a mudança com a decisão. Lança erro se não salvou. */
  retry: (decision: AffectedDecision) => Promise<void>;
}

/**
 * DOM-02: a mudança deixaria agendamentos marcados sem atendimento. Nada foi salvo ainda: o admin
 * escolhe manter, cancelar avisando os clientes ou voltar.
 */
export function AffectedAppointmentsDialog({
  prompt,
  onClose,
}: {
  prompt: AffectedPrompt | null;
  onClose: () => void;
}) {
  const [pending, setPending] = useState<AffectedDecision | null>(null);
  const count = prompt?.appointments.length ?? 0;

  async function choose(decision: AffectedDecision) {
    if (!prompt) return;
    setPending(decision);
    try {
      await prompt.retry(decision);
      onClose();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Não foi possível salvar. Tente de novo.'));
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog
      open={Boolean(prompt)}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-amber-500/10">
            <CalendarClock className="size-6 text-amber-400" aria-hidden />
          </div>
          <DialogTitle className="text-center">{affectedTitle(count)}</DialogTitle>
          <DialogDescription className="text-center">
            {prompt?.action ?? 'Esta mudança'} deixa {countAppointments(count)} marcado
            {count === 1 ? '' : 's'} sem atendimento. Nada foi salvo ainda: escolha o que fazer com{' '}
            {count === 1 ? 'ele' : 'eles'}.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-64 space-y-2 overflow-y-auto pr-1" aria-label="Agendamentos afetados">
          {prompt?.appointments.map((appointment) => (
            <li
              key={appointment.id}
              className="flex min-w-0 items-start gap-3 rounded-2xl bg-[var(--admin-card-muted)] px-3 py-2.5"
            >
              <span className="shrink-0 rounded-xl bg-[var(--admin-chip)] px-2 py-1 text-xs font-semibold tabular-nums">
                {formatAffectedWhen(appointment.date)}
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="block truncate font-medium" title={appointment.client.name}>
                  {formatShortName(appointment.client.name)}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {appointment.product.name} · {formatShortName(appointment.employee.name)}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">
          Manter deixa os horários na agenda para você resolver um a um. Cancelar libera os horários
          e manda um e-mail a cada cliente com o motivo.
        </p>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="destructive"
            className="w-full rounded-full"
            disabled={Boolean(pending)}
            onClick={() => choose('cancel')}
          >
            {pending === 'cancel' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CalendarX2 className="size-4" />
            )}
            Cancelar e avisar {count === 1 ? 'o cliente' : 'os clientes'}
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-full"
            disabled={Boolean(pending)}
            onClick={() => choose('keep')}
          >
            {pending === 'keep' ? <Loader2 className="size-4 animate-spin" /> : null}
            Manter {count === 1 ? 'o agendamento' : 'os agendamentos'}
          </Button>
          <Button
            variant="ghost"
            className="w-full rounded-full"
            disabled={Boolean(pending)}
            onClick={onClose}
          >
            Voltar sem salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Roda a mudança sem decisão. Se a API responder 409 AFFECTED_APPOINTMENTS, abre o diálogo e
 * devolve `false` (nada salvo); a escolha do admin chama a mesma mudança de novo com a decisão.
 * Outros erros sobem para quem chamou.
 */
export function useAffectedAppointments() {
  const [prompt, setPrompt] = useState<AffectedPrompt | null>(null);

  const run = useCallback(
    async (action: string, save: (decision?: AffectedDecision) => Promise<void>) => {
      try {
        await save(undefined);
        return true;
      } catch (error) {
        const appointments = affectedAppointmentsFrom(error);
        if (!appointments) throw error;
        setPrompt({ action, appointments, retry: (decision) => save(decision) });
        return false;
      }
    },
    [],
  );

  const close = useCallback(() => setPrompt(null), []);

  return { run, dialogProps: { prompt, onClose: close } };
}
