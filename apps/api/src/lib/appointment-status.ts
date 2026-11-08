/**
 * Máquina de estados do agendamento (DOM-01, DOM-03, DOM-09). É a única fonte das regras de
 * status: admin, profissional e cliente passam por aqui, e o front recebe a lista pronta
 * (`allowedStatuses`) em vez de repetir as regras.
 */

export const APPOINTMENT_STATUS_VALUES = [
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

export type AppointmentStatusValue = (typeof APPOINTMENT_STATUS_VALUES)[number];

/** Quem pede a mudança. `CLIENT` é o próprio cliente do agendamento. */
export type StatusActor = 'ADMIN' | 'EMPLOYEE' | 'CLIENT';

/** Status de onde não se sai: o atendimento terminou, foi cancelado ou o cliente faltou. */
export const FINAL_STATUSES: readonly AppointmentStatusValue[] = [
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

export const STATUS_LABELS: Record<AppointmentStatusValue, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
};

/** Para onde cada status pode ir, antes das regras de papel e de horário. */
export const STATUS_TRANSITIONS: Record<AppointmentStatusValue, readonly AppointmentStatusValue[]> =
  {
    SCHEDULED: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
    CONFIRMED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
    IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
    NO_SHOW: [],
  };

/** O que cada papel pode marcar (sempre dentro de `STATUS_TRANSITIONS`). */
const ACTOR_TARGETS: Record<StatusActor, readonly AppointmentStatusValue[]> = {
  ADMIN: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
  EMPLOYEE: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
  CLIENT: ['CANCELLED'],
};

/** Dá para iniciar o atendimento um pouco antes do horário (cliente que chega cedo). */
export const EARLY_START_MINUTES = 60;

/** Janela do "Desfazer" depois de uma mudança de status. */
export const UNDO_WINDOW_MINUTES = 10;

export type TransitionResult =
  | { ok: true }
  | { ok: false; statusCode: 403 | 409; code: string; message: string };

export interface TransitionInput {
  from: AppointmentStatusValue;
  to: AppointmentStatusValue;
  actor: StatusActor;
  /** Início do atendimento. */
  start: Date;
  /** Antecedência mínima para cliente e profissional cancelarem sozinhos. */
  cancellationNoticeMinutes: number;
  now?: Date;
}

function deny(statusCode: 403 | 409, code: string, message: string): TransitionResult {
  return { ok: false, statusCode, code, message };
}

function formatNotice(minutes: number) {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? '1 hora' : `${hours} horas`;
  }
  return `${minutes} minutos`;
}

export function checkTransition(input: TransitionInput): TransitionResult {
  const now = input.now ?? new Date();
  const { from, to, actor } = input;

  if (from === to) {
    return deny(409, 'SAME_STATUS', `O agendamento já está como “${STATUS_LABELS[to]}”.`);
  }

  if (FINAL_STATUSES.includes(from)) {
    return deny(
      409,
      'FINAL_STATUS',
      `Um agendamento “${STATUS_LABELS[from]}” não muda mais de status. Para marcar de novo, crie um novo agendamento.`,
    );
  }

  if (!STATUS_TRANSITIONS[from].includes(to)) {
    return deny(
      409,
      'INVALID_TRANSITION',
      `Não dá para passar de “${STATUS_LABELS[from]}” para “${STATUS_LABELS[to]}”.`,
    );
  }

  if (!ACTOR_TARGETS[actor].includes(to)) {
    return deny(403, 'ROLE_NOT_ALLOWED', 'Você não pode fazer esta mudança neste agendamento.');
  }

  const startMs = input.start.getTime();
  const nowMs = now.getTime();

  if (to === 'IN_PROGRESS' && nowMs < startMs - EARLY_START_MINUTES * 60_000) {
    return deny(
      409,
      'TOO_EARLY',
      `Só dá para iniciar o atendimento a partir de ${formatNotice(EARLY_START_MINUTES)} antes do horário.`,
    );
  }

  if (to === 'COMPLETED' && nowMs < startMs) {
    return deny(409, 'TOO_EARLY', 'Só dá para concluir depois que o horário começa.');
  }

  if (to === 'NO_SHOW' && nowMs < startMs) {
    return deny(409, 'TOO_EARLY', 'A falta só pode ser registrada depois do horário marcado.');
  }

  if (to === 'CANCELLED') {
    if (actor !== 'ADMIN' && from === 'IN_PROGRESS') {
      return deny(
        403,
        'ROLE_NOT_ALLOWED',
        'O atendimento já começou: só o estúdio pode cancelar agora.',
      );
    }

    if (actor !== 'ADMIN') {
      const deadline = startMs - input.cancellationNoticeMinutes * 60_000;
      if (nowMs >= deadline) {
        const notice = formatNotice(input.cancellationNoticeMinutes);
        return deny(
          409,
          'CANCELLATION_WINDOW_CLOSED',
          nowMs >= startMs
            ? 'O horário já começou e não pode mais ser cancelado por aqui. Fale com o estúdio.'
            : actor === 'CLIENT'
              ? `Cancelamentos só até ${notice} antes do horário. Fale com o estúdio para cancelar agora.`
              : `Cancelamentos pelo painel só até ${notice} antes do horário. Peça ao estúdio, ou registre a falta depois do horário.`,
        );
      }
    }
  }

  return { ok: true };
}

