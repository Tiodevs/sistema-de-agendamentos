'use client';

import { useRef, type ReactNode } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';
import { useMotion } from '@/components/motion/motion-provider';
import { cn } from '@/lib/utils';

export function StaggerIn({
  children,
  className,
  delay = 0,
  y = 22,
  selector,
  replayKey,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  selector?: string;
  replayKey?: string | number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { introComplete } = useMotion();

  useGSAP(
    () => {
      if (!introComplete) return;
      const root = ref.current;
      if (!root) return;

      const items = selector ? root.querySelectorAll(selector) : root.children;
      if (!items.length) return;

      const mm = gsap.matchMedia();
      mm.add(
        {
          reduceMotion: '(prefers-reduced-motion: reduce)',
          motion: '(prefers-reduced-motion: no-preference)',
        },
        (context) => {
          const reduce = Boolean(context.conditions?.reduceMotion);
          if (reduce) {
            gsap.set(items, { y: 0, autoAlpha: 1 });
            return;
          }

          gsap.fromTo(
            items,
            { y, autoAlpha: 0 },
            {
              y: 0,
              autoAlpha: 1,
              duration: 0.55,
              stagger: 0.07,
              delay,
              ease: 'power3.out',
              overwrite: 'auto',
            },
          );
        },
      );

      return () => mm.revert();
    },
    { scope: ref, dependencies: [introComplete, replayKey], revertOnUpdate: true },
  );

  return (
    <div ref={ref} className={cn(className)}>
      {children}
    </div>
  );
}
