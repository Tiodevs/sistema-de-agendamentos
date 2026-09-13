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

export function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || fullName;
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
