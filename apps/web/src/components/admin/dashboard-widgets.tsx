'use client';

import type { DashboardPeriod } from '@/lib/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const DASHBOARD_PERIODS: Array<{ key: DashboardPeriod; label: string }> = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
  { key: 'last7', label: '7 dias' },
  { key: 'last30', label: '30 dias' },
];

export function formatSlotTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

export function formatShortDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Sao_Paulo',
  });
}

export function ChangeLabel({ value, light = false }: { value: number; light?: boolean }) {
  if (value === 0) {
    return (
      <span className={light ? 'text-white/50' : 'text-muted-foreground'}>Estável vs anterior</span>
    );
  }

  const up = value > 0;
  return (
    <span className={up ? 'text-emerald-400' : 'text-red-400'}>
      {up ? '+' : ''}
      {value}% vs anterior
    </span>
  );
}

export function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; name: string }>;
  onChange: (id: string) => void;
}) {
  const selected = options.find((option) => option.id === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex max-w-[12rem] items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
            value
              ? 'bg-[var(--admin-card-muted)] text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <span className="truncate">{selected?.name || label}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto rounded-2xl">
        <DropdownMenuItem onClick={() => onChange('')}>Todos</DropdownMenuItem>
        {options.map((option) => (
          <DropdownMenuItem key={option.id} onClick={() => onChange(option.id)}>
            {option.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  change,
}: {
  label: string;
  value: string;
  hint?: string;
  change?: number;
}) {
  return (
    <section data-motion="enter" className="admin-surface p-4 sm:p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p>
      <div className="mt-2 flex min-w-0 flex-col gap-0.5 text-xs">
        {typeof change === 'number' ? <ChangeLabel value={change} /> : null}
        {hint ? <span className="break-words text-muted-foreground">{hint}</span> : null}
      </div>
    </section>
  );
}
