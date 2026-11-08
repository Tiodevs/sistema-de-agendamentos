import type { EmployeeAccess } from './api';

/**
 * Como mostrar o acesso do profissional ao painel (SEC-03). Sem imports com "@/" para rodar nos
 * testes com node:test.
 */

const TIME_ZONE = 'America/Sao_Paulo';

export type AccessTone = 'ok' | 'pending' | 'warning' | 'muted';

export interface AccessView {
  label: string;
  /** Linha extra: o e-mail da conta ligada ou quando o convite venceu. */
  detail: string | null;
  tone: AccessTone;
  /** Enviar convite (sem acesso, vencido) ou reenviar (pendente). */
  inviteLabel: string | null;
  /** Tirar o acesso (conta ligada) ou cancelar o convite em aberto. */
  revokeLabel: string | null;
}

function formatDayMonth(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

export function describeAccess(access: EmployeeAccess | undefined, now = new Date()): AccessView {
  if (access?.status === 'linked') {
    return {
      label: 'Com acesso ao painel',
      detail: access.email,
      tone: 'ok',
      inviteLabel: null,
      revokeLabel: 'Remover acesso',
    };
  }

  if (access?.status === 'pending' || access?.status === 'expired') {
    // A página pode ficar aberta além do prazo: o vencimento vale pelo relógio daqui.
    const expired = access.status === 'expired' || new Date(access.expiresAt) <= now;
    if (expired) {
      return {
        label: 'Convite expirado',
        detail: `Venceu em ${formatDayMonth(access.expiresAt)}`,
        tone: 'warning',
        inviteLabel: 'Reenviar convite',
        revokeLabel: null,
      };
    }
    return {
      label: `Convite pendente até ${formatDayMonth(access.expiresAt)}`,
      detail: null,
      tone: 'pending',
      inviteLabel: 'Reenviar convite',
      revokeLabel: 'Cancelar convite',
    };
  }

  return {
    label: 'Sem acesso ao painel',
    detail: null,
    tone: 'muted',
    inviteLabel: 'Enviar convite',
    revokeLabel: null,
  };
}
