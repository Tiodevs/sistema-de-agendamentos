'use client';

import { useAuth } from '@/hooks/use-auth';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getMyAppointments,
  getBusinessHours,
  getSpecialDays,
  type Appointment,
  type BusinessHour,
  type SpecialDay,
} from '@/lib/api';
import { formatCurrency, formatDuration } from '@/lib/format';
import { iconForProduct } from '@/lib/admin-accents';
import { STATUS_CONFIG } from '@/lib/appointment-status';
import { Button } from '@/components/ui/button';
import {
  CalendarOff,
  CalendarPlus,
  ChevronRight,
  Clock,
  History,
  Repeat,
  type LucideIcon,
} from 'lucide-react';
import { StaggerIn } from '@/components/motion/stagger-in';

const TIME_ZONE = 'America/Sao_Paulo';

function formatSlotTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  });
}

function formatShortDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: TIME_ZONE,
  });
}

function todayYmd() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
}

function currentHm() {
  return new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TIME_ZONE,
  });
}

function addDaysYmd(ymd: string, days: number) {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function ymdFromIso(isoString: string) {
  return new Date(isoString).toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
}

function formatLongDate(ymd: string) {
  const [year, month, day] = ymd.split('-').map(Number);
  const formatted = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatAgo(days: number) {
  if (days <= 0) return 'hoje';
  if (days === 1) return 'há 1 dia';
  if (days < 30) return `há ${days} dias`;
  const months = Math.round(days / 30);
  if (months < 12) return months === 1 ? 'há 1 mês' : `há ${months} meses`;
  const years = Math.round(days / 365);
  return years === 1 ? 'há 1 ano' : `há ${years} anos`;
}

function formatInDays(days: number) {
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Amanhã';
  return `Em ${days} dias`;
}

function calendarDaysBetween(fromYmd: string, toYmd: string) {
  const from = Date.parse(`${fromYmd}T00:00:00Z`);
  const to = Date.parse(`${toYmd}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

function specialDateKey(day: SpecialDay) {
  return day.date.slice(0, 10);
}

function hoursForDate(ymd: string, hours: BusinessHour[], specialDays: SpecialDay[]) {
  const special = specialDays.find((day) => specialDateKey(day) === ymd);
  if (special) {
    return {
      isClosed: special.isClosed,
      openTime: special.openTime || '08:00',
      closeTime: special.closeTime || '18:00',
      special,
      dayName: special.title,
    };
  }

  const [year, month, day] = ymd.split('-').map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const hour = hours.find((item) => item.dayOfWeek === dayOfWeek);

  return {
    isClosed: hour?.isClosed ?? false,
    openTime: hour?.openTime ?? '08:00',
    closeTime: hour?.closeTime ?? '18:00',
    special: undefined as SpecialDay | undefined,
    dayName: hour?.dayName,
  };
}

function isUpcoming(appointment: Appointment, now: Date) {
  return (
    new Date(appointment.date) >= now &&
    !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status)
  );
}

function InsightCard({
  icon: Icon,
  label,
  value,
  hint,
  action,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <section data-motion="enter" className="admin-surface p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--admin-card-muted)]">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
          {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
          {action ? (
            <button
              type="button"
              onClick={action.onClick}
              className="mt-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {action.label}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function UserHomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [specialDays, setSpecialDays] = useState<SpecialDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHome() {
      try {
        const [appointmentsRes, hoursRes, specialRes] = await Promise.all([
          getMyAppointments(),
          getBusinessHours().catch(() => null),
          getSpecialDays().catch(() => null),
        ]);
        if (appointmentsRes.data?.appointments) {
          setAppointments(appointmentsRes.data.appointments);
        }
        if (hoursRes?.data?.hours) setHours(hoursRes.data.hours);
        if (specialRes?.data?.days) setSpecialDays(specialRes.data.days);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    loadHome();
  }, []);

  const { upcomingCount, nextAppointment, lastVisit, lastBooking } = useMemo(() => {
    const current = new Date();
    const upcomingAll = appointments.filter((appointment) => isUpcoming(appointment, current));
    const lastVisitItem = [...appointments]
      .filter(
        (appointment) =>
          appointment.status === 'COMPLETED' ||
          (new Date(appointment.date) < current &&
            !['CANCELLED', 'NO_SHOW'].includes(appointment.status)),
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const lastBookingItem = [...appointments]
      .filter((appointment) => appointment.status !== 'CANCELLED')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    return {
      upcomingCount: upcomingAll.length,
      nextAppointment: upcomingAll[0],
      lastVisit: lastVisitItem,
      lastBooking: lastBookingItem,
    };
  }, [appointments]);

  const today = todayYmd();
  const nowHm = currentHm();
  const todayHours = hoursForDate(today, hours, specialDays);

  const nextClosed = useMemo(() => {
    for (let offset = 0; offset < 90; offset += 1) {
      const ymd = addDaysYmd(today, offset);
      const info = hoursForDate(ymd, hours, specialDays);
      if (info.isClosed) {
        return { ymd, days: offset, info };
      }
    }
    return null;
  }, [hours, specialDays, today]);

  const nextHoliday = useMemo(() => {
    return (
      specialDays
        .filter((day) => day.isClosed && specialDateKey(day) >= today)
        .sort((a, b) => specialDateKey(a).localeCompare(specialDateKey(b)))[0] ?? null
    );
  }, [specialDays, today]);

  const nextOpen = useMemo(() => {
    for (let offset = 0; offset < 14; offset += 1) {
      const ymd = addDaysYmd(today, offset);
      const info = hoursForDate(ymd, hours, specialDays);
      if (info.isClosed) continue;
      if (offset === 0 && nowHm >= info.closeTime) continue;
      return { ymd, days: offset, info };
    }
    return null;
  }, [hours, specialDays, today, nowHm]);

  const weeklyClosed = hours.filter((hour) => hour.isClosed).map((hour) => hour.dayName);

  const favoriteService = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const appointment of appointments) {
      if (appointment.status === 'CANCELLED') continue;
      const current = counts.get(appointment.product.id) ?? {
        name: appointment.product.name,
        count: 0,
      };
      current.count += 1;
      counts.set(appointment.product.id, current);
    }
    return [...counts.values()].sort((a, b) => b.count - a.count)[0] ?? null;
  }, [appointments]);

  const NextIcon = nextAppointment ? iconForProduct(nextAppointment.product.name) : null;
  const gapDays = lastBooking
    ? Math.max(0, calendarDaysBetween(ymdFromIso(lastBooking.date), today))
    : user?.createdAt
      ? Math.max(0, calendarDaysBetween(ymdFromIso(user.createdAt), today))
      : null;

  const greeting = (() => {
    const hour = Number(
      new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        hour12: false,
        timeZone: TIME_ZONE,
      }),
    );
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  if (loading) return null;

  const todayClosed = todayHours.isClosed || nowHm >= todayHours.closeTime;
  const todayLabel = todayHours.isClosed
    ? todayHours.special
      ? `Fechado · ${todayHours.special.title}`
      : 'Fechado hoje'
    : nowHm < todayHours.openTime
      ? `Abre às ${todayHours.openTime}`
      : nowHm >= todayHours.closeTime
        ? 'Já fechou'
        : `Aberto até ${todayHours.closeTime}`;

  const closedHint = nextClosed
    ? [
        formatLongDate(nextClosed.ymd),
        nextClosed.info.special
          ? nextClosed.info.special.title
          : weeklyClosed.length > 0
            ? `Fecha ${weeklyClosed.map((name) => name.toLowerCase()).join(' e ')}`
            : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : weeklyClosed.length > 0
      ? `Fecha ${weeklyClosed.map((name) => name.toLowerCase()).join(' e ')}`
      : 'Nenhum fechamento cadastrado';

  const holidayHint =
    nextHoliday && nextClosed && specialDateKey(nextHoliday) !== nextClosed.ymd
      ? `${nextHoliday.title} · ${formatLongDate(specialDateKey(nextHoliday))}`
      : nextHoliday && nextClosed && specialDateKey(nextHoliday) === nextClosed.ymd
        ? nextHoliday.description
        : nextHoliday
          ? formatLongDate(specialDateKey(nextHoliday))
          : undefined;

  const idleHasUpcoming = Boolean(nextAppointment);
  const idleValue = idleHasUpcoming
    ? lastVisit
      ? formatAgo(calendarDaysBetween(ymdFromIso(lastVisit.date), today))
      : 'Horário marcado'
    : lastBooking
      ? formatAgo(gapDays ?? 0)
      : 'Nenhum ainda';
  const idleHint = idleHasUpcoming
    ? lastVisit
      ? `${lastVisit.product.name} com ${lastVisit.employee.name}`
      : 'Este é o primeiro horário marcado'
    : lastBooking
      ? `Último: ${lastBooking.product.name}`
      : 'Agende o primeiro horário';

  return (
    <StaggerIn
      selector="[data-motion='enter']"
      className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]"
    >
      <div className="space-y-4">
        <section data-motion="enter" className="admin-surface p-4 sm:p-6">
          <p className="text-sm text-muted-foreground">{greeting}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
            {user?.name}
          </h1>
          {upcomingCount > 1 ? (
            <button
              type="button"
              onClick={() => router.push('/appointments')}
              className="mt-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Você tem {upcomingCount} horários marcados
            </button>
          ) : null}
        </section>

        <button
          type="button"
          data-motion="enter"
          onClick={() => router.push('/appointments')}
          className="w-full overflow-hidden rounded-[1.5rem] bg-black p-5 text-left text-white transition-colors hover:bg-zinc-950"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-white/55">Próximo horário</p>
            <span className="inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-white/70">
              Ver mais
              <ChevronRight className="size-4" />
            </span>
          </div>

          {nextAppointment && NextIcon ? (
            <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div>
                <p className="text-3xl font-semibold tracking-tight">
                  {formatSlotTime(nextAppointment.date)}
                </p>
                <p className="mt-1 text-sm text-white/55">
                  {formatShortDate(nextAppointment.date)} · {formatCurrency(nextAppointment.price)}
                </p>
              </div>
              <div className="flex min-w-0 items-center gap-3 sm:max-w-[55%] sm:justify-end">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/8">
                  <NextIcon className="size-4 text-white/80" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{nextAppointment.product.name}</p>
                  <p className="truncate text-xs text-white/45">
                    {nextAppointment.employee.name} · {STATUS_CONFIG[nextAppointment.status].label}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-5 text-3xl font-semibold tracking-tight">Livre</p>
              <p className="mt-1 text-sm text-white/55">Nenhum horário marcado</p>
            </>
          )}
        </button>

        <section
          data-motion="enter"
          className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-[#12352f] via-[#0d1f27] to-[#1a1430] p-5"
        >
          <h3 className="text-2xl font-semibold tracking-tight text-white">Agendar agora</h3>
          <p className="mt-2 max-w-[18rem] text-sm text-white/60">
            Escolha o serviço e reserve o próximo horário com o profissional que preferir.
          </p>
          <Button
            onClick={() => router.push('/book')}
            className="mt-6 h-9 rounded-full bg-black px-4 text-sm text-white hover:bg-black/80"
          >
            <CalendarPlus className="size-4" />
            Novo agendamento
          </Button>
        </section>
      </div>

      <aside className="space-y-4">
        <InsightCard
          icon={CalendarOff}
          label="Próximo fechamento"
          value={nextClosed ? formatInDays(nextClosed.days) : 'Aberto'}
          hint={holidayHint ? `${closedHint}. ${holidayHint}` : closedHint}
        />

        <InsightCard
          icon={History}
          label={idleHasUpcoming ? 'Último atendimento' : 'Sem agendar'}
          value={idleValue}
          hint={idleHint}
        />

        <InsightCard
          icon={Clock}
          label="Hoje"
          value={todayLabel}
          hint={
            todayHours.isClosed
              ? nextOpen
                ? `Volta ${formatInDays(nextOpen.days).toLowerCase()} · ${nextOpen.info.openTime} às ${nextOpen.info.closeTime}`
                : todayHours.special?.description || 'Sem atendimento neste dia'
              : todayClosed && nextOpen
                ? `Próxima abertura ${formatInDays(nextOpen.days).toLowerCase()} às ${nextOpen.info.openTime}`
                : `${todayHours.openTime} às ${todayHours.closeTime}`
          }
        />

        {!nextAppointment && (lastVisit || favoriteService) ? (
          <InsightCard
            icon={Repeat}
            label={lastVisit ? 'Repetir horário' : 'Serviço mais pedido'}
            value={lastVisit?.product.name || favoriteService?.name || ''}
            hint={
              lastVisit
                ? `${formatDuration(lastVisit.product.duration)} · ${lastVisit.employee.name}`
                : favoriteService
                  ? `${favoriteService.count} ${favoriteService.count === 1 ? 'vez' : 'vezes'} no histórico`
                  : undefined
            }
            action={{ label: 'Agendar de novo', onClick: () => router.push('/book') }}
          />
        ) : nextAppointment && favoriteService ? (
          <InsightCard
            icon={Repeat}
            label="Serviço mais pedido"
            value={favoriteService.name}
            hint={`${favoriteService.count} ${favoriteService.count === 1 ? 'vez' : 'vezes'} no histórico`}
            action={{ label: 'Agendar de novo', onClick: () => router.push('/book') }}
          />
        ) : null}
      </aside>
    </StaggerIn>
  );
}
