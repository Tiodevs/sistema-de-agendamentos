'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { StaggerIn } from '@/components/motion/stagger-in';
import { cn } from '@/lib/utils';
import type { BusinessHourPayload, TimeRange } from '@/lib/api';
import { MAX_BREAKS_PER_DAY, breaksError, suggestBreak } from '@/lib/schedule-breaks';
import { CalendarOff, Coffee, Plus, X } from 'lucide-react';

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

export type HourFieldValue = string | boolean | TimeRange[];

export function ScheduleHoursEditor({
  hours,
  onChange,
  disabled = false,
  replayKey = 'hours',
  breaksHint,
}: {
  hours: BusinessHourPayload[];
  onChange: (index: number, field: keyof BusinessHourPayload, value: HourFieldValue) => void;
  disabled?: boolean;
  replayKey?: string;
  /** Texto de apoio das pausas (ex.: no profissional, que as pausas do estúdio continuam valendo). */
  breaksHint?: string;
}) {
  return (
    <StaggerIn replayKey={replayKey} selector="[data-row]">
      {hours.map((hour, index) => {
        const dayName = DAY_NAMES[hour.dayOfWeek];
        const breaks = hour.breaks ?? [];
        const error = breaksError(hour);
        const canAdd = !disabled && breaks.length < MAX_BREAKS_PER_DAY && suggestBreak(hour);

        function setBreak(position: number, field: keyof TimeRange, value: string) {
          onChange(
            index,
            'breaks',
            breaks.map((item, at) => (at === position ? { ...item, [field]: value } : item)),
          );
        }

        return (
          <div
            key={hour.dayOfWeek}
            data-row
            data-motion="lift"
            className={cn(
              'min-w-0 rounded-2xl border p-3 transition-colors md:px-4 md:py-3',
              hour.isClosed ? 'bg-muted/30 border-dashed' : 'border-border',
              disabled && 'opacity-70',
            )}
          >
            <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:gap-4">
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
                  {dayName}
                </span>
                <div className="ml-auto flex items-center gap-2 md:ml-0">
                  {/* UX-10: sem rótulo o leitor de tela anunciava só "botão de alternância". */}
                  <Switch
                    aria-label={`${dayName}: aberto`}
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
                      aria-label={`Abertura de ${dayName}`}
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
                      aria-label={`Fechamento de ${dayName}`}
                      value={hour.closeTime}
                      disabled={disabled}
                      onChange={(event) => onChange(index, 'closeTime', event.target.value)}
                      className="h-9 w-full min-w-0 px-2 text-sm md:w-32 md:flex-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                  <CalendarOff className="size-4 shrink-0" aria-hidden />
                  <span className="leading-snug">Não aceita agendamentos</span>
                </div>
              )}
            </div>

            {/* UX-12: pausas do dia (almoço, intervalo). Os horários dentro delas somem da grade. */}
            {!hour.isClosed && (breaks.length > 0 || !disabled) ? (
              <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 border-t border-dashed border-border pt-3 md:pl-[11.75rem]">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Coffee className="size-3.5" aria-hidden />
                  {breaks.length === 0 ? 'Sem pausas' : breaks.length === 1 ? 'Pausa' : 'Pausas'}
                </span>
                {breaks.map((range, position) => (
                  <div
                    key={position}
                    className="flex items-center gap-1 rounded-full bg-[var(--admin-card-muted)] py-1 pl-2 pr-1"
                  >
                    <Input
                      type="time"
                      aria-label={`Início da pausa ${position + 1} de ${dayName}`}
                      value={range.start}
                      disabled={disabled}
                      onChange={(event) => setBreak(position, 'start', event.target.value)}
                      className="h-7 w-[5.75rem] border-0 bg-transparent px-1 text-xs shadow-none"
                    />
                    <span className="text-xs text-muted-foreground" aria-hidden>
                      –
                    </span>
                    <Input
                      type="time"
                      aria-label={`Fim da pausa ${position + 1} de ${dayName}`}
                      value={range.end}
                      disabled={disabled}
                      onChange={(event) => setBreak(position, 'end', event.target.value)}
                      className="h-7 w-[5.75rem] border-0 bg-transparent px-1 text-xs shadow-none"
                    />
                    {!disabled ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6 rounded-full"
                        aria-label={`Remover a pausa ${position + 1} de ${dayName}`}
                        onClick={() =>
                          onChange(
                            index,
                            'breaks',
                            breaks.filter((_, at) => at !== position),
                          )
                        }
                      >
                        <X className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                ))}
                {canAdd ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-full px-2 text-xs"
                    aria-label={`Adicionar pausa em ${dayName}`}
                    onClick={() => onChange(index, 'breaks', [...breaks, canAdd])}
                  >
                    <Plus className="size-3.5" />
                    Adicionar pausa
                  </Button>
                ) : null}
                {error ? (
                  <p role="alert" className="basis-full text-xs text-destructive">
                    {error}
                  </p>
                ) : breaksHint && index === hours.findIndex((item) => !item.isClosed) ? (
                  <p className="basis-full text-xs text-muted-foreground">{breaksHint}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </StaggerIn>
  );
}
