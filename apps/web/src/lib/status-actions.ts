/**
 * Como mostrar as ações de status (UX-06, DOM-03, DOM-09). Quem decide o que é permitido é a API,
 * em `allowedStatuses`; aqui só se organiza o que aparece na tela. Sem imports com alias, para os
 * testes rodarem direto no Node.
 */

export type StatusValue =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type StatusActor = 'ADMIN' | 'EMPLOYEE' | 'CLIENT';

const TIME_ZONE = 'America/Sao_Paulo';

export const ALL_STATUSES: readonly StatusValue[] = [
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

/** Avançar o atendimento, na ordem em que acontece. */
const PROGRESS_ORDER: readonly StatusValue[] = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];
/** Mudanças que encerram o horário sem atendimento. */
const DESTRUCTIVE_ORDER: readonly StatusValue[] = ['NO_SHOW', 'CANCELLED'];

/** Cancelamento avisa o cliente e libera o horário; falta entra nas métricas: sempre confirmar. */
const CONFIRM_REQUIRED: readonly StatusValue[] = ['CANCELLED', 'NO_SHOW'];

const UPCOMING_ACTIVE: readonly StatusValue[] = ['SCHEDULED', 'CONFIRMED'];

export const STATUS_ACTION_LABELS: Record<StatusValue, string> = {
  SCHEDULED: 'Voltar para agendado',
  CONFIRMED: 'Confirmar',
  IN_PROGRESS: 'Iniciar atendimento',
  COMPLETED: 'Concluir',
  CANCELLED: 'Cancelar agendamento',
  NO_SHOW: 'Registrar falta',
};

export interface StatusAware {
  status: StatusValue;
  date: string;
  allowedStatuses?: StatusValue[];
  cancellableUntil?: string;
}

/**
 * O que a API permite agora. Se a resposta não trouxer `allowedStatuses` (API antiga no ar), vale a
 * regra de antes para a tela não travar: admin escolhe qualquer status, profissional avança um
 * passo e cliente cancela o que ainda não aconteceu.
 */
export function effectiveAllowed(
  appointment: StatusAware,
  actor: StatusActor,
  now = new Date(),
): StatusValue[] {
  if (Array.isArray(appointment.allowedStatuses)) return appointment.allowedStatuses;

  if (actor === 'ADMIN') return ALL_STATUSES.filter((status) => status !== appointment.status);
  if (actor === 'EMPLOYEE') {
    const next: Partial<Record<StatusValue, StatusValue>> = {
      SCHEDULED: 'CONFIRMED',
      CONFIRMED: 'IN_PROGRESS',
      IN_PROGRESS: 'COMPLETED',
    };
    const status = next[appointment.status];
    return status ? [status] : [];
  }
  const upcoming = new Date(appointment.date).getTime() > now.getTime();
  return upcoming && UPCOMING_ACTIVE.includes(appointment.status) ? ['CANCELLED'] : [];
}

export function needsConfirmation(status: StatusValue) {
  return CONFIRM_REQUIRED.includes(status);
}

/** Separa o permitido em "avançar" e "encerrar", na ordem de exibição. */
export function groupActions(allowed: readonly StatusValue[]) {
  return {
    progress: PROGRESS_ORDER.filter((status) => allowed.includes(status)),
    destructive: DESTRUCTIVE_ORDER.filter((status) => allowed.includes(status)),
  };
}

/**
 * Botões da linha na agenda do profissional: "Confirmar" só aparece enquanto ainda não dá para
 * iniciar ou concluir (perto do horário, o passo útil é começar o atendimento).
 */
export function inlineActions(allowed: readonly StatusValue[]) {
  const { progress } = groupActions(allowed);
  const startable = progress.includes('IN_PROGRESS') || progress.includes('COMPLETED');
  return startable ? progress.filter((status) => status !== 'CONFIRMED') : progress;
}

export function isUndoAvailable(undoUntil: string | null | undefined, now = new Date()) {
  if (!undoUntil) return false;
  const until = new Date(undoUntil).getTime();
  return Number.isFinite(until) && until > now.getTime();
}

/** Quanto tempo o toast com "Desfazer" fica na tela: até o prazo, no máximo `maxMs`. */
export function undoToastDuration(
  undoUntil: string | null | undefined,
  now = new Date(),
  maxMs = 10_000,
) {
  if (!isUndoAvailable(undoUntil, now)) return 0;
  return Math.min(maxMs, new Date(undoUntil as string).getTime() - now.getTime());
}

export type CancellationState =
  /** Pode cancelar sozinho até `until`. */
  | { kind: 'allowed'; until: string | null }
  /** Ainda vai acontecer, mas o prazo passou: só o estúdio cancela. */
  | { kind: 'studio-only' }
  /** Já passou, terminou ou foi cancelado. */
  | { kind: 'none' };

export function cancellationState(
  appointment: StatusAware,
  actor: StatusActor,
  now = new Date(),
): CancellationState {
  if (effectiveAllowed(appointment, actor, now).includes('CANCELLED')) {
    return { kind: 'allowed', until: appointment.cancellableUntil ?? null };
  }
  const upcoming = new Date(appointment.date).getTime() > now.getTime();
  if (upcoming && UPCOMING_ACTIVE.includes(appointment.status)) return { kind: 'studio-only' };
  return { kind: 'none' };
}

function dateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function nextDateKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/** "hoje às 14:00", "amanhã às 09:30" ou "sex, 14/11 às 12:00", no horário de São Paulo. */
export function formatDeadline(iso: string, now = new Date()) {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(date);

  const today = dateKey(now);
  const target = dateKey(date);
  if (target === today) return `hoje às ${time}`;
  if (target === nextDateKey(today)) return `amanhã às ${time}`;

  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: TIME_ZONE })
    .format(date)
    .replace('.', '');
  const [, month, day] = target.split('-');
  return `${weekday}, ${day}/${month} às ${time}`;
}
