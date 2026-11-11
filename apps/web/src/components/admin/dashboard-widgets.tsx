'use client';

import type { ReactNode } from 'react';
import type { DashboardPeriod } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
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

/**
 * `light` = texto sobre o cartão preto (sempre escuro, nos dois temas). Fora dele a cor vem dos
 * tokens de tom, que escurecem no tema claro (UX-11).
 * `basis` diz sobre o que a variação foi calculada, quando não é o número em destaque.
 */
export function ChangeLabel({
  value,
  light = false,
  basis,
}: {
  value: number;
  light?: boolean;
  basis?: string;
}) {
  const suffix = basis ? ` (${basis})` : '';

  if (value === 0) {
    return (
      <span className={light ? 'text-white/55' : 'text-muted-foreground'}>
        Estável vs anterior{suffix}
      </span>
    );
  }

  const up = value > 0;
  const tone = light
    ? up
      ? 'text-emerald-400'
      : 'text-red-400'
    : up
      ? 'text-tone-success'
      : 'text-tone-danger';
  return (
    <span className={tone}>
      {up ? '+' : ''}
      {value}% vs anterior{suffix}
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
          aria-label={`${label}: ${selected?.name ?? 'todos'}`}
          className={cn(
            'inline-flex max-w-[12rem] items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
            value
              ? 'bg-[var(--admin-card-muted)] text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <span className="truncate">{selected?.name || label}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
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
  changeBasis,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  change?: number;
  changeBasis?: string;
  /** Valor à parte, com rótulo próprio, entre o número e as dicas. */
  children?: ReactNode;
}) {
  return (
    <section data-motion="enter" className="admin-surface p-4 sm:p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p>
      {children}
      <div className="mt-2 flex min-w-0 flex-col gap-0.5 text-xs">
        {typeof change === 'number' ? <ChangeLabel value={change} basis={changeBasis} /> : null}
        {hint ? <span className="break-words text-muted-foreground">{hint}</span> : null}
      </div>
    </section>
  );
}

/** A variação que a API manda compara o total do período (faturado + previsto), não só o faturado. */
const REVENUE_CHANGE_BASIS = 'faturado + previsto';

/**
 * DOM-08: o número grande é só o que já foi faturado (atendimentos concluídos). O que ainda
 * está na agenda aparece à parte, como "Previsto": antes os dois vinham somados em "Receita".
 */
export function RevenueKpiCard({
  completed,
  expected,
  change,
}: {
  completed: number;
  expected: number;
  change: number;
}) {
  return (
    <KpiCard
      label="Faturado"
      value={formatCurrency(completed)}
      change={change}
      changeBasis={REVENUE_CHANGE_BASIS}
      hint="Faturado: atendimentos concluídos no período"
    >
      <p className="mt-2 flex items-baseline justify-between gap-3 rounded-xl bg-[var(--admin-card-muted)] px-3 py-2 text-sm">
        <span className="text-muted-foreground">Previsto</span>
        <span className="font-semibold tabular-nums">{formatCurrency(expected)}</span>
      </p>
    </KpiCard>
  );
}

/** Mesmo recorte do DOM-08 para o cartão preto da coluna lateral. */
export function RevenueHeadline({
  completed,
  expected,
  change,
}: {
  completed: number;
  expected: number;
  change: number;
}) {
  return (
    <div className="min-w-0">
      <p className="text-3xl font-semibold tracking-tight">{formatCurrency(completed)}</p>
      <p className="mt-1 text-sm text-white/55">Faturado no período</p>
      <p className="mt-3 text-sm">
        <span className="text-white/55">Previsto</span>{' '}
        <span className="font-semibold tabular-nums">{formatCurrency(expected)}</span>
      </p>
      <p className="mt-1 text-xs">
        <ChangeLabel value={change} light basis={REVENUE_CHANGE_BASIS} />
      </p>
    </div>
  );
}
