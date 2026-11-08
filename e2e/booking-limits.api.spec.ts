import { bookAppointment, e2eNote, registerClient } from './helpers/api';
import { uniqueAuthAccount } from './helpers/auth';
import { bookTracked, findOpenSlot, resolveCatalogPair } from './helpers/catalog';
import { addDays, saoPauloIso, todayKey } from './helpers/dates';
import { hardDeleteAppointments, insertAppointmentDirectly, markEmailVerified } from './helpers/db';
import { expect, test } from './fixtures';

/** Junta mensagem, código e causas de um erro do Prisma para procurar o motivo. */
function describeError(error: unknown, depth = 0): string {
  if (!error || typeof error !== 'object' || depth > 5) return String(error ?? '');
  const record = error as { message?: unknown; code?: unknown; meta?: unknown; cause?: unknown };
  return [
    record.message,
    record.code,
    record.meta ? JSON.stringify(record.meta) : '',
    describeError(record.cause, depth + 1),
  ]
    .filter(Boolean)
    .join(' | ');
}

test.describe('Limites da reserva feita pelo cliente (SEC-02)', () => {
  test('a 4ª reserva futura do mesmo cliente volta 409 com mensagem clara', async ({
    api,
    userA,
  }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const usedDays: string[] = [];

    async function bookNext() {
      const open = await findOpenSlot(api, userA.token, pair, { skipDateKeys: usedDays });
      usedDays.push(open.dateKey);
      return bookTracked(
        api,
        userA.token,
        {
          productId: pair.product.id,
          employeeId: pair.employee.id,
          date: open.slot.start,
          notes: e2eNote('teto de reservas'),
        },
        userA.createdIds,
      );
    }

    for (let index = 0; index < 3; index += 1) {
      const booked = await bookNext();
      expect(booked.status, booked.body.message).toBe(201);
    }

    const fourth = await bookNext();
    expect(fourth.status).toBe(409);
    expect(fourth.body.code).toBe('BOOKING_LIMIT_REACHED');
    expect(fourth.body.message).toMatch(/Cancele um deles/);
  });

  test('conta sem e-mail confirmado não reserva', async ({ api, userA }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const account = uniqueAuthAccount('verify');
    const created = await registerClient(api, account);
    expect(created.status).toBe(201);
    expect(created.body.data?.user.emailVerified).toBe(false);
    const token = created.body.data!.token;

    const open = await findOpenSlot(api, token, pair);
    const payload = {
      productId: pair.product.id,
      employeeId: pair.employee.id,
      date: open.slot.start,
      notes: e2eNote('sem e-mail confirmado'),
    };

    const blocked = await bookAppointment(api, token, payload);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('EMAIL_NOT_VERIFIED');

    await markEmailVerified(account.email);
    const createdIds: string[] = [];
    const allowed = await bookTracked(api, token, payload, createdIds);
    expect(allowed.status, allowed.body.message).toBe(201);
    await hardDeleteAppointments(createdIds);
  });

  test('não reserva com mais de 60 dias de antecedência', async ({ api, userA }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const farDay = addDays(todayKey(), 75);

    const result = await bookTracked(
      api,
      userA.token,
      {
        productId: pair.product.id,
        employeeId: pair.employee.id,
        date: saoPauloIso(farDay, '10:00'),
        notes: e2eNote('antecedência'),
      },
      userA.createdIds,
    );

    expect(result.status).toBe(400);
    expect(result.body.code).toBe('BOOKING_TOO_FAR');
  });
});

test.describe('Trava de horário no Postgres (DOM-05)', () => {
  test('o banco recusa sobreposição gravada por fora da API', async ({ api, userA }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    // Bem longe, para não cruzar com outros testes nem com o seed.
    const start = new Date(saoPauloIso(addDays(todayKey(), 300), '10:00'));
    const hour = 60 * 60 * 1000;
    const base = {
      clientId: userA.user.id,
      employeeId: pair.employee.id,
      productId: pair.product.id,
    };

    const first = await insertAppointmentDirectly({
      ...base,
      date: start,
      endDate: new Date(start.getTime() + hour),
      notes: e2eNote('trava no banco'),
    });
    userA.createdIds.push(first.id);

    const error = await insertAppointmentDirectly({
      ...base,
      date: new Date(start.getTime() + hour / 2),
      endDate: new Date(start.getTime() + hour + hour / 2),
      notes: e2eNote('trava no banco'),
    }).then(
      (row) => {
        userA.createdIds.push(row.id);
        return null;
      },
      (reason: unknown) => reason,
    );

    expect(error, 'a segunda gravação deveria ter sido recusada pelo Postgres').not.toBeNull();
    expect(describeError(error)).toMatch(/23P01|exclusion|appointments_employee_no_overlap/i);
  });
});
