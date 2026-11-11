import type { AppointmentStatus } from '@/lib/api';

// UX-11: as cores vêm dos tokens `--status-*` (styles/tokens.css), com um tom para cada tema.
// `color` é o texto e `dotColor` a bolinha/barra; para fundo suave e borda existem
// `bg-status-<nome>-bg` e `border-status-<nome>-border`.
export const STATUS_CONFIG: Record<
  AppointmentStatus,
  {
    label: string;
    color: string;
    dotColor: string;
    badge: 'default' | 'secondary' | 'destructive' | 'outline';
  }
> = {
  SCHEDULED: {
    label: 'Agendado',
    color: 'text-status-scheduled',
    dotColor: 'bg-status-scheduled',
    badge: 'outline',
  },
  CONFIRMED: {
    label: 'Confirmado',
    color: 'text-status-confirmed',
    dotColor: 'bg-status-confirmed',
    badge: 'default',
  },
  IN_PROGRESS: {
    label: 'Em andamento',
    color: 'text-status-in-progress',
    dotColor: 'bg-status-in-progress',
    badge: 'default',
  },
  COMPLETED: {
    label: 'Concluído',
    color: 'text-status-completed',
    dotColor: 'bg-status-completed',
    badge: 'secondary',
  },
  CANCELLED: {
    label: 'Cancelado',
    color: 'text-status-cancelled',
    dotColor: 'bg-status-cancelled',
    badge: 'destructive',
  },
  NO_SHOW: {
    label: 'Não compareceu',
    color: 'text-status-no-show',
    dotColor: 'bg-status-no-show',
    badge: 'destructive',
  },
};

export const STATUS_OPTIONS: AppointmentStatus[] = [
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];
