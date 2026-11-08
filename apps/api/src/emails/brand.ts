export const BRAND = {
  name: 'Leemia',
  accent: '#34C3DD',
  accentForeground: '#052530',
  ink: '#07070A',
  text: '#122026',
  muted: '#5C6F76',
  page: '#E7F4F7',
  card: '#F3FBFD',
  white: '#FFFFFF',
  line: '#D5E8ED',
} as const;

const TIME_ZONE = 'America/Sao_Paulo';

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Um nome de verdade: só letras, acentos, apóstrofo e hífen. */
const PLAIN_NAME = /^[\p{L}\p{M}'’-]{1,40}$/u;
/** Link, domínio ou e-mail colado no campo de nome. */
const LINK_LIKE = /:\/\/|www\.|@|\.\p{L}{2,}/iu;

/**
 * Primeiro nome para a saudação. O nome vem do cadastro livre: se não parece um nome (um
 * domínio, um link, números), vira "cliente" para ninguém usar um e-mail da Leemia como isca.
 */
export function firstName(fullName: string) {
  const first = fullName.trim().split(/\s+/)[0] ?? '';
  return PLAIN_NAME.test(first) ? first : 'cliente';
}

/** Nome completo para mostrar num e-mail. Um nome com cara de link vira "Cliente". */
export function displayName(fullName: string) {
  const value = fullName.trim();
  return value && !LINK_LIKE.test(value) ? value : 'Cliente';
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}min` : `${hours}h`;
}

export function formatLongDate(date: Date) {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(date);

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatTime(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(date);
}

export function appUrl() {
  return (process.env.APP_URL || 'https://agendamento.mefelipe.com.br').replace(/\/$/, '');
}

export function assetBaseUrl() {
  return (process.env.EMAIL_ASSET_BASE_URL || 'https://agendamento.mefelipe.com.br').replace(
    /\/$/,
    '',
  );
}