/** Status que `actor` pode marcar agora, na ordem da tabela. */
export function allowedTransitions(input: Omit<TransitionInput, 'to'>): AppointmentStatusValue[] {
  return STATUS_TRANSITIONS[input.from].filter((to) => checkTransition({ ...input, to }).ok);
}

/** Até quando o cliente (ou o profissional) pode cancelar sozinho. */
export function cancellationDeadline(start: Date, cancellationNoticeMinutes: number) {
  return new Date(start.getTime() - cancellationNoticeMinutes * 60_000);
}

export interface StatusChangeLike {
  fromStatus: AppointmentStatusValue;
  toStatus: AppointmentStatusValue;
  actorId: string | null;
  createdAt: Date;
  revertedAt: Date | null;
}

/**
 * "Desfazer" vale para a última mudança, feita pela mesma pessoa há até `UNDO_WINDOW_MINUTES`.
 * Cancelamento não se desfaz: o cliente já recebeu o aviso e o horário pode ter sido ocupado.
 */
export function checkUndo(input: {
  change: StatusChangeLike | null;
  currentStatus: AppointmentStatusValue;
  actorId: string;
  now?: Date;
}): TransitionResult {
  const now = input.now ?? new Date();
  const { change } = input;

  if (!change || change.revertedAt || change.toStatus !== input.currentStatus) {
    return deny(409, 'NOTHING_TO_UNDO', 'Não há mudança recente para desfazer.');
  }

  if (change.actorId !== input.actorId) {
    return deny(403, 'UNDO_NOT_ALLOWED', 'Só quem fez a mudança pode desfazê-la.');
  }

  if (change.toStatus === 'CANCELLED') {
    return deny(
      409,
      'UNDO_NOT_ALLOWED',
      'Cancelamento não pode ser desfeito: o cliente já foi avisado. Crie um novo agendamento.',
    );
  }

  if (now.getTime() - change.createdAt.getTime() > UNDO_WINDOW_MINUTES * 60_000) {
    return deny(
      409,
      'UNDO_EXPIRED',
      `Passou o prazo para desfazer (${UNDO_WINDOW_MINUTES} minutos).`,
    );
  }

  return { ok: true };
}

/** Até quando a mudança pode ser desfeita, ou `null` se ela não se desfaz. */
export function undoDeadline(change: Pick<StatusChangeLike, 'toStatus' | 'createdAt'>) {
  if (change.toStatus === 'CANCELLED') return null;
  return new Date(change.createdAt.getTime() + UNDO_WINDOW_MINUTES * 60_000);
}
