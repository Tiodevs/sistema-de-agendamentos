'use client';

import {
  createContext,
  Suspense,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import dynamic from 'next/dynamic';
import { gsap, useGSAP } from '@/lib/gsap';
import {
  INTRO_DURATION_MS,
  clearIntroPlaceholder,
  markIntroSeen,
  shouldPlayIntroNow,
} from '@/lib/intro-script';

const LeemiaIntro = dynamic(
  () => import('@/components/motion/leemia-intro').then((mod) => mod.LeemiaIntro),
  { ssr: false },
);

type MotionContextValue = {
  introComplete: boolean;
};

const MotionContext = createContext<MotionContextValue>({ introComplete: true });

export function useMotion() {
  return useContext(MotionContext);
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const [introComplete, setIntroComplete] = useState(false);
  const [playIntro, setPlayIntro] = useState(false);
  // Decidida uma vez por carregamento da página (o StrictMode do dev roda o efeito duas vezes).
  // O provider fica no layout raiz: navegar dentro do app nunca dispara a abertura.
  const introDecisionRef = useRef<boolean | null>(null);

  useLayoutEffect(() => {
    if (introDecisionRef.current === null) {
      introDecisionRef.current = shouldPlayIntroNow();
      // Marca já no começo: fechar a aba no meio não faz a abertura voltar.
      if (introDecisionRef.current) markIntroSeen();
    }

    if (!introDecisionRef.current) {
      clearIntroPlaceholder();
      setIntroComplete(true);
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setPlayIntro(true);
    return () => {
      document.body.style.overflow = previousOverflow;
      clearIntroPlaceholder();
    };
  }, []);

  useLayoutEffect(() => {
    if (!playIntro) return undefined;
    const timeout = window.setTimeout(() => {
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
