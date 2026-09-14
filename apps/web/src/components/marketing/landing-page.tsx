'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  CalendarOff,
  Clock,
  Mail,
  Menu,
  Plus,
  ShieldCheck,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { LogoWithText } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { accentForProduct, iconForProduct } from '@/lib/admin-accents';
import { formatCurrency, formatDuration } from '@/lib/format';
import { gsap, useGSAP, ScrollTrigger } from '@/lib/gsap';
import { useMotion } from '@/components/motion/motion-provider';
import { cn } from '@/lib/utils';
import { RegisterCta } from '@/components/marketing/register-cta';
import {
  BookingDemo,
  MockWindow,
  ProfessionalPanel,
  ServicePanel,
  SlotPanel,
  StepRail,
} from '@/components/marketing/landing-mockups';
import '@/styles/landing.css';

const NAV = [
  { id: 'vantagens', label: 'Vantagens' },
  { id: 'fluxo', label: 'Como funciona' },
  { id: 'servicos', label: 'Serviços' },
];

const SERVICES = [
  { name: 'Corte masculino', duration: 45, price: 80 },
  { name: 'Barba', duration: 30, price: 50 },
  { name: 'Corte + barba', duration: 75, price: 120 },
  { name: 'Hidratação', duration: 60, price: 90 },
  { name: 'Design de sobrancelha', duration: 20, price: 40 },
  { name: 'Relaxamento capilar', duration: 50, price: 110 },
];

const BENEFITS: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: CalendarCheck,
    title: 'Reserva em três passos',
    text: 'Serviço, profissional e horário. Sem ligação e sem espera na recepção.',
  },
  {
    icon: Clock,
    title: 'Grade a cada 15 minutos',
    text: 'Você vê apenas o que ainda está livre, no horário de São Paulo.',
  },
  {
    icon: ShieldCheck,
    title: 'Horário protegido',
    text: 'Dois clientes nunca ficam no mesmo profissional, no mesmo intervalo.',
  },
  {
    icon: UserRound,
    title: 'Você escolhe quem atende',
    text: 'A lista mostra só os profissionais que realizam o serviço escolhido.',
  },
  {
    icon: Mail,
    title: 'Confirmação por e-mail',
    text: 'Ao marcar ou cancelar, você e o profissional recebem o aviso na hora.',
  },
  {
    icon: CalendarOff,
    title: 'Folgas e feriados visíveis',
    text: 'Domingo, feriado e expediente especial já aparecem fechados no calendário.',
  },
];

const FLOW = [
  {
    title: 'Escolha o serviço',
    text: 'Cada card mostra preço e duração antes de você decidir. Nada de orçamento por telefone.',
  },
  {
    title: 'Escolha o profissional',
    text: 'Aparecem apenas os profissionais que realizam aquele serviço no estúdio.',
  },
  {
    title: 'Confirme o horário',
    text: 'A grade abre nos horários livres do dia. Você reserva e recebe a confirmação.',
  },
];

const FAQS = [
  {
    q: 'Preciso pagar pelo site?',
    a: 'Não. O Leemia organiza o horário. O pagamento continua no estúdio, no dia do atendimento.',
  },
  {
    q: 'Posso cancelar sozinho?',
    a: 'Sim. Em "Meus horários" você cancela um agendamento futuro que ainda esteja marcado ou confirmado, e o aviso é enviado automaticamente.',
  },
  {
    q: 'Qual é o expediente?',
    a: 'Segunda a sexta das 8h às 18h e sábado até 12h. Domingo fecha, além dos feriados cadastrados pelo estúdio.',
  },
  {
    q: 'Consigo repetir o último serviço?',
    a: 'Sim. A sua home mostra o último atendimento e o serviço que você mais pede, com atalho para marcar de novo.',
  },
];

const FLOW_PANELS = [ServicePanel, ProfessionalPanel, SlotPanel];

