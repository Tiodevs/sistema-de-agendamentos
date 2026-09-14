'use client';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { StaggerIn } from '@/components/motion/stagger-in';
import { cn } from '@/lib/utils';
import type { BusinessHourPayload } from '@/lib/api';
import { CalendarOff } from 'lucide-react';

const DAY_NAMES = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

const DAY_ABBR = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export function ScheduleHoursEditor({
  hours,
  onChange,
  disabled = false,
  replayKey = 'hours',
}: {
  hours: BusinessHourPayload[];
  onChange: (index: number, field: keyof BusinessHourPayload, value: string | boolean) => void;
  disabled?: boolean;
  replayKey?: string;
}) {
  return (
    <StaggerIn replayKey={replayKey} selector="[data-row]">
      {hours.map((hour, index) => (
        <div
          key={hour.dayOfWeek}
          data-row
          data-motion="lift"
          className={cn(
            'flex min-w-0 flex-col gap-3 rounded-2xl border p-3 transition-colors md:flex-row md:items-center md:gap-4 md:px-4 md:py-3',
            hour.isClosed ? 'bg-muted/30 border-dashed' : 'border-border',
            disabled && 'opacity-70',
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-10 shrink-0">
              <Badge
                variant={hour.isClosed ? 'outline' : 'default'}
                className="w-full justify-center text-[10px]"
              >
                {DAY_ABBR[hour.dayOfWeek]}
              </Badge>
            </div>
            <span className="hidden w-32 shrink-0 text-sm font-medium md:inline">
              {DAY_NAMES[hour.dayOfWeek]}
            </span>
            <div className="ml-auto flex items-center gap-2 md:ml-0">
              <Switch
                checked={!hour.isClosed}
                disabled={disabled}
                onCheckedChange={(checked) => onChange(index, 'isClosed', !checked)}
              />
              <span className="w-14 text-xs text-muted-foreground">
                {hour.isClosed ? 'Fechado' : 'Aberto'}
              </span>
            </div>
          </div>

          {!hour.isClosed ? (
            <div className="grid min-w-0 grid-cols-2 items-end gap-2 md:ml-auto md:flex md:w-auto md:items-center">
              <div className="min-w-0">
                <span className="mb-1 block text-[10px] text-muted-foreground md:hidden">
                  Abertura
                </span>
                <Input
                  type="time"
                  value={hour.openTime}
                  disabled={disabled}
                  onChange={(event) => onChange(index, 'openTime', event.target.value)}
                  className="h-9 w-full min-w-0 px-2 text-sm md:w-32 md:flex-none"
                />
              </div>
              <span className="hidden text-xs text-muted-foreground md:inline">até</span>
              <div className="min-w-0">
                <span className="mb-1 block text-[10px] text-muted-foreground md:hidden">
                  Fechamento
                </span>
                <Input
                  type="time"
                  value={hour.closeTime}
                  disabled={disabled}
                  onChange={(event) => onChange(index, 'closeTime', event.target.value)}
                  className="h-9 w-full min-w-0 px-2 text-sm md:w-32 md:flex-none"
                />
              </div>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <CalendarOff className="size-4 shrink-0" />
              <span className="leading-snug">Não aceita agendamentos</span>
            </div>
          )}
        </div>
      ))}
    </StaggerIn>
  );
}
