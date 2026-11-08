import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  appointmentFitsHours,
  applyScheduleChange,
  applySpecialOverrides,
  isAffectedByChange,
  type ScheduleConfig,
} from '../src/lib/schedule-impact';

/** Segunda a sábado das 08:00 às 18:00, domingo fechado. */
const WEEK = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  openTime: '08:00',
  closeTime: '18:00',
  isClosed: dayOfWeek === 0,
}));

const BASE: ScheduleConfig = {
  studioHours: WEEK,
  studioSpecials: [],
  employeeHours: [],
  employeeSpecials: [],
};

// Quinta, 24/12/2026, das 15:00 às 16:00 em São Paulo.
const DAY = '2026-12-24';
const APPOINTMENT = {
  date: new Date('2026-12-24T15:00:00-03:00'),
  endDate: new Date('2026-12-24T16:00:00-03:00'),
};

describe('agendamentos afetados por mudança de expediente (DOM-02)', () => {
  it('fechar o dia afeta quem já estava marcado', () => {
    const after = applyScheduleChange(
      BASE,
      {
        dateKeys: [DAY],
        studioSpecials: [
          { dateKey: DAY, special: { isClosed: true, openTime: null, closeTime: null } },
        ],
      },
      'emp-1',
    );
    assert.equal(isAffectedByChange(APPOINTMENT, DAY, BASE, after), true);
  });

  it('horário especial que ainda cobre o atendimento não afeta; um que corta, afeta', () => {
    const until17 = applyScheduleChange(
      BASE,
      {
        studioSpecials: [
          { dateKey: DAY, special: { isClosed: false, openTime: '08:00', closeTime: '17:00' } },
        ],
      },
      'emp-1',
    );
    assert.equal(isAffectedByChange(APPOINTMENT, DAY, BASE, until17), false);

    const until12 = applyScheduleChange(
      BASE,
      {
        studioSpecials: [
          { dateKey: DAY, special: { isClosed: false, openTime: '08:00', closeTime: '12:00' } },
        ],
      },
      'emp-1',
    );
    assert.equal(isAffectedByChange(APPOINTMENT, DAY, BASE, until12), true);
  });

  it('encurtar o expediente semanal afeta o que termina depois do novo fechamento', () => {
    const shorter = WEEK.map((hour) => ({ ...hour, closeTime: '15:30' }));
    const after = applyScheduleChange(BASE, { studioHours: shorter }, 'emp-1');
    assert.equal(isAffectedByChange(APPOINTMENT, DAY, BASE, after), true);
  });

  it('folga de um profissional não afeta os outros', () => {
    const change = {
      employeeId: 'emp-1',
      employeeSpecials: [
        { dateKey: DAY, special: { isClosed: true, openTime: null, closeTime: null } },
      ],
    };
    const forEmp1 = applyScheduleChange(BASE, change, 'emp-1');
    const forEmp2 = applyScheduleChange(BASE, change, 'emp-2');
    assert.equal(isAffectedByChange(APPOINTMENT, DAY, BASE, forEmp1), true);
    assert.equal(isAffectedByChange(APPOINTMENT, DAY, BASE, forEmp2), false);
  });

  it('voltar ao horário do estúdio afeta quando o do estúdio é menor', () => {
    const studioUntil12 = WEEK.map((hour) => ({ ...hour, closeTime: '12:00' }));
    const before: ScheduleConfig = { ...BASE, studioHours: studioUntil12, employeeHours: WEEK };
    // Com horário próprio, o profissional ainda fica limitado ao do estúdio (interseção).
    assert.equal(
      appointmentFitsHours(
        APPOINTMENT,
        { isClosed: false, openTime: '08:00', closeTime: '18:00' },
        DAY,
      ),
      true,
    );
    const after = applyScheduleChange(before, { employeeId: 'emp-1', employeeHours: [] }, 'emp-1');
    // Antes já não cabia (estúdio fecha às 12:00): não é listado de novo.
    assert.equal(isAffectedByChange(APPOINTMENT, DAY, before, after), false);
  });

  it('quem já estava fora do expediente não volta a ser listado', () => {
    const closed: ScheduleConfig = {
      ...BASE,
      studioSpecials: [{ date: DAY, isClosed: true, openTime: null, closeTime: null }],
    };
    const after = applyScheduleChange(closed, { studioHours: WEEK }, 'emp-1');
    assert.equal(isAffectedByChange(APPOINTMENT, DAY, closed, after), false);
  });

  it('remover um dia especial que abria um domingo fecha o dia', () => {
    const sunday = '2026-12-27';
    const sundayAppointment = {
      date: new Date('2026-12-27T10:00:00-03:00'),
      endDate: new Date('2026-12-27T11:00:00-03:00'),
    };
    const opened: ScheduleConfig = {
      ...BASE,
      studioSpecials: [{ date: sunday, isClosed: false, openTime: '09:00', closeTime: '13:00' }],
    };
    const after = applyScheduleChange(
      opened,
      { studioSpecials: [{ dateKey: sunday, special: null }] },
      'emp-1',
    );
    assert.equal(isAffectedByChange(sundayAppointment, sunday, opened, after), true);
  });
});

describe('applySpecialOverrides', () => {
  it('troca, remove e acrescenta pela data', () => {
    const specials = [
      { date: '2026-12-24', isClosed: true },
      { date: new Date('2026-12-31T00:00:00.000Z'), isClosed: true },
    ];
    const result = applySpecialOverrides(specials, [
      { dateKey: '2026-12-24', special: null },
      {
        dateKey: '2026-12-31',
        special: { isClosed: false, openTime: '08:00', closeTime: '12:00' },
      },
      { dateKey: '2027-01-01', special: { isClosed: true } },
    ]);
    assert.deepEqual(
      result.map((item) => [String(item.date).slice(0, 10), item.isClosed]),
      [
        ['2026-12-31', false],
        ['2027-01-01', true],
      ],
    );
  });
});
