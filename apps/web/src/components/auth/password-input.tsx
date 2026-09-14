'use client';

import { useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Input } from '@/components/ui/input';
import { gsap, useGSAP } from '@/lib/gsap';
import { cn } from '@/lib/utils';

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, 'type'>;

export function PasswordInput({ className, disabled, id, ...props }: PasswordInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<(() => void) | null>(null);
  const visibleRef = useRef(false);
  const disabledRef = useRef(disabled);
  const [visible, setVisible] = useState(false);
  disabledRef.current = disabled;

  useGSAP(
    (_, contextSafe) => {
      const root = rootRef.current;
      const input = inputRef.current;
      const button = root?.querySelector('button');
      if (!root || !contextSafe) return;

      const icon = root.querySelector<SVGSVGElement>('[data-eye-icon]');
      const lid = root.querySelector<SVGGElement>('[data-eye-lid]');
      const pupil = root.querySelector<SVGCircleElement>('[data-eye-pupil]');
      const slash = root.querySelector<SVGLineElement>('[data-eye-slash]');
      if (!icon || !lid || !pupil || !slash) return;

      gsap.set(slash, { drawSVG: 0, autoAlpha: 1 });
      gsap.set([icon, lid, pupil], { transformOrigin: '50% 50%' });
      gsap.set([lid, pupil], { svgOrigin: '12 12' });

      let busy = false;
      let timeline: gsap.core.Timeline | null = null;

      const restoreCaret = () => {
        const field = inputRef.current;
        if (!field || disabledRef.current) return;
        const start = field.selectionStart;
        const end = field.selectionEnd;
        field.focus({ preventScroll: true });
        if (start != null && end != null) {
          field.setSelectionRange(start, end);
        }
      };

      const applyVisibility = (show: boolean) => {
        flushSync(() => setVisible(show));
        restoreCaret();
      };

      const hoverIn = contextSafe(() => {
        if (busy || disabledRef.current) return;
        gsap.to(icon, { scale: 1.14, duration: 0.22, ease: 'power2.out', overwrite: 'auto' });
      });

      const hoverOut = contextSafe(() => {
        if (busy || disabledRef.current) return;
        gsap.to(icon, { scale: 1, duration: 0.28, ease: 'power2.out', overwrite: 'auto' });
      });

      toggleRef.current = contextSafe(() => {
        if (disabledRef.current || busy) return;

        const show = !visibleRef.current;
        visibleRef.current = show;
        busy = true;
        timeline?.kill();

        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) {
          gsap.set(slash, { drawSVG: show ? '0% 100%' : 0 });
          gsap.set([icon, lid, pupil], { scale: 1, scaleY: 1, rotation: 0 });
          if (input) gsap.set(input, { clearProps: 'filter' });
          applyVisibility(show);
          busy = false;
          return;
        }

        timeline = gsap.timeline({
          defaults: { overwrite: 'auto' },
          onComplete: () => {
            busy = false;
            if (input) gsap.set(input, { clearProps: 'filter' });
          },
        });

        timeline
          .to(
            icon,
            { scale: 0.84, rotation: show ? -10 : 10, duration: 0.16, ease: 'power2.in' },
            0,
          )
          .to(lid, { scaleY: 0.12, duration: 0.14, ease: 'power2.in' }, 0)
          .to(pupil, { scale: 0.2, duration: 0.14, ease: 'power2.in' }, 0)
          .to(
            slash,
            {
              drawSVG: show ? '0% 100%' : 0,
              duration: 0.28,
              ease: 'power3.inOut',
            },
            0.04,
          )
          .add(() => applyVisibility(show))
          .to(lid, { scaleY: 1, duration: 0.32, ease: 'back.out(2.4)' })
          .to(pupil, { scale: show ? 0.85 : 1, duration: 0.34, ease: 'back.out(2.6)' }, '<0.02')
          .to(icon, { scale: 1, rotation: 0, duration: 0.42, ease: 'back.out(1.8)' }, '<');

        if (input) {
          timeline.fromTo(
            input,
            { filter: 'blur(5px)' },
            { filter: 'blur(0px)', duration: 0.32, ease: 'power2.out' },
            0.16,
          );
        }
      });

      button?.addEventListener('pointerenter', hoverIn);
      button?.addEventListener('pointerleave', hoverOut);

      return () => {
        timeline?.kill();
        toggleRef.current = null;
        button?.removeEventListener('pointerenter', hoverIn);
        button?.removeEventListener('pointerleave', hoverOut);
      };
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="relative">
      <Input
        {...props}
        ref={inputRef}
        id={inputId}
        type={visible ? 'text' : 'password'}
        disabled={disabled}
        className={cn('pr-11', className)}
        spellCheck={visible ? false : undefined}
      />
      <button
        type="button"
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        aria-controls={inputId}
        disabled={disabled}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
        onClick={() => toggleRef.current?.()}
      >
        <svg
          data-eye-icon
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="size-5 origin-center overflow-visible will-change-transform"
        >
          <g data-eye-lid>
            <path
              d="M2.5 12s3.6-6.5 9.5-6.5S21.5 12 21.5 12 17.9 18.5 12 18.5 2.5 12 2.5 12Z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              data-eye-pupil
              cx="12"
              cy="12"
              r="2.65"
              fill="currentColor"
              className="origin-center"
            />
          </g>
          <line
            data-eye-slash
            x1="4.2"
            y1="4.2"
            x2="19.8"
            y2="19.8"
            stroke="currentColor"
            strokeWidth="1.85"
            strokeLinecap="round"
            className="opacity-0"
          />
        </svg>
      </button>
    </div>
  );
}
