import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  breakIntervals,
  conflictsWithBuffer,
  dayBounds,
  enumerateSlots,
} from '../src/lib/booking-slot';
import { appointmentFitsHours } from '../src/lib/schedule-impact';
import {
  mergeBreaks,
  parseBreaks,
  resolveHoursForDate,
  type HourLike,
} from '../src/lib/schedule-hours';

// Segunda-feira, 09/11/2026.
const DAY = '2026-11-09';
const at = (time: string) => new Date(`${DAY}T${time}:00-03:00`);
const times = (slots: { start: Date }[]) =>
  slots.map((slot) =>
    new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(slot.start),
  );

function week(overrides: Partial<HourLike> = {}): HourLike[] {
  return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    openTime: '09:00',
    closeTime: '18:00',
    isClosed: false,
    ...overrides,
  }));
}

describe('pausas do expediente (UX-12)', () => {
  it('lê só pausas válidas, em ordem', () => {
    assert.deepEqual(
      parseBreaks([
        { start: '15:00', end: '15:15' },
        { start: '12:00', end: '13:00' },
        { start: '14:00', end: '13:00' },
        { start: '25:00', end: '26:00' },
        'almoço',
        null,
      ]),
      [
        { start: '12:00', end: '13:00' },
        { start: '15:00', end: '15:15' },
      ],
    );
    assert.deepEqual(parseBreaks(null), []);
    assert.deepEqual(parseBreaks('[]'), []);
  });

  it('funde pausas que se encostam ou se sobrepõem', () => {
    assert.deepEqual(
      mergeBreaks(
        [{ start: '12:00', end: '13:00' }],
        [
          { start: '12:30', end: '13:30' },
          { start: '16:00', end: '16:15' },
        ],
      ),
      [
        { start: '12:00', end: '13:30' },
        { start: '16:00', end: '16:15' },
      ],
    );
  });

  it('o almoço some da grade: nenhum horário esbarra na pausa', () => {
    const { dayStart, dayEnd } = dayBounds(DAY, '11:00', '14:00');
    const pauses = breakIntervals(DAY, [{ start: '12:00', end: '13:00' }]);
    assert.deepEqual(times(enumerateSlots(dayStart, dayEnd, 30, pauses)), [
      '11:00',
      '11:15',
      '11:30',
      '13:00',
      '13:15',
      '13:30',
    ]);
  });

  it('sem pausa, a grade é a de antes', () => {
    const { dayStart, dayEnd } = dayBounds(DAY, '11:00', '12:00');
    assert.deepEqual(times(enumerateSlots(dayStart, dayEnd, 30)), ['11:00', '11:15', '11:30']);
  });

  it('profissional com horário próprio soma as pausas do estúdio às dele', () => {
    const hours = resolveHoursForDate({
      dateKey: DAY,
      studioHours: week({ breaks: [{ start: '12:00', end: '13:00' }] }),
      studioSpecials: [],
      employeeHours: week({
        openTime: '10:00',
        closeTime: '17:00',
        breaks: [{ start: '15:00', end: '15:30' }],
      }),
      employeeSpecials: [],
    });
    assert.equal(hours.isClosed, false);
    assert.equal(hours.openTime, '10:00');
    assert.equal(hours.closeTime, '17:00');
    assert.deepEqual(hours.breaks, [
      { start: '12:00', end: '13:00' },
      { start: '15:00', end: '15:30' },
    ]);
  });

  it('dia especial tem horário próprio, sem as pausas da semana', () => {
    const hours = resolveHoursForDate({
      dateKey: DAY,
      studioHours: week({ breaks: [{ start: '12:00', end: '13:00' }] }),
      studioSpecials: [{ date: DAY, isClosed: false, openTime: '10:00', closeTime: '14:00' }],
    });
    assert.deepEqual(hours.breaks, []);
  });

  it('agendamento em cima de uma pausa nova conta como afetado (DOM-02)', () => {
    const hours = {
      isClosed: false,
      openTime: '09:00',
      closeTime: '18:00',
      breaks: [{ start: '12:00', end: '13:00' }],
    };
    assert.equal(
      appointmentFitsHours({ date: at('12:30'), endDate: at('13:00') }, hours, DAY),
      false,
    );
    assert.equal(
      appointmentFitsHours({ date: at('13:00'), endDate: at('13:30') }, hours, DAY),
      true,
    );
  });
});

describe('respiro entre atendimentos (UX-12)', () => {
  const booked = { start: at('10:00'), end: at('10:30') };

  it('sem respiro, encostar no atendimento não é conflito', () => {
    assert.equal(conflictsWithBuffer({ start: at('10:30'), end: at('11:00') }, booked), false);
    assert.equal(conflictsWithBuffer({ start: at('09:30'), end: at('10:00') }, booked), false);
    assert.equal(conflictsWithBuffer({ start: at('10:15'), end: at('10:45') }, booked), true);
  });

  it('com 15 minutos de respiro, é preciso o intervalo antes e depois', () => {
    assert.equal(conflictsWithBuffer({ start: at('10:30'), end: at('11:00') }, booked, 15), true);
    assert.equal(conflictsWithBuffer({ start: at('10:45'), end: at('11:15') }, booked, 15), false);
    assert.equal(conflictsWithBuffer({ start: at('09:30'), end: at('10:00') }, booked, 15), true);
    assert.equal(conflictsWithBuffer({ start: at('09:15'), end: at('09:45') }, booked, 15), false);
  });
});
