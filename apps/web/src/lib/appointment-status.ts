import type { AppointmentStatus } from '@/lib/api';

export const STATUS_CONFIG: Record<
  AppointmentStatus,
  {
    label: string;
    color: string;
    dotColor: string;
    badge: 'default' | 'secondary' | 'destructive' | 'outline';
  }
> = {
  SCHEDULED: { label: 'Agendado', color: 'text-sky-400', dotColor: 'bg-sky-400', badge: 'outline' },
  CONFIRMED: {
    label: 'Confirmado',
    color: 'text-emerald-400',
    dotColor: 'bg-emerald-400',
    badge: 'default',
  },
  IN_PROGRESS: {
    label: 'Em andamento',
    color: 'text-[#00DDB2]',
    dotColor: 'bg-[#00DDB2]',
    badge: 'default',
  },
  COMPLETED: {
    label: 'Concluído',
    color: 'text-emerald-300',
    dotColor: 'bg-emerald-300',
    badge: 'secondary',
  },
  CANCELLED: {
    label: 'Cancelado',
    color: 'text-red-400',
    dotColor: 'bg-red-400',
    badge: 'destructive',
  },
  NO_SHOW: {
    label: 'Não compareceu',
    color: 'text-muted-foreground',
    dotColor: 'bg-muted-foreground',
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
