'use client';

import { useRef } from 'react';
import { BRAND_NAME } from '@/components/logo';
import { LeemiaMark } from '@/components/brand/leemia-mark';
import { gsap, useGSAP } from '@/lib/gsap';
import { SplitText } from 'gsap/SplitText';
import { INTRO_DURATION_MS } from '@/lib/intro-script';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(SplitText);
}

interface LeemiaIntroProps {
  onReveal: () => void;
  onComplete: () => void;
}

export function LeemiaIntro({ onReveal, onComplete }: LeemiaIntroProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    (_context, contextSafe) => {
      if (!contextSafe) return;
      const root = rootRef.current;
      if (!root) return;

      const mark = root.querySelector('.intro-mark');
      const glow = root.querySelector('.intro-glow');
      const fill = root.querySelectorAll('.leemia-fill');
      const waves = root.querySelectorAll('.leemia-wave');
      const frame = root.querySelectorAll('.leemia-frame');
      const wordmark = root.querySelector('.intro-wordmark');
      const tagline = root.querySelector('.intro-tagline');
      const splitLine = root.querySelector('.intro-split-line');
      const topPanel = root.querySelector('.intro-panel-top');
      const bottomPanel = root.querySelector('.intro-panel-bottom');
      const brand = root.querySelector('.intro-brand');
      const skip = root.querySelector('.intro-skip');
      const bar = root.querySelector('.intro-bar');
      const percent = root.querySelector('.intro-percent');

      if (
        !mark ||
        !glow ||
        !wordmark ||
        !tagline ||
        !splitLine ||
        !topPanel ||
        !bottomPanel ||
        !brand ||
        !skip ||
        !bar ||
        !percent
      ) {
        onReveal();
        onComplete();
        return;
      }

      let revealed = false;
      let finished = false;
      let split: InstanceType<typeof SplitText> | null = null;
      const progress = { value: 0 };
      const exitStart = 3.2;
      const total = INTRO_DURATION_MS / 1000;

      const reveal = contextSafe(() => {
        if (revealed) return;
        revealed = true;
        onReveal();
      });

      const finish = contextSafe(() => {
        if (finished) return;
        finished = true;
        reveal();
        onComplete();
      });

      const safety = window.setTimeout(finish, INTRO_DURATION_MS + 800);

      try {
        split = SplitText.create(wordmark, {
          type: 'chars',
          aria: 'auto',
          tag: 'span',
          charsClass: 'intro-char',
        });
      } catch {
        window.clearTimeout(safety);
        finish();
        return;
      }

      gsap.set(fill, { autoAlpha: 0 });
      gsap.set([waves, frame, splitLine], { drawSVG: 0 });
      gsap.set(mark, { scale: 0.84, autoAlpha: 0, transformOrigin: '50% 50%' });
      gsap.set(glow, { scale: 0.6, autoAlpha: 0, transformOrigin: '50% 50%' });
      gsap.set(split.chars, { y: 18, autoAlpha: 0 });
      gsap.set(tagline, { y: 10, autoAlpha: 0 });
      gsap.set(skip, { autoAlpha: 0 });
      gsap.set(bar, { scaleX: 0, transformOrigin: '0% 50%' });

      const tl = gsap.timeline({
        defaults: { ease: 'power3.out' },
        onComplete: finish,
      });

      tl.to(skip, { autoAlpha: 1, duration: 0.35 }, 0.35)
        .to(glow, { autoAlpha: 0.7, scale: 1, duration: 0.7, ease: 'power2.out' }, 0)
        .to(mark, { autoAlpha: 1, scale: 1, duration: 0.55 }, 0.05)
        .to(fill, { autoAlpha: 1, duration: 0.4 }, 0.12)
        .fromTo(
          waves,
          { drawSVG: '0% 0%' },
          { drawSVG: '0% 100%', duration: 0.9, stagger: 0.12, ease: 'power2.inOut' },
          0.18,
        )
        .fromTo(
          frame,
          { drawSVG: '0% 0%' },
          { drawSVG: '0% 100%', duration: 0.75, ease: 'power2.inOut' },
          0.38,
        )
        .to(split.chars, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.045 }, 0.85)
        .to(tagline, { y: 0, autoAlpha: 1, duration: 0.4 }, 1.05)
        .to(bar, { scaleX: 1, duration: exitStart, ease: 'power1.inOut' }, 0)
        .to(
          progress,
          {
            value: 100,
            duration: exitStart,
            ease: 'power1.inOut',
            onUpdate: () => {
              percent.textContent = `${Math.round(progress.value)}%`;
            },
          },
          0,
        )
        .fromTo(
          splitLine,
          { drawSVG: '0% 0%' },
          { drawSVG: '0% 100%', duration: 0.55, ease: 'power2.inOut' },
          2.45,
        )
        .to(glow, { scale: 1.18, autoAlpha: 0.35, duration: 0.45 }, 2.7)
        .add(reveal, exitStart)
        .to(brand, { autoAlpha: 0, scale: 0.92, duration: 0.4, ease: 'power2.in' }, exitStart)
        .to(splitLine, { autoAlpha: 0, duration: 0.25 }, exitStart + 0.05)
        .to(topPanel, { yPercent: -100, duration: 0.8, ease: 'power4.inOut' }, exitStart)
        .to(bottomPanel, { yPercent: 100, duration: 0.8, ease: 'power4.inOut' }, exitStart);

      if (tl.duration() < total) {
        tl.to({}, { duration: total - tl.duration() });
      }

      const skipIntro = contextSafe(() => {
        reveal();
        tl.timeScale(4);
      });

      skip.addEventListener('click', skipIntro);

      const onKey = contextSafe((event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          skipIntro();
        }
      });
      window.addEventListener('keydown', onKey);

      return () => {
        window.clearTimeout(safety);
        skip.removeEventListener('click', skipIntro);
        window.removeEventListener('keydown', onKey);
        split?.revert();
      };
    },
    { scope: rootRef },
  );

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[200] overflow-hidden"
      role="dialog"
      aria-label="Abertura Leemia"
      aria-modal="true"
    >
      <div className="intro-panel-top absolute inset-x-0 top-0 h-1/2 bg-[#05070A]" />
      <div className="intro-panel-bottom absolute inset-x-0 bottom-0 h-1/2 bg-[#05070A]" />

      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          className="intro-split-line"
          d="M0 50 C 18 46, 32 54, 50 50 S 82 46, 100 50"
          fill="none"
          stroke="#34C3DD"
          strokeWidth="0.35"
          strokeLinecap="round"
        />
      </svg>

      <div className="intro-brand pointer-events-none relative z-10 flex h-full flex-col items-center justify-center">
        <div className="relative flex flex-col items-center">
          <div
            className="intro-glow absolute left-1/2 top-[42%] size-52 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgb(52 195 221 / 0.28) 0%, transparent 68%)',
            }}
          />
          <div className="intro-mark relative">
            <LeemiaMark size={132} />
          </div>
          <h1 className="intro-wordmark mt-7 text-4xl font-semibold tracking-tight text-white [&_div]:inline-block [&_span]:inline-block sm:text-5xl">
            {BRAND_NAME}
          </h1>
          <p className="intro-tagline mt-2 text-sm tracking-[0.22em] text-[#34C3DD]/80 uppercase">
            Agendamentos
          </p>
          <div className="intro-progress mt-10 w-52">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="intro-bar h-full w-full rounded-full bg-[#34C3DD]" />
            </div>
            <p className="mt-2 text-center text-xs text-white/50">
              Carregando <span className="intro-percent tabular-nums">0%</span>
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="intro-skip absolute bottom-6 right-6 z-20 rounded-full px-4 py-2 text-sm text-white/55 transition-colors hover:text-white"
      >
        Pular
      </button>
    </div>
  );
}
