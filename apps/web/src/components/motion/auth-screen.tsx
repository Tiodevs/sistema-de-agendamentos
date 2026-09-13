'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { AdminThemeToggle } from '@/components/admin/theme-toggle';
import { gsap, useGSAP } from '@/lib/gsap';
import { useMotion } from '@/components/motion/motion-provider';

export function AuthScreen({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { introComplete } = useMotion();

  useEffect(() => {
    document.body.classList.add('admin-theme');
    return () => {
      document.body.classList.remove('admin-theme');
    };
  }, []);

  useGSAP(
    () => {
      if (!introComplete) return;
      const card = ref.current;
      if (!card) return;

      const mm = gsap.matchMedia();
      mm.add(
        {
          reduceMotion: '(prefers-reduced-motion: reduce)',
          motion: '(prefers-reduced-motion: no-preference)',
        },
        (context) => {
          const reduce = Boolean(context.conditions?.reduceMotion);
          gsap.fromTo(
            card,
            { y: reduce ? 0 : 28, autoAlpha: 0, scale: reduce ? 1 : 0.98 },
            {
              y: 0,
              autoAlpha: 1,
              scale: 1,
              duration: reduce ? 0.01 : 0.7,
              ease: 'power3.out',
              overwrite: 'auto',
              clearProps: 'transform',
            },
          );
        },
      );

      return () => mm.revert();
    },
    { scope: ref, dependencies: [introComplete], revertOnUpdate: true },
  );

  return (
    <div className="admin-theme admin-frame flex min-h-dvh items-center justify-center p-3 sm:p-4 lg:p-5">
      <div className="absolute right-3 top-3 sm:right-4 sm:top-4 lg:right-5 lg:top-5">
        <AdminThemeToggle />
      </div>
      <div
        ref={ref}
        className="admin-panel w-full max-w-md rounded-[28px] p-5 sm:rounded-[32px] sm:p-6"
      >
        {children}
      </div>
    </div>
  );
}
