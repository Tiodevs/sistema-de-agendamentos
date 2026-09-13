'use client';

import { useAuth } from '@/hooks/use-auth';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMyAppointments, type Appointment } from '@/lib/api';
import { formatCurrency, formatDuration } from '@/lib/format';
import { accentForProduct, iconForProduct } from '@/lib/admin-accents';
import { STATUS_CONFIG } from '@/lib/appointment-status';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/admin/status-badge';
import { CalendarDays, CalendarPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaggerIn } from '@/components/motion/stagger-in';

function formatSlotTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function formatShortDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Sao_Paulo',
  });
}

function isUpcoming(appointment: Appointment, now: Date) {
  return (
    new Date(appointment.date) >= now &&
    !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status)
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);

  useEffect(() => {
    async function loadUpcoming() {
      try {
        const res = await getMyAppointments();
        if (res.data?.appointments) {
          setAppointments(res.data.appointments);
        }
      } catch {
        // silently fail
      } finally {
        setLoadingAppointments(false);
      }
    }
    loadUpcoming();
  }, []);

  const { upcoming, upcomingCount, historyCount, nextAppointment } = useMemo(() => {
    const current = new Date();
    const upcomingAll = appointments.filter((appointment) => isUpcoming(appointment, current));
    return {
      upcoming: upcomingAll.slice(0, 6),
      upcomingCount: upcomingAll.length,
      historyCount: appointments.length - upcomingAll.length,
      nextAppointment: upcomingAll[0],
    };
  }, [appointments]);
  const NextIcon = nextAppointment ? iconForProduct(nextAppointment.product.name) : null;

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  })();
  if (loadingAppointments) return null;

  return (
    <StaggerIn
      selector="[data-motion='enter']"
      className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]"
    >
      <div className="space-y-4">
        <section data-motion="enter" className="admin-surface p-5 sm:p-6">
          <p className="text-sm text-muted-foreground">{greeting}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
            {user?.name}
          </h1>
          <div className="mt-8 grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-semibold tracking-tight sm:text-3xl">{upcomingCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Próximos</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-tight sm:text-3xl">{historyCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">No histórico</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {appointments.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </section>

        <section data-motion="enter" className="admin-surface p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Próximos horários</h2>
            {upcoming.length > 0 ? (
              <button
                type="button"
                onClick={() => router.push('/appointments')}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Ver todos
              </button>
            ) : null}
          </div>

          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[1.35rem] bg-[var(--admin-card-muted)] py-12">
              <CalendarDays className="mb-2 size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum agendamento próximo</p>
              <Button variant="link" className="mt-1" onClick={() => router.push('/book')}>
                Agendar agora
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {upcoming.map((appointment) => {
                const accent = accentForProduct(appointment.product.name);
                const Icon = iconForProduct(appointment.product.name);
                return (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => router.push('/appointments')}
                    data-motion="lift"
                    className="rounded-[1.35rem] bg-[var(--admin-card-muted)] p-4 text-left transition-colors hover:bg-[var(--admin-hover)]"
                  >
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-chip)] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        {formatDuration(appointment.product.duration)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatShortDate(appointment.date)} · {formatSlotTime(appointment.date)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'mb-5 flex size-16 items-center justify-center rounded-3xl',
                        accent.bg,
                      )}
                    >
                      <Icon className={cn('size-8', accent.fg)} />
                    </div>
                    <p className="text-xs text-muted-foreground">{appointment.employee.name}</p>
                    <p className="mt-1 font-semibold leading-snug">{appointment.product.name}</p>
                    <div className="mt-3">
                      <StatusBadge status={appointment.status} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <section
          data-motion="enter"
          className="overflow-hidden rounded-[1.5rem] bg-black p-5 text-white"
        >
          <div className="mb-8 flex items-start justify-between gap-3">
            <div>
              <p className="text-3xl font-semibold tracking-tight">
                {nextAppointment ? formatCurrency(nextAppointment.price) : 'Livre'}
              </p>
              <p className="mt-1 text-sm text-white/55">
                {nextAppointment ? 'Próximo horário' : 'Nenhum horário marcado'}
              </p>
            </div>
            <Button
              onClick={() => router.push('/book')}
              className="rounded-full bg-white text-black hover:bg-white/90"
            >
              Novo
            </Button>
          </div>

          {nextAppointment && NextIcon ? (
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/8">
                <NextIcon className="size-4 text-white/80" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{nextAppointment.product.name}</p>
                <p className="truncate text-xs text-white/45">{nextAppointment.employee.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{formatSlotTime(nextAppointment.date)}</p>
                <p className="text-[11px] text-white/40">
                  {STATUS_CONFIG[nextAppointment.status].label}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/50">Escolha um serviço e reserve o próximo horário.</p>
          )}
        </section>

        <section
          data-motion="enter"
          className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-[#12352f] via-[#0d1f27] to-[#1a1430] p-5"
        >
          <p className="text-sm text-white/70">
            {nextAppointment
              ? `${formatDuration(nextAppointment.product.duration)} · ${formatSlotTime(nextAppointment.date)}`
              : 'Agende em poucos passos'}
          </p>
          <p className="mt-2 text-xs text-white/45">
            {nextAppointment
              ? formatShortDate(nextAppointment.date)
              : 'Serviço, profissional e horário'}
          </p>
          <h3 className="mt-8 text-2xl font-semibold tracking-tight text-white">
            {nextAppointment ? nextAppointment.product.name : 'Novo agendamento'}
          </h3>
          <p className="mt-2 max-w-[16rem] text-sm text-white/60">
            {nextAppointment
              ? `Com ${nextAppointment.employee.name}`
              : 'Marque um horário com o profissional que você preferir.'}
          </p>
          <Button
            onClick={() => router.push(nextAppointment ? '/appointments' : '/book')}
            className="mt-6 rounded-full bg-black text-white hover:bg-black/80"
          >
            <CalendarPlus className="size-4" />
            {nextAppointment ? 'Ver detalhes' : 'Agendar agora'}
          </Button>
        </section>
      </aside>
    </StaggerIn>
  );
}
