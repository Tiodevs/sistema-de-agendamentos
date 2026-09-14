import { bookAppointment, e2eNote, getAvailability } from './helpers/api';
import { resolveCatalogPair } from './helpers/catalog';
import { nextSundayKey, nextWeekdayKey, saoPauloIso } from './helpers/dates';
import {
  replaceEmployeeHours,
  replaceEmployeeSpecialDays,
  restoreEmployeeSchedule,
  snapshotEmployeeSchedule,
} from './helpers/db';
import { expect, test } from './fixtures';

const STUDIO_WEEK = [
  { dayOfWeek: 0, openTime: '08:00', closeTime: '18:00', isClosed: true },
  { dayOfWeek: 1, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 2, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 3, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 4, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 5, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 6, openTime: '08:00', closeTime: '12:00', isClosed: false },
];

test.describe('Expediente por profissional', () => {
  test('cliente não personaliza horário de profissional', async ({ api, userA }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const result = await api.fetch(`/api/schedule/employees/${pair.employee.id}/hours`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${userA.token}` },
      data: { hours: STUDIO_WEEK },
    });
    expect(result.status()).toBe(403);

    const list = await api.fetch('/api/schedule/employees', {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    expect(list.status()).toBe(403);
  });

  test('sem personalização a grade herda o estúdio', async ({ api, userA }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const schedule = await api.fetch(`/api/schedule/employees/${pair.employee.id}`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    expect(schedule.status()).toBe(200);
    const body = (await schedule.json()) as {
      data?: { usesCustomHours?: boolean };
    };
    if (body.data?.usesCustomHours) {
      test.info().annotations.push({
        type: 'note',
        description: `${pair.employee.name} já tem horário próprio; o teste de herança não se aplica.`,
      });
      return;
    }

    const sunday = await getAvailability(
      api,
      userA.token,
      pair.employee.id,
      pair.product.id,
      nextSundayKey(),
    );
    expect(sunday.status).toBe(200);
    expect(sunday.body.data?.isClosed).toBeTruthy();
  });

  test('folga do profissional fecha a disponibilidade naquele dia', async ({ api, userA }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const snapshot = await snapshotEmployeeSchedule(pair.employee.id);
    const weekday = nextWeekdayKey(2);
    try {
      await replaceEmployeeSpecialDays(pair.employee.id, [
        {
          date: weekday,
          title: `${e2eNote('folga-profissional')}`,
          isClosed: true,
        },
      ]);

      const availability = await getAvailability(
        api,
        userA.token,
        pair.employee.id,
        pair.product.id,
        weekday,
      );
      expect(availability.status).toBe(200);
      expect(availability.body.data?.isClosed).toBeTruthy();

      const booked = await bookAppointment(api, userA.token, {
        productId: pair.product.id,
        employeeId: pair.employee.id,
        date: saoPauloIso(weekday, '10:00'),
        notes: e2eNote('folga-profissional'),
      });
      expect(booked.status).toBe(400);
      expect(booked.body.message).toMatch(/atendimento|indisponível/i);
    } finally {
      await restoreEmployeeSchedule(pair.employee.id, snapshot);
    }
  });

  test('expediente mais curto limita os slots daquele profissional', async ({ api, userA }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const snapshot = await snapshotEmployeeSchedule(pair.employee.id);
    const monday = nextWeekdayKey(1);
    const closeTime = pair.product.duration <= 45 ? '11:00' : '12:00';
    try {
      await replaceEmployeeHours(
        pair.employee.id,
        STUDIO_WEEK.map((hour) =>
          hour.dayOfWeek === 1 ? { ...hour, openTime: '10:00', closeTime, isClosed: false } : hour,
        ),
      );

      const availability = await getAvailability(
        api,
        userA.token,
        pair.employee.id,
        pair.product.id,
        monday,
      );
      expect(availability.status).toBe(200);
      expect(availability.body.data?.isClosed).toBeFalsy();
      const slots = availability.body.data?.slots ?? [];
      expect(slots.length).toBeGreaterThan(0);
      expect(availability.body.data?.businessHours).toEqual({ start: '10:00', end: closeTime });
      for (const slot of slots) {
        const start = new Date(slot.start).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
          timeZone: 'America/Sao_Paulo',
        });
        expect(start >= '10:00').toBeTruthy();
      }

      const tooEarly = await bookAppointment(api, userA.token, {
        productId: pair.product.id,
        employeeId: pair.employee.id,
        date: saoPauloIso(monday, '08:00'),
        notes: e2eNote('antes-do-expediente'),
      });
      expect(tooEarly.status).toBe(400);
    } finally {
      await restoreEmployeeSchedule(pair.employee.id, snapshot);
    }
  });

  test('horário próprio não abre o domingo se o estúdio está fechado', async ({ api, userA }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const snapshot = await snapshotEmployeeSchedule(pair.employee.id);
    try {
      await replaceEmployeeHours(
        pair.employee.id,
        STUDIO_WEEK.map((hour) =>
          hour.dayOfWeek === 0
            ? { ...hour, isClosed: false, openTime: '09:00', closeTime: '13:00' }
            : hour,
        ),
      );

      const sunday = await getAvailability(
        api,
        userA.token,
        pair.employee.id,
        pair.product.id,
        nextSundayKey(),
      );
      expect(sunday.status).toBe(200);
      expect(sunday.body.data?.isClosed).toBeTruthy();
    } finally {
      await restoreEmployeeSchedule(pair.employee.id, snapshot);
    }
  });
});
