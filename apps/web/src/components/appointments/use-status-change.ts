'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  apiErrorMessage,
  type ApiResponse,
  type Appointment,
  type AppointmentStatus,
  type StatusChangeResult,
} from '@/lib/api';
import { STATUS_CONFIG } from '@/lib/appointment-status';
import { isUndoAvailable, needsConfirmation, undoToastDuration } from '@/lib/status-actions';

export interface PendingStatusChange {
  appointment: Appointment;
  status: AppointmentStatus;
}

interface StatusChangeOptions {
  change: (id: string, status: AppointmentStatus) => Promise<ApiResponse<StatusChangeResult>>;
  undo: (id: string) => Promise<ApiResponse<{ appointment: Appointment }>>;
  /** Recarrega a lista depois de mudar, desfazer ou falhar (a tela pode estar desatualizada). */
  onChanged: () => void | Promise<void>;
}

function successMessage(status: AppointmentStatus) {
  if (status === 'CANCELLED') return 'Agendamento cancelado. O cliente foi avisado por e-mail.';
  if (status === 'NO_SHOW') return 'Falta registrada.';
  return `Status atualizado para “${STATUS_CONFIG[status].label}”.`;
}

/**
 * Mudança de status com as regras de tela do UX-06: cancelar e registrar falta passam por
 * confirmação (`pending`), o resto aplica direto; depois, um toast com "Desfazer" enquanto a API
 * aceitar; erro mostra a mensagem da API.
 */
export function useStatusChange({ change, undo, onChanged }: StatusChangeOptions) {
  const [pending, setPending] = useState<PendingStatusChange | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function undoChange(id: string) {
    try {
      await undo(id);
      toast.success('Mudança desfeita.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Não foi possível desfazer a mudança.'));
    } finally {
      await onChanged();
    }
  }

  async function apply(appointment: Appointment, status: AppointmentStatus) {
    setUpdatingId(appointment.id);
    try {
      const response = await change(appointment.id, status);
      const undoUntil = response.data?.undoUntil ?? null;
      if (isUndoAvailable(undoUntil)) {
        toast.success(successMessage(status), {
          duration: undoToastDuration(undoUntil),
          action: { label: 'Desfazer', onClick: () => void undoChange(appointment.id) },
        });
      } else {
        toast.success(successMessage(status));
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Erro ao atualizar o status.'));
    } finally {
      setPending(null);
      setUpdatingId(null);
      await onChanged();
    }
  }

  /** Pede a mudança: o que avisa o cliente ou registra falta abre a confirmação antes. */
  function request(appointment: Appointment, status: AppointmentStatus) {
    if (needsConfirmation(status)) {
      setPending({ appointment, status });
      return;
    }
    void apply(appointment, status);
  }

  function confirmPending() {
    if (pending) void apply(pending.appointment, pending.status);
  }

  function dismissPending() {
    if (!updatingId) setPending(null);
  }

  return {
    pending,
    request,
    confirmPending,
    dismissPending,
    updatingId,
    isUpdating: updatingId !== null,
  };
}
