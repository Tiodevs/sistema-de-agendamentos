'use client';

import { useRef } from 'react';
import { Check, Clock, Mail, Scissors } from 'lucide-react';
import { accentForProduct, iconForProduct } from '@/lib/admin-accents';
import { formatCurrency, formatDuration, getInitials } from '@/lib/format';
import { gsap, useGSAP, ScrollTrigger } from '@/lib/gsap';
import { useMotion } from '@/components/motion/motion-provider';
import { cn } from '@/lib/utils';

const STEP_LABELS = ['Serviço', 'Profissional', 'Horário'];

const DEMO_SERVICES = [
  { name: 'Corte masculino', duration: 45, price: 80 },
  { name: 'Hidratação', duration: 60, price: 90 },
];

const DEMO_PROFESSIONALS = [
  { name: 'Rafael Souza', role: 'Corte e barba' },
  { name: 'Marina Costa', role: 'Corte e hidratação' },
];

const DEMO_SLOTS = ['13:00', '13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45'];

const DEMO_DAYS = [
  { label: 'Seg', day: '15' },
  { label: 'Ter', day: '16' },
  { label: 'Qua', day: '17' },
  { label: 'Qui', day: '18' },
];

export function MockWindow({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('landing-mock-window', className)}>
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
        <span className="size-2 rounded-full bg-white/12" />
        <span className="size-2 rounded-full bg-white/12" />
        <span className="size-2 rounded-full bg-[var(--admin-accent)]/70" />
        <span className="ml-2 truncate text-xs text-muted-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}

function railState(step: number, active: number) {
  if (step < active) return 'done';
  return step === active ? 'current' : 'todo';
}

export function StepRail({ active, className }: { active: 1 | 2 | 3 | 4; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {STEP_LABELS.map((label, index) => {
        const step = index + 1;
        const last = index === STEP_LABELS.length - 1;

        return (
          <div
            key={label}
            data-rail-step={step}
            data-state={railState(step, active)}
            className={cn('landing-rail-step flex items-center gap-2', !last && 'min-w-0 flex-1')}
          >
            <span className="landing-rail-badge flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-medium">
              <span className="landing-rail-number">{step}</span>
              <Check className="landing-rail-check size-3.5" />
            </span>
            <span className="landing-rail-label hidden text-[11px] font-medium sm:inline">
              {label}
            </span>
            {last ? null : (
              <span className="relative h-px min-w-3 flex-1 overflow-hidden bg-white/10">
                <span className="landing-rail-line absolute inset-0 bg-primary/70" />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PickedBadge() {
  return (
    <span
      data-demo-pop
      className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-[var(--admin-accent)] text-[var(--admin-accent-foreground)]"
    >
      <Check className="size-3.5" />
    </span>
  );
}

export function ServicePanel() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Qual serviço você deseja?</p>
      <div className="grid grid-cols-2 gap-2">
        {DEMO_SERVICES.map((service, index) => {
          const accent = accentForProduct(service.name);
          const Icon = iconForProduct(service.name);
          const picked = index === 0;

          return (
            <div
              key={service.name}
              className={cn(
                'relative rounded-[1.35rem] bg-[var(--admin-card-muted)] p-3',
                picked && 'ring-2 ring-[var(--admin-accent)]',
              )}
            >
              {picked ? <PickedBadge /> : null}
              <div
                className={cn(
                  'mb-4 flex size-10 items-center justify-center rounded-2xl',
                  accent.bg,
                )}
              >
                <Icon className={cn('size-5', accent.fg)} />
              </div>
              <p className="truncate text-sm font-semibold">{service.name}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatDuration(service.duration)} · {formatCurrency(service.price)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProfessionalPanel() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Quem vai te atender?</p>
      <div className="space-y-2">
        {DEMO_PROFESSIONALS.map((professional, index) => {
          const picked = index === 0;

          return (
            <div
              key={professional.name}
              className={cn(
                'relative flex items-center gap-3 rounded-[1.35rem] bg-[var(--admin-card-muted)] p-3',
                picked && 'ring-2 ring-[var(--admin-accent)]',
              )}
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--admin-chip)] text-xs font-semibold">
                {getInitials(professional.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{professional.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{professional.role}</p>
              </div>
              {picked ? <PickedBadge /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SlotPanel() {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {DEMO_DAYS.map((item, index) => (
          <span
            key={item.day}
            className={cn(
              'flex flex-1 flex-col items-center rounded-2xl py-1.5 text-[11px]',
              index === 1
                ? 'bg-primary text-primary-foreground'
                : 'bg-[var(--admin-card-muted)] text-muted-foreground',
            )}
          >
            {item.label}
            <span className="text-sm font-semibold">{item.day}</span>
          </span>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">8 horários disponíveis</p>
      <div className="grid grid-cols-4 gap-2">
        {DEMO_SLOTS.map((slot) => {
          const picked = slot === '14:30';

          return (
            <span
              key={slot}
              data-demo-pop={picked ? '' : undefined}
              className={cn(
                'rounded-2xl px-1 py-2 text-center text-xs font-semibold',
                picked
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-[var(--admin-card-muted)] text-foreground/80',
              )}
            >
              {slot}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function ConfirmedPanel() {
  return (
    <div className="space-y-3">
      <div className="rounded-[1.35rem] bg-black p-4 text-white">
        <div className="flex items-center gap-3">
          <span
            data-demo-pop
            className="flex size-10 items-center justify-center rounded-2xl bg-[var(--admin-accent)] text-[var(--admin-accent-foreground)]"
          >
            <Check className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Horário confirmado</p>
            <p className="text-[11px] text-white/55">Ter 16 set · 14:30</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-white/8">
            <Scissors className="size-4 text-white/80" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Corte masculino</p>
            <p className="truncate text-[11px] text-white/45">Rafael Souza · R$ 80,00</p>
          </div>
        </div>
      </div>
      <div
        data-demo-pop
        className="flex items-center gap-2 rounded-2xl bg-[var(--admin-card-muted)] px-3 py-2 text-[11px] text-muted-foreground"
      >
        <Mail className="size-3.5 text-[var(--admin-accent)]" />
        Confirmação enviada para você e para o profissional
      </div>
    </div>
  );
}

const DEMO_PANELS = [ServicePanel, ProfessionalPanel, SlotPanel, ConfirmedPanel];

export function BookingDemo({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { introComplete } = useMotion();

  useGSAP(
    () => {
      if (!introComplete) return;
      const root = ref.current;
      if (!root) return;

      const panels = gsap.utils.toArray<HTMLElement>('[data-demo-panel]', root);
      if (panels.length < 2) return;

      const railSteps = gsap.utils.toArray<HTMLElement>('[data-rail-step]', root);
      const setRail = (active: number) => {
        railSteps.forEach((element) => {
          element.dataset.state = railState(Number(element.dataset.railStep), active);
        });
      };

      const mm = gsap.matchMedia();
      mm.add(
        {
          reduceMotion: '(prefers-reduced-motion: reduce)',
          motion: '(prefers-reduced-motion: no-preference)',
        },
        (context) => {
          if (context.conditions?.reduceMotion) {
            gsap.set(panels[0], { autoAlpha: 1, y: 0 });
            gsap.set(panels.slice(1), { autoAlpha: 0 });
            return;
          }

          gsap.set(panels[0], { autoAlpha: 1, y: 0 });
          gsap.set(panels.slice(1), { autoAlpha: 0, y: 20 });

          const timeline = gsap.timeline({ repeat: -1, paused: true });

          panels.forEach((panel, index) => {
            const nextIndex = (index + 1) % panels.length;
            const next = panels[nextIndex];
            const hold = index === panels.length - 1 ? 2.4 : 1.9;

            timeline
              .to(panel, { autoAlpha: 0, y: -20, duration: 0.4, ease: 'power2.in' }, `+=${hold}`)
              .call(() => setRail(nextIndex + 1))
              .fromTo(
                next,
                { autoAlpha: 0, y: 20 },
                { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out', immediateRender: false },
                '>-0.1',
              )
              .fromTo(
                next.querySelectorAll('[data-demo-pop]'),
                { scale: 0.85, autoAlpha: 0 },
                {
                  scale: 1,
                  autoAlpha: 1,
                  duration: 0.4,
                  stagger: 0.08,
                  ease: 'back.out(2)',
                  immediateRender: false,
                },
                '<0.2',
              );
          });

          const trigger = ScrollTrigger.create({
            trigger: root,
            start: 'top bottom',
            end: 'bottom top',
            onToggle: (self) => {
              if (self.isActive) timeline.play();
              else timeline.pause();
            },
          });

          if (trigger.isActive) timeline.play();

          return () => timeline.kill();
        },
      );

      return () => mm.revert();
    },
    { scope: ref, dependencies: [introComplete], revertOnUpdate: true },
  );

  return (
    <div ref={ref} className={cn('landing-mock-window', className)} aria-hidden="true">
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
        <span className="size-2 rounded-full bg-white/12" />
        <span className="size-2 rounded-full bg-white/12" />
        <span className="size-2 rounded-full bg-[var(--admin-accent)]/70" />
        <span className="ml-2 truncate text-xs text-muted-foreground">Novo agendamento</span>
        <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
          <Clock className="size-3.5" />
          leva menos de 1 minuto
        </span>
      </div>
      <div className="px-4 pt-4">
        <StepRail active={1} />
      </div>
      <div className="relative h-[13.5rem]">
        {DEMO_PANELS.map((Panel, index) => (
          <div
            key={index}
            data-demo-panel
            className={cn('absolute inset-0 px-4 pb-4 pt-3', index > 0 && 'invisible opacity-0')}
          >
            <Panel />
          </div>
        ))}
      </div>
    </div>
  );
}
