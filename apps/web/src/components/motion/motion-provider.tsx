'use client';

import {
  createContext,
  Suspense,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import dynamic from 'next/dynamic';
import { gsap, useGSAP } from '@/lib/gsap';
import { INTRO_STORAGE_KEY, INTRO_DURATION_MS, clearIntroPlaceholder } from '@/lib/intro-script';

const LeemiaIntro = dynamic(
  () => import('@/components/motion/leemia-intro').then((mod) => mod.LeemiaIntro),
  { ssr: false },
);

const INTRO_KEY = INTRO_STORAGE_KEY;

type MotionContextValue = {
  introComplete: boolean;
};

const MotionContext = createContext<MotionContextValue>({ introComplete: true });

export function useMotion() {
  return useContext(MotionContext);
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function shouldForceIntro() {
  return new URLSearchParams(window.location.search).get('intro') === '1';
}

function hasSeenIntro() {
  try {
    return sessionStorage.getItem(INTRO_KEY) === '1';
  } catch {
    return false;
  }
}

function markIntroSeen() {
  try {
    sessionStorage.setItem(INTRO_KEY, '1');
  } catch {
    // Private mode can block sessionStorage.
  }
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const [introComplete, setIntroComplete] = useState(false);
  const [playIntro, setPlayIntro] = useState(false);

  useLayoutEffect(() => {
    const previousOverflow = document.body.style.overflow;

    if (shouldForceIntro() || (!prefersReducedMotion() && !hasSeenIntro())) {
      document.body.style.overflow = 'hidden';
      setPlayIntro(true);
      return () => {
        document.body.style.overflow = previousOverflow;
        clearIntroPlaceholder();
      };
    }

    clearIntroPlaceholder();
    setIntroComplete(true);
    return undefined;
  }, []);

  useLayoutEffect(() => {
    if (!playIntro) return undefined;
    const timeout = window.setTimeout(() => {
      markIntroSeen();
      clearIntroPlaceholder();
      document.body.style.overflow = '';
      setIntroComplete(true);
      setPlayIntro(false);
    }, INTRO_DURATION_MS + 1500);
    return () => window.clearTimeout(timeout);
  }, [playIntro]);

  useGSAP((_, contextSafe) => {
    if (!contextSafe) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const enter = contextSafe((event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest('[data-motion="lift"]');
      if (!(target instanceof HTMLElement)) return;
      const related = event.relatedTarget;
      if (related instanceof Node && target.contains(related)) return;
      gsap.to(target, { y: -5, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
    });

    const leave = contextSafe((event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest('[data-motion="lift"]');
      if (!(target instanceof HTMLElement)) return;
      const related = event.relatedTarget;
      if (related instanceof Node && target.contains(related)) return;
      gsap.to(target, { y: 0, duration: 0.4, ease: 'power2.out', overwrite: 'auto' });
    });

    document.addEventListener('pointerover', enter);
    document.addEventListener('pointerout', leave);

    return () => {
      document.removeEventListener('pointerover', enter);
      document.removeEventListener('pointerout', leave);
    };
  }, []);

  const value = useMemo(() => ({ introComplete }), [introComplete]);

  return (
    <MotionContext.Provider value={value}>
      {playIntro ? (
        <Suspense fallback={null}>
          <LeemiaIntro
            onReveal={() => {
              markIntroSeen();
              clearIntroPlaceholder();
              document.body.style.overflow = '';
              setIntroComplete(true);
            }}
            onComplete={() => setPlayIntro(false)}
          />
        </Suspense>
      ) : null}
      {children}
    </MotionContext.Provider>
  );
}