function RevealWords({ text }: { text: string }) {
  return (
    <>
      {text.split(' ').map((word, index) => (
        <span key={`${word}-${index}`} className="landing-word-mask">
          <span data-hero="word" className="inline-block">
            {word}
          </span>
          {index < text.split(' ').length - 1 ? '\u00A0' : null}
        </span>
      ))}
    </>
  );
}

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { introComplete } = useMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add('admin-theme');
    const html = document.documentElement;
    const previousScroll = html.style.scrollBehavior;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      html.style.scrollBehavior = 'smooth';
    }
    return () => {
      document.body.classList.remove('admin-theme');
      html.style.scrollBehavior = previousScroll;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  useGSAP(
    () => {
      if (!introComplete) return;
      const root = rootRef.current;
      if (!root) return;

      const reveals = gsap.utils.toArray<HTMLElement>('[data-landing="reveal"]', root);
      const flowSteps = gsap.utils.toArray<HTMLElement>('[data-flow-step]', root);
      const flowVisuals = gsap.utils.toArray<HTMLElement>('[data-flow-visual]', root);

      const mm = gsap.matchMedia();
      mm.add(
        {
          reduceMotion: '(prefers-reduced-motion: reduce)',
          motion: '(prefers-reduced-motion: no-preference)',
        },
        (context) => {
          const reduce = Boolean(context.conditions?.reduceMotion);

          const heroWords = gsap.utils.toArray<HTMLElement>('[data-hero="word"]', root);
          const heroItems = gsap.utils.toArray<HTMLElement>('[data-hero="item"]', root);
          const heroDemo = root.querySelector('[data-hero="demo"]');
          const heroBar = root.querySelector('[data-hero="bar"]');
          const floats = gsap.utils.toArray<HTMLElement>('[data-hero="float"]', root);
          const progress = root.querySelector('[data-landing="progress"]');

          gsap.set(flowVisuals[0], { autoAlpha: 1 });
          gsap.set(flowVisuals.slice(1), { autoAlpha: 0 });
          flowSteps[0]?.classList.add('is-active');

          if (reduce) {
            gsap.set([heroBar, heroWords, heroItems, heroDemo, floats, reveals], {
              y: 0,
              yPercent: 0,
              autoAlpha: 1,
              scale: 1,
            });
            return;
          }

          gsap.set(reveals, { y: 34, autoAlpha: 0 });

          const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
          if (heroBar) {
            intro.fromTo(heroBar, { y: -18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6 });
          }
          intro
            .fromTo(
              heroWords,
              { yPercent: 115 },
              { yPercent: 0, duration: 0.9, stagger: 0.06, ease: 'power4.out' },
              '-=0.3',
            )
            .fromTo(
              heroItems,
              { y: 24, autoAlpha: 0 },
              { y: 0, autoAlpha: 1, duration: 0.65, stagger: 0.09 },
              '-=0.55',
            );

          if (heroDemo) {
            intro.fromTo(
              heroDemo,
              { y: 48, autoAlpha: 0, scale: 0.97 },
              { y: 0, autoAlpha: 1, scale: 1, duration: 0.95 },
              '-=0.5',
            );
          }

          if (floats.length) {
            intro.fromTo(
              floats,
              { autoAlpha: 0, x: (index) => (index === 0 ? -24 : 24) },
              { autoAlpha: 1, x: 0, duration: 0.7, stagger: 0.12 },
              '-=0.45',
            );
            floats.forEach((float, index) => {
              gsap.to(float, {
                y: index === 0 ? -12 : 12,
                duration: 3 + index * 0.4,
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut',
                delay: 1.2,
              });
            });
          }

          ScrollTrigger.batch(reveals, {
            start: 'top 88%',
            once: true,
            onEnter: (batch) => {
              gsap.to(batch, {
                y: 0,
                autoAlpha: 1,
                duration: 0.7,
                stagger: 0.08,
                overwrite: true,
              });
            },
          });

          if (progress) {
            gsap.to(progress, {
              scaleX: 1,
              ease: 'none',
              scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: 0.3 },
            });
          }
        },
      );

      const sectionTriggers = NAV.map(({ id }) => {
        const section = document.getElementById(id);
        if (!section) return null;
        return ScrollTrigger.create({
          trigger: section,
          start: 'top 45%',
          end: 'bottom 45%',
          onToggle: (self) => {
            if (self.isActive) setActiveSection(id);
            else setActiveSection((current) => (current === id ? null : current));
          },
        });
      });

      const headerTrigger = ScrollTrigger.create({
        start: 'top -24',
        end: 99999,
        onToggle: (self) => setScrolled(self.isActive),
      });

      const flowRailSteps = gsap.utils.toArray<HTMLElement>(
        '[data-flow-rail] [data-rail-step]',
        root,
      );

      const flowTriggers = flowSteps.map((step, index) =>
        ScrollTrigger.create({
          trigger: step,
          start: 'top 62%',
          end: 'bottom 38%',
          onToggle: (self) => {
            if (!self.isActive) return;
            const active = index + 1;

            flowSteps.forEach((item, itemIndex) =>
              item.classList.toggle('is-active', itemIndex === index),
            );
            flowRailSteps.forEach((item) => {
              const railStep = Number(item.dataset.railStep);
              item.dataset.state =
                railStep < active ? 'done' : railStep === active ? 'current' : 'todo';
            });
            flowVisuals.forEach((visual, visualIndex) => {
              gsap.to(visual, {
                autoAlpha: visualIndex === index ? 1 : 0,
                duration: 0.4,
                overwrite: 'auto',
              });
            });
          },
        }),
      );

      // Images and webfonts settle after the triggers are created, so start
      // positions need a recalculation once the layout is final.
      const refresh = () => ScrollTrigger.refresh();
      window.addEventListener('load', refresh);
      document.fonts?.ready.then(refresh);
      const refreshTimer = window.setTimeout(refresh, 1200);

      return () => {
        window.removeEventListener('load', refresh);
        window.clearTimeout(refreshTimer);
        mm.revert();
        headerTrigger.kill();
        sectionTriggers.forEach((trigger) => trigger?.kill());
        flowTriggers.forEach((trigger) => trigger.kill());
      };
    },
    { scope: rootRef, dependencies: [introComplete], revertOnUpdate: true },
  );

  return (
    <div ref={rootRef} id="topo" className="landing-shell admin-theme">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>

      <header data-hero="bar" className="sticky top-3 z-40 px-3 sm:px-4 lg:px-5">
        <div
          data-scrolled={scrolled}
          className={cn(
            'landing-header-bar relative mx-auto flex max-w-6xl items-center gap-3 rounded-[28px] px-3 sm:px-5',
            scrolled ? 'h-14' : 'h-16',
          )}
        >
          <Link href="#topo" className="shrink-0" onClick={() => setMenuOpen(false)}>
            <LogoWithText logoSize={28} textClassName="text-base font-semibold tracking-tight" />
          </Link>

          <nav
            className="hidden flex-1 items-center justify-center gap-0.5 lg:flex"
            aria-label="Seções"
          >
            {NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                data-active={activeSection === item.id}
                aria-current={activeSection === item.id ? 'true' : undefined}
                className="landing-nav-link rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <Button asChild variant="ghost" className="hidden rounded-full sm:inline-flex">
              <Link href="/login">Entrar</Link>
            </Button>
            <RegisterCta className="h-9 px-3 sm:px-4" showIcon={false} />
            <Button
              variant="ghost"
              size="icon"
              className="rounded-2xl lg:hidden"
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>

          <span data-landing="progress" className="landing-progress" aria-hidden="true" />
        </div>

        {menuOpen ? (
          <div className="relative mx-auto mt-2 max-w-6xl lg:hidden">
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default bg-black/50"
              aria-label="Fechar menu"
              onClick={() => setMenuOpen(false)}
            />
            <div className="landing-header-bar relative z-50 rounded-[28px] p-4">
              <nav className="flex flex-col gap-1" aria-label="Seções">
                {NAV.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="rounded-2xl px-3 py-2.5 text-sm font-medium"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
              <div className="mt-3 sm:hidden">
                <Button asChild variant="ghost" className="w-full rounded-full">
                  <Link href="/login">Entrar</Link>
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main id="conteudo" className="relative mx-auto max-w-6xl px-3 pb-12 sm:px-4 lg:px-5">
        <section className="relative pt-10 sm:pt-12 lg:pt-14">
          <div className="landing-glow" aria-hidden="true">
            <Image
              src="/marketing/leemia-light-waves.png"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          </div>

          <div className="relative mx-auto max-w-3xl text-center">
            <p
              data-hero="item"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--admin-card)] px-3 py-1.5 text-xs font-medium text-[var(--admin-accent)]"
            >
              <span className="size-1.5 rounded-full bg-[var(--admin-accent)]" />
              Agenda online do estúdio Leemia
            </p>

            <h1 className="mt-5 text-4xl font-semibold leading-[1.06] tracking-tight sm:text-5xl lg:text-6xl">
              <RevealWords text="Marque seu horário em três toques." />
            </h1>

            <p
              data-hero="item"
              className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Corte, barba, hidratação e mais. Escolha o serviço, o profissional e um horário livre
              de verdade — a confirmação chega no seu e-mail.
            </p>

            <div data-hero="item" className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <RegisterCta className="h-11 px-6 text-[0.95rem]">Criar conta grátis</RegisterCta>
              <Button asChild variant="ghost" className="h-11 rounded-full px-4">
                <a href="#fluxo">
                  Ver como funciona
                  <ArrowRight />
                </a>
              </Button>
            </div>

            <p data-hero="item" className="mt-4 text-xs text-muted-foreground">
              Sem cartão, sem ligação. Já tem conta?{' '}
              <Link href="/login" className="font-medium text-foreground hover:underline">
                Entrar
              </Link>
            </p>
          </div>

          <div className="relative mx-auto mt-9 max-w-3xl sm:mt-10">
            <div data-hero="demo">
              <BookingDemo />
            </div>

            <div
              data-hero="float"
              className="absolute right-full top-16 mr-5 hidden w-[12.5rem] xl:block"
            >
              <div className="admin-surface p-4">
                <span className="flex size-9 items-center justify-center rounded-2xl bg-[var(--admin-card-muted)]">
                  <ShieldCheck className="size-4 text-[var(--admin-accent)]" />
                </span>
                <p className="mt-3 text-sm font-semibold tracking-tight">Horário protegido</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Sem dois clientes no mesmo profissional.
                </p>
              </div>
            </div>

            <div
              data-hero="float"
              className="absolute bottom-12 left-full ml-5 hidden w-[12.5rem] xl:block"
            >
              <div className="admin-surface p-4">
                <span className="flex size-9 items-center justify-center rounded-2xl bg-[var(--admin-card-muted)]">
                  <BellRing className="size-4 text-[var(--admin-accent)]" />
                </span>
                <p className="mt-3 text-sm font-semibold tracking-tight">Aviso na hora</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Você e o profissional recebem o e-mail.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="vantagens" className="mt-24 scroll-mt-28 sm:mt-32">
          <div data-landing="reveal" className="max-w-2xl">
            <p className="text-xs font-medium tracking-wide text-[var(--admin-accent)]">
              Vantagens
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Menos espera, mais clareza.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((benefit) => (
              <article
                key={benefit.title}
                data-landing="reveal"
                data-motion="lift"
                className="admin-surface p-5"
              >
                <div className="flex size-10 items-center justify-center rounded-2xl bg-[var(--admin-card-muted)]">
                  <benefit.icon className="size-4 text-[var(--admin-accent)]" />
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">{benefit.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{benefit.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="fluxo" className="mt-24 scroll-mt-28 sm:mt-32">
          <div data-landing="reveal" className="max-w-2xl">
            <p className="text-xs font-medium tracking-wide text-[var(--admin-accent)]">
              Como funciona
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Role e veja o agendamento acontecer.
            </h2>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:gap-12">
            <div data-landing="reveal" className="lg:sticky lg:top-28 lg:self-start">
              <MockWindow title="Fluxo de agendamento">
                <div data-flow-rail className="px-4 pt-4">
                  <StepRail active={1} />
                </div>
                <div className="relative h-[13.5rem]">
                  {FLOW_PANELS.map((Panel, index) => (
                    <div
                      key={index}
                      data-flow-visual
                      className={cn(
                        'absolute inset-0 px-4 pb-4 pt-3',
                        index > 0 && 'invisible opacity-0',
                      )}
                      aria-hidden="true"
                    >
                      <Panel />
                    </div>
                  ))}
                </div>
              </MockWindow>
            </div>

            <ol className="space-y-4">
              {FLOW.map((step, index) => (
                <li
                  key={step.title}
                  data-flow-step
                  data-landing="reveal"
                  className="landing-step admin-surface p-5 sm:p-6"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                    {index + 1}
                  </span>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{step.text}</p>
                </li>
              ))}
              <li data-landing="reveal" className="pt-2">
                <RegisterCta className="h-11 px-5">Criar conta e marcar</RegisterCta>
              </li>
            </ol>
          </div>
        </section>

        <section id="servicos" className="mt-24 scroll-mt-28 sm:mt-32">
          <div data-landing="reveal" className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium tracking-wide text-[var(--admin-accent)]">
                Serviços
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                O que você pode marcar.
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Preços do catálogo atual do estúdio, com duração real de cada atendimento.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service) => {
              const accent = accentForProduct(service.name);
              const Icon = iconForProduct(service.name);

              return (
                <Link
                  key={service.name}
                  href="/register"
                  data-landing="reveal"
                  data-motion="lift"
                  className="group rounded-[1.35rem] bg-[var(--admin-card)] p-4 transition-colors hover:bg-[var(--admin-hover)]"
                >
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <span className="inline-flex items-center rounded-full bg-[var(--admin-chip)] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      {formatDuration(service.duration)}
                    </span>
                    <span className="text-sm font-semibold">{formatCurrency(service.price)}</span>
                  </div>
                  <div
                    className={cn(
                      'mb-5 flex size-14 items-center justify-center rounded-3xl',
                      accent.bg,
                    )}
                  >
                    <Icon className={cn('size-7', accent.fg)} />
                  </div>
                  <p className="flex items-center justify-between gap-2 font-semibold leading-snug">
                    {service.name}
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-24 sm:mt-32">
          <div data-landing="reveal" className="max-w-2xl">
            <p className="text-xs font-medium tracking-wide text-[var(--admin-accent)]">Dúvidas</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Antes de criar a conta.
            </h2>
          </div>
          <div className="mt-8 grid gap-3 lg:grid-cols-2">
            {FAQS.map((item) => (
              <details key={item.q} data-landing="reveal" className="landing-faq admin-surface p-5">
                <summary className="flex items-center justify-between gap-4 font-semibold tracking-tight">
                  {item.q}
                  <Plus className="landing-faq-icon size-4 shrink-0 text-muted-foreground transition-transform duration-300" />
                </summary>
                <p className="landing-faq-answer mt-3 text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-4 px-3 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-4 lg:px-5">
        <LogoWithText logoSize={24} textClassName="text-sm font-semibold" />
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <Link href="/login" className="hover:text-foreground">
            Entrar
          </Link>
          <Link href="/register" className="hover:text-foreground">
            Criar conta
          </Link>
          <span>© {new Date().getFullYear()} Leemia</span>
        </div>
      </footer>
    </div>
  );
}
