'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
const MAX_MONTHS_AHEAD = 24;

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function todayDateKey() {
  return toDateKey(new Date());
}

function startOfMonth(year: number, month: number) {
  return new Date(year, month, 1);
}

function clampMonth(date: Date, min: Date, max: Date) {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

function formatLongDate(dateKey: string) {
  const formatted = parseDateKey(dateKey).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function BookingDatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (dateKey: string) => void;
}) {
  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);
  const minMonth = useMemo(() => startOfMonth(today.getFullYear(), today.getMonth()), [today]);
  const maxDay = useMemo(() => {
    const date = new Date(today);
    date.setMonth(date.getMonth() + MAX_MONTHS_AHEAD);
    return date;
  }, [today]);
  const maxMonth = useMemo(() => startOfMonth(maxDay.getFullYear(), maxDay.getMonth()), [maxDay]);
  const years = useMemo(() => {
    const list: number[] = [];
    for (let year = minMonth.getFullYear(); year <= maxMonth.getFullYear(); year += 1) {
      list.push(year);
    }
    return list;
  }, [minMonth, maxMonth]);

  const initial = value ? parseDateKey(value) : today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  useEffect(() => {
    if (!value) return;
    const next = parseDateKey(value);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }, [value]);

  function setView(year: number, month: number) {
    const next = clampMonth(startOfMonth(year, month), minMonth, maxMonth);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  const canGoPrev = startOfMonth(viewYear, viewMonth) > minMonth;
  const canGoNext = startOfMonth(viewYear, viewMonth) < maxMonth;

  const cells = useMemo(() => {
    const firstWeekday = startOfMonth(viewYear, viewMonth).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const leading = Array.from({ length: firstWeekday }, () => null);
    const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
    return [...leading, ...days];
  }, [viewYear, viewMonth]);

  const todayKey = toDateKey(today);
  const maxKey = toDateKey(maxDay);

  return (
    <div className="rounded-[1.35rem] bg-[var(--admin-card-muted)] p-3 sm:p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 gap-2">
          <Select
            value={String(viewMonth)}
            onValueChange={(next) => setView(viewYear, Number(next))}
          >
            <SelectTrigger
              size="sm"
              className="h-10 min-w-0 w-full flex-1 rounded-full bg-[var(--admin-panel)] sm:h-9"
              aria-label="Mês"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              {MONTHS.map((label, month) => {
                const option = startOfMonth(viewYear, month);
                const disabled = option < minMonth || option > maxMonth;
                return (
                  <SelectItem key={label} value={String(month)} disabled={disabled}>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Select
            value={String(viewYear)}
            onValueChange={(next) => setView(Number(next), viewMonth)}
          >
            <SelectTrigger
              size="sm"
              className="h-10 w-[7.25rem] rounded-full bg-[var(--admin-panel)] sm:h-9"
              aria-label="Ano"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            className="h-10 rounded-full px-3 sm:h-9"
            onClick={() => {
              onChange(todayKey);
              setView(today.getFullYear(), today.getMonth());
            }}
          >
            Hoje
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 rounded-2xl sm:size-9"
            onClick={() => setView(viewYear, viewMonth - 1)}
            disabled={!canGoPrev}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 rounded-2xl sm:size-9"
            onClick={() => setView(viewYear, viewMonth + 1)}
            disabled={!canGoNext}
            aria-label="Próximo mês"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground sm:text-xs">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} />;
          }

          const date = new Date(viewYear, viewMonth, day);
          const dateKey = toDateKey(date);
          const selected = value === dateKey;
          const isToday = dateKey === todayKey;
          const disabled = dateKey < todayKey || dateKey > maxKey;

          return (
            <button
              key={dateKey}
              type="button"
              disabled={disabled}
              onClick={() => onChange(dateKey)}
              aria-label={formatLongDate(dateKey)}
              aria-pressed={selected}
              className={cn(
                'flex h-11 items-center justify-center rounded-2xl text-sm font-medium transition-colors sm:h-10',
                disabled && 'cursor-not-allowed text-muted-foreground/35',
                !disabled && !selected && 'hover:bg-[var(--admin-hover)]',
                selected && 'bg-primary text-primary-foreground',
                isToday && !selected && 'text-[var(--admin-accent)]',
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      {value ? (
        <p className="mt-3 text-center text-sm text-muted-foreground">{formatLongDate(value)}</p>
      ) : (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Escolha o mês e o ano para marcar uma data futura.
        </p>
      )}
    </div>
  );
}
