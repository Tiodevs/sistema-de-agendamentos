import { Badge } from '@/components/ui/badge';
import { STATUS_CONFIG } from '@/lib/appointment-status';
import type { AppointmentStatus } from '@/lib/api';
import { cn } from '@/lib/utils';

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge
      variant="outline"
      className={cn('rounded-full border-border px-2.5 font-medium', config.color)}
    >
      {config.label}
    </Badge>
  );
}
