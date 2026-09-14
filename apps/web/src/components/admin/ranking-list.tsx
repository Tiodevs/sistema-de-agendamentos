'use client';

import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';

export type RankingItem = {
  id: string;
  name: string;
  count: number;
  revenue?: number;
};

export function RankingList({
  title,
  items,
  selectedId,
  onSelect,
  emptyLabel,
}: {
  title: string;
  items: RankingItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  emptyLabel: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.count));

  return (
    <section data-motion="enter" className="admin-surface p-4 sm:p-5">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => {
            const selected = selectedId === item.id;
            const className = cn(
              'w-full rounded-[1.15rem] p-3 text-left',
              selected ? 'bg-[var(--admin-hover)]' : 'bg-[var(--admin-card-muted)]',
              onSelect && 'transition-colors hover:bg-[var(--admin-hover)]',
            );

            const body = (
              <>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">{item.count}</p>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--admin-track)]">
                  <div
                    className="h-full rounded-full bg-[var(--admin-accent)]"
                    style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }}
                  />
                </div>
                {typeof item.revenue === 'number' ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {formatCurrency(item.revenue)}
                  </p>
                ) : null}
              </>
            );

            if (!onSelect) {
              return (
                <div key={item.id} className={className}>
                  {body}
                </div>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(selected ? '' : item.id)}
                className={className}
              >
                {body}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
