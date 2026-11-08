import type { ImpactSummary } from './api';

/**
 * Textos do DOM-02: quando uma mudança de expediente (ou a desativação de um profissional) deixa
 * agendamentos marcados sem atendimento. Sem imports com "@/" para rodar nos testes com node:test.
 */

const TIME_ZONE = 'America/Sao_Paulo';

export function countAppointments(count: number) {
  return count === 1 ? '1 agendamento' : `${count} agendamentos`;
}

export function affectedTitle(count: number) {
  return count === 1 ? '1 agendamento afetado' : `${count} agendamentos afetados`;
}

/** "Qua 24/12 · 10:00", sempre no fuso de São Paulo. */
export function formatAffectedWhen(iso: string) {
  const date = new Date(iso);
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: TIME_ZONE })
    .format(date)
    .replace('.', '');
  const day = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: TIME_ZONE,
  }).format(date);
  const time = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(date);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${day} · ${time}`;
}

/**
 * Toast depois de salvar: o que aconteceu com os afetados. `keptHint` completa a frase quando o
 * admin escolheu manter (ex.: "fora do novo horário", "com o profissional desativado").
 */
export function impactMessage(
  base: string,
  impact?: ImpactSummary | null,
  keptHint = 'fora do novo horário',
) {
  if (!impact || impact.affected === 0) return base;

  if (impact.cancelled > 0) {
    const cancelled =
      impact.cancelled === 1
        ? '1 agendamento cancelado e cliente avisado'
        : `${impact.cancelled} agendamentos cancelados e clientes avisados`;
    return `${base} ${cancelled}.`;
  }

  const kept =
    impact.affected === 1 ? '1 agendamento mantido' : `${impact.affected} agendamentos mantidos`;
  return `${base} ${kept} ${keptHint}: confira na agenda.`;
}
