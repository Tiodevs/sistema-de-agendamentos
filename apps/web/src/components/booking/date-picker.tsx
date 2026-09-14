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
import { formatLongDate, todayDateKey, weekdayFromDateKey } from '@/lib/datetime';

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

export function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return { year, month, day };
}

function civilKey(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addMonths(year: number, monthIndex: number, delta: number) {
  const date = new Date(Date.UTC(year, monthIndex + delta, 1));
  return { year: date.getUTCFullYear(), monthIndex: date.getUTCMonth() };
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function monthValue(year: number, monthIndex: number) {
  return year * 12 + monthIndex;
}

export function BookingDatePicker({
  value,
  onChange,
  isDateDisabled,
}: {
  value: string;
  onChange: (dateKey: string) => void;
  isDateDisabled?: (dateKey: string) => boolean;
}) {
  const todayKey = todayDateKey();
  const today = parseDateKey(todayKey);
  const minMonthValue = monthValue(today.year, today.month - 1);
  const maxParts = addMonths(today.year, today.month - 1, MAX_MONTHS_AHEAD);
  const maxMonthValue = monthValue(maxParts.year, maxParts.monthIndex);
  const maxKey = civilKey(
    maxParts.year,
    maxParts.monthIndex,
    daysInMonth(maxParts.year, maxParts.monthIndex),
  );
  const years = useMemo(() => {
    const list: number[] = [];
    for (let year = today.year; year <= maxParts.year; year += 1) {
      list.push(year);
    }
    return list;
  }, [today.year, maxParts.year]);

  const initial = value ? parseDateKey(value) : today;
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month - 1);

  useEffect(() => {
    if (!value) return;
    const next = parseDateKey(value);
    setViewYear(next.year);
    setViewMonth(next.month - 1);
  }, [value]);

  function setView(year: number, monthIndex: number) {
    const nextValue = monthValue(year, monthIndex);
    if (nextValue < minMonthValue) {
      setViewYear(today.year);
      setViewMonth(today.month - 1);
      return;
    }
    if (nextValue > maxMonthValue) {
      setViewYear(maxParts.year);
      setViewMonth(maxParts.monthIndex);
      return;
    }
    setViewYear(year);
    setViewMonth(monthIndex);
  }

  const canGoPrev = monthValue(viewYear, viewMonth) > minMonthValue;
  const canGoNext = monthValue(viewYear, viewMonth) < maxMonthValue;
  const firstWeekday = weekdayFromDateKey(civilKey(viewYear, viewMonth, 1));
  const monthDays = daysInMonth(viewYear, viewMonth);
  const cells = useMemo(() => {
    const leading = Array.from({ length: firstWeekday }, () => null);
    const days = Array.from({ length: monthDays }, (_, index) => index + 1);
    return [...leading, ...days];
  }, [firstWeekday, monthDays]);

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
              className="h-10 min-w-0 w-full flex-1 rounded-full bg-[var(--admin-card)] sm:h-9"
              aria-label="Mês"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              {MONTHS.map((label, month) => {
                const optionValue = monthValue(viewYear, month);
                const disabled = optionValue < minMonthValue || optionValue > maxMonthValue;
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
              className="h-10 w-[7.25rem] rounded-full bg-[var(--admin-card)] sm:h-9"
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
              setView(today.year, today.month - 1);
            }}
            disabled={Boolean(isDateDisabled?.(todayKey))}
          >
            Hoje
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 rounded-2xl sm:size-9"
            onClick={() => {
              const previous = addMonths(viewYear, viewMonth, -1);
              setView(previous.year, previous.monthIndex);
            }}
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
            onClick={() => {
              const next = addMonths(viewYear, viewMonth, 1);
              setView(next.year, next.monthIndex);
            }}
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

          const dateKey = civilKey(viewYear, viewMonth, day);
          const selected = value === dateKey;
          const isToday = dateKey === todayKey;
          const disabled =
            dateKey < todayKey || dateKey > maxKey || Boolean(isDateDisabled?.(dateKey));

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
