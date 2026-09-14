'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { gsap, useGSAP } from '@/lib/gsap';
import { useMotion } from '@/components/motion/motion-provider';
import { formatCompactHours } from '@/lib/format';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type WeeklyBar = {
  start: string;
  label?: string;
  tooltipLabel?: string;
  completedMinutes: number;
  scheduledMinutes: number;
  completedCount?: number;
  scheduledCount?: number;
};

function axisLabel(week: WeeklyBar, index: number) {
  if (week.label) return week.label;
  return `S${index + 1}`;
}

function barValue(week: WeeklyBar) {
  const count = (week.completedCount ?? 0) + (week.scheduledCount ?? 0);
  const minutes = week.completedMinutes + week.scheduledMinutes;
  if (count > 0) return String(count);
  if (minutes > 0) return formatCompactHours(minutes);
  return '0';
}

export function WeeklyChart({ weeks }: { weeks: WeeklyBar[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { introComplete } = useMotion();
  const max = Math.max(1, ...weeks.map((week) => week.completedMinutes + week.scheduledMinutes));
  const chartKey = weeks
    .map(
      (week) =>
        `${week.start}:${week.completedMinutes}:${week.scheduledMinutes}:${week.completedCount ?? 0}`,
    )
    .join('|');

  useGSAP(
    () => {
      if (!introComplete) return;
      const bars = ref.current?.querySelectorAll('[data-motion="bar"]');
      if (!bars?.length) return;

      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(bars, { scaleY: 1 });
      });
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          bars,
          { scaleY: 0 },
          {
            scaleY: 1,
            duration: 0.7,
            stagger: 0.045,
            ease: 'power2.out',
            transformOrigin: '50% 100%',
            overwrite: 'auto',
          },
        );
      });

      return () => mm.revert();
    },
    { scope: ref, dependencies: [introComplete, chartKey], revertOnUpdate: true },
  );

  if (weeks.length === 0) {
    return (
      <div ref={ref} className="flex h-52 items-end gap-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            data-motion="bar"
            className="flex-1 rounded-2xl bg-[var(--admin-track)]"
            style={{ height: `${18 + (index % 4) * 8}%` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={cn(
        'flex h-52 min-w-0 items-stretch gap-1.5 sm:gap-2.5',
        weeks.length > 8 && 'admin-scroll-x',
        weeks.length <= 4 && 'justify-center',
      )}
    >
      {weeks.map((week, index) => {
        const totalMinutes = week.completedMinutes + week.scheduledMinutes;
        const totalCount = (week.completedCount ?? 0) + (week.scheduledCount ?? 0);
        const height = totalMinutes === 0 ? 22 : Math.max(18, (totalMinutes / max) * 100);
        const completedShare =
          totalMinutes === 0 ? 0 : (week.completedMinutes / totalMinutes) * 100;
        const scheduledShare =
          totalMinutes === 0 ? 0 : (week.scheduledMinutes / totalMinutes) * 100;
        const value = barValue(week);
        const title = week.tooltipLabel || axisLabel(week, index);

        return (
          <Tooltip key={week.start}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  'group flex min-w-0 flex-col items-center outline-none',
                  weeks.length > 8 ? 'w-9 shrink-0 sm:w-11' : 'flex-1',
                  weeks.length <= 4 && 'max-w-16 flex-1 sm:max-w-20',
                )}
                aria-label={`${title}: ${totalCount} agendamentos, ${formatCompactHours(totalMinutes)}`}
              >
                <div className="flex min-h-0 w-full flex-1 flex-col justify-end pt-1">
                  <div
                    className="flex w-full flex-col items-center"
                    style={{ height: `${height}%` }}
                  >
                    <span
                      className={cn(
                        'mb-1 text-[11px] font-semibold tabular-nums leading-none',
                        totalMinutes === 0
                          ? 'text-muted-foreground/50'
                          : 'text-foreground group-hover:text-[var(--admin-accent)]',
                      )}
                    >
                      {value}
                    </span>
                    <div
                      data-motion="bar"
                      className={cn(
                        'flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl transition-[filter]',
                        totalMinutes === 0 && 'bg-[var(--admin-track)]',
                        totalMinutes > 0 && 'group-hover:brightness-110',
                      )}
                    >
                      {totalMinutes > 0 ? (
                        <>
                          <div
                            className="admin-bar-striped min-h-0"
                            style={{ height: `${scheduledShare}%` }}
                          />
                          <div
                            className="min-h-0 bg-[var(--admin-accent)]"
                            style={{ height: `${completedShare}%` }}
                          />
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
                <span className="mt-2 max-w-full truncate text-center text-[10px] leading-tight text-muted-foreground">
                  {axisLabel(week, index)}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-56 px-3 py-2 text-left">
              <p className="font-medium">{title}</p>
              <p className="mt-1 text-[11px] opacity-80">
                {totalCount} {totalCount === 1 ? 'agendamento' : 'agendamentos'} ·{' '}
                {formatCompactHours(totalMinutes)}
              </p>
              <p className="mt-1 text-[11px] opacity-80">
                Concluídas {week.completedCount ?? 0} · {formatCompactHours(week.completedMinutes)}
              </p>
              <p className="text-[11px] opacity-80">
                Agendadas {week.scheduledCount ?? 0} · {formatCompactHours(week.scheduledMinutes)}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
