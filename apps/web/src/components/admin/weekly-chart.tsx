'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { gsap, useGSAP } from '@/lib/gsap';
import { useMotion } from '@/components/motion/motion-provider';

export type WeeklyBar = {
  start: string;
  completedMinutes: number;
  scheduledMinutes: number;
};

export function WeeklyChart({ weeks }: { weeks: WeeklyBar[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { introComplete } = useMotion();
  const max = Math.max(1, ...weeks.map((week) => week.completedMinutes + week.scheduledMinutes));

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
    { scope: ref, dependencies: [introComplete, weeks.length], revertOnUpdate: true },
  );

  if (weeks.length === 0) {
    return (
      <div ref={ref} className="flex h-44 items-end gap-3">
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
    <div ref={ref} className="flex h-44 items-end gap-2.5 sm:gap-3.5">
      {weeks.map((week) => {
        const total = week.completedMinutes + week.scheduledMinutes;
        const height = total === 0 ? 14 : Math.max(18, (total / max) * 100);
        const completedShare = total === 0 ? 0 : (week.completedMinutes / total) * 100;
        const scheduledShare = total === 0 ? 0 : (week.scheduledMinutes / total) * 100;

        return (
          <div
            key={week.start}
            data-motion="bar"
            className="flex min-w-0 flex-1 flex-col justify-end"
            style={{ height: `${height}%` }}
            title={`${Math.round(total / 60)}h na semana`}
          >
            <div
              className={cn(
                'flex h-full flex-col overflow-hidden rounded-2xl',
                total === 0 && 'bg-[var(--admin-track)]',
              )}
            >
              {total > 0 ? (
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
        );
      })}
    </div>
  );
}
