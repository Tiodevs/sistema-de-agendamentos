import {
  bookAppointment,
  cancelAppointment,
  e2eNote,
  getAvailability,
  getEmployees,
} from './helpers/api';
import {
  bookTracked,
  findOpenSlot,
  resolveCatalogPair,
  unmatchedEmployee,
} from './helpers/catalog';
import {
  saoPauloIso,
  yesterdayKey,
  nextSundayKey,
  addDays,
  todayKey,
  isSunday,
  weekdayOf,
} from './helpers/dates';
import { expect, test } from './fixtures';

test.describe('Integridade da reserva na API', () => {
  test('recusa agendamento sem autenticação', async ({ api }) => {
    const result = await bookAppointment(api, '', {
      productId: 'x',
      employeeId: 'y',
      date: new Date().toISOString(),
    });
    expect(result.status).toBe(401);
  });

  test('consulta de disponibilidade exige autenticação', async ({ api }) => {
    const result = await getAvailability(api, '', 'employee', 'product', todayKey());
    expect(result.status).toBe(401);
  });

  test('não permite dois clientes no mesmo horário do profissional', async ({
    api,
    userA,
    userB,
  }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const open = await findOpenSlot(api, userA.token, pair);

    const first = await bookTracked(
      api,
      userA.token,
      {
        productId: pair.product.id,
        employeeId: pair.employee.id,
        date: open.slot.start,
        notes: e2eNote('conflito-a'),
      },
      userA.createdIds,
    );
    expect(first.status).toBe(201);

    const second = await bookTracked(
      api,
      userB.token,
      {
        productId: pair.product.id,
        employeeId: pair.employee.id,
        date: open.slot.start,
        notes: e2eNote('conflito-b'),
      },
      userB.createdIds,
    );
    expect(second.status).toBe(409);
    expect(second.body.message).toMatch(/já possui um agendamento/i);

    const availability = await getAvailability(
      api,
      userB.token,
      pair.employee.id,
      pair.product.id,
      open.dateKey,
    );
    const taken = availability.body.data?.slots.find((slot) => slot.start === open.slot.start);
    expect(taken?.available).toBe(false);
  });

  test('cancelar libera o horário para outra pessoa', async ({ api, userA, userB }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const open = await findOpenSlot(api, userA.token, pair);

    const created = await bookTracked(
      api,
      userA.token,
      {
        productId: pair.product.id,
        employeeId: pair.employee.id,
        date: open.slot.start,
        notes: e2eNote('cancelar-libera'),
      },
      userA.createdIds,
    );
    expect(created.status).toBe(201);
    const appointmentId = created.body.data?.appointment.id as string;

    const cancelled = await cancelAppointment(api, userA.token, appointmentId);
    expect(cancelled.status).toBe(200);

    const availability = await getAvailability(
      api,
      userB.token,
      pair.employee.id,
      pair.product.id,
      open.dateKey,
    );
    const slot = availability.body.data?.slots.find((item) => item.start === open.slot.start);
    expect(slot?.available).toBe(true);

    const rebook = await bookTracked(
      api,
      userB.token,
      {
        productId: pair.product.id,
        employeeId: pair.employee.id,
        date: open.slot.start,
        notes: e2eNote('rebook-apos-cancel'),
      },
      userB.createdIds,
    );
    expect(rebook.status).toBe(201);
  });

  test('recusa profissional que não atende o serviço escolhido', async ({ api, userA }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const employees = await getEmployees(api, userA.token);
    const other = unmatchedEmployee(employees.body.data?.employees || [], pair.product.id);
    test.skip(!other, 'Todos os profissionais atendem o serviço escolhido');
    if (!other) return;

    const open = await findOpenSlot(api, userA.token, pair);
    const result = await bookTracked(
      api,
      userA.token,
      {
        productId: pair.product.id,
        employeeId: other.id,
        date: open.slot.start,
        notes: e2eNote('produto-nao-vinculado'),
      },
      userA.createdIds,
    );
    expect(result.status).toBe(400);
    expect(result.body.message).toMatch(/não atende este produto/i);
  });

  test('ignora clientId enviado no corpo e agenda sempre para o usuário autenticado', async ({
    api,
    userA,
    userB,
  }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const open = await findOpenSlot(api, userA.token, pair);
    const note = e2eNote('spoof-client');

    const result = await bookTracked(
      api,
      userA.token,
      {
        productId: pair.product.id,
        employeeId: pair.employee.id,
        date: open.slot.start,
        notes: note,
        clientId: userB.user.id,
      },
      userA.createdIds,
    );
    expect(result.status).toBe(201);
    expect(result.body.data?.appointment.client.id).toBe(userA.user.id);
    expect(result.body.data?.appointment.client.id).not.toBe(userB.user.id);
  });

  test('preço enviado pelo cliente não altera o valor cobrado', async ({ api, userA }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const open = await findOpenSlot(api, userA.token, pair);

    const result = await api.fetch('/api/appointments/book', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      data: {
        productId: pair.product.id,
        employeeId: pair.employee.id,
        date: open.slot.start,
        notes: e2eNote('spoof-price'),
        price: 0.01,
      },
    });
    const body = (await result.json()) as {
      data?: { appointment?: { id: string; price: number } };
    };
    if (result.status() === 201 && body.data?.appointment?.id) {
      userA.createdIds.push(body.data.appointment.id);
    }
    expect(result.status()).toBe(201);
    expect(body.data?.appointment?.price).toBe(pair.product.price);
  });

  test('observações acima de 500 caracteres são rejeitadas', async ({ api, userA }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const open = await findOpenSlot(api, userA.token, pair);
    const result = await bookTracked(
      api,
      userA.token,
      {
        productId: pair.product.id,
        employeeId: pair.employee.id,
        date: open.slot.start,
        notes: 'x'.repeat(501),
      },
      userA.createdIds,
    );
    expect(result.status).toBe(400);
  });

  test('usuário comum não cria agendamento pela rota de admin', async ({ api, userA, userB }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const open = await findOpenSlot(api, userA.token, pair);
    const { createAdminAppointment } = await import('./helpers/api');
    const result = await createAdminAppointment(api, userA.token, {
      productId: pair.product.id,
      employeeId: pair.employee.id,
      clientId: userB.user.id,
      date: open.slot.start,
    });
    expect(result.status).toBe(403);
  });

  test('cliente pode marcar o mesmo horário com profissionais diferentes', async ({
    api,
    userA,
  }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const employees = await getEmployees(api, userA.token);
    const others = (employees.body.data?.employees || []).filter(
      (employee) => employee.id !== pair.employee.id,
    );
    test.skip(others.length === 0, 'Não há segundo profissional para testar overlap do cliente');

    for (const secondEmployee of others) {
      const linkedProduct = secondEmployee.products.find((item) => item.product.active);
      if (!linkedProduct) continue;
      const linkedProductId = linkedProduct.product.id;

      for (let offset = 14; offset < 45; offset += 1) {
        const dateKey = addDays(todayKey(), offset);
        if (isSunday(dateKey) || weekdayOf(dateKey) === 6) continue;

        const [firstAvailability, secondAvailability] = await Promise.all([
          getAvailability(api, userA.token, pair.employee.id, pair.product.id, dateKey),
          getAvailability(api, userA.token, secondEmployee.id, linkedProductId, dateKey),
        ]);
        if (
          firstAvailability.status !== 200 ||
          secondAvailability.status !== 200 ||
          firstAvailability.body.data?.isClosed ||
          secondAvailability.body.data?.isClosed
        ) {
          continue;
        }

        const shared = firstAvailability.body.data?.slots.find(
          (slot) =>
            slot.available &&
            secondAvailability.body.data?.slots.some(
              (other) => other.start === slot.start && other.available,
            ),
        );
        if (!shared) continue;

        const created = await bookTracked(
          api,
          userA.token,
          {
            productId: pair.product.id,
            employeeId: pair.employee.id,
            date: shared.start,
            notes: e2eNote('overlap-cliente-1'),
          },
          userA.createdIds,
        );
        expect(created.status).toBe(201);

        const second = await bookTracked(
          api,
          userA.token,
          {
            productId: linkedProductId,
            employeeId: secondEmployee.id,
            date: shared.start,
            notes: e2eNote('overlap-cliente-2'),
          },
          userA.createdIds,
        );
        expect(second.status).toBe(201);
        return;
      }
    }

    test.skip(true, 'Não há segundo profissional com horário livre coincidente');
  });
});

test.describe('Lacunas de integridade da API', { tag: '@gap' }, () => {
  test('deve recusar agendamento em domingo fechado mesmo via API', async ({ api, userA }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const sunday = nextSundayKey();
    const result = await bookTracked(
      api,
      userA.token,
      {
        productId: pair.product.id,
        employeeId: pair.employee.id,
        date: saoPauloIso(sunday, '10:00'),
        notes: e2eNote('gap-domingo'),
      },
      userA.createdIds,
    );
    expect(result.status, 'POST /book deveria validar expediente, não só conflito de agenda').toBe(
      400,
    );
  });

  test('deve recusar agendamento no passado', async ({ api, userA }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const result = await bookTracked(
      api,
      userA.token,
      {
        productId: pair.product.id,
        employeeId: pair.employee.id,
        date: saoPauloIso(yesterdayKey(), '10:00'),
        notes: e2eNote('gap-passado'),
      },
      userA.createdIds,
    );
    expect(result.status).toBe(400);
  });

  test('deve recusar horário fora do expediente', async ({ api, userA }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const weekday = addDays(todayKey(), weekdayOfSafe(1));
    const result = await bookTracked(
      api,
      userA.token,
      {
        productId: pair.product.id,
        employeeId: pair.employee.id,
        date: saoPauloIso(weekday, '23:00'),
        notes: e2eNote('gap-fora-expediente'),
      },
      userA.createdIds,
    );
    expect(result.status).toBe(400);
  });

  test('deve recusar horário que não existe na grade de 15 minutos', async ({ api, userA }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const weekday = addDays(todayKey(), weekdayOfSafe(1));
    const result = await bookTracked(
      api,
      userA.token,
      {
        productId: pair.product.id,
        employeeId: pair.employee.id,
        date: saoPauloIso(weekday, '10:07'),
        notes: e2eNote('gap-desalinhado'),
      },
      userA.createdIds,
    );
    expect(result.status).toBe(400);
  });

  test('deve recusar serviço que termina depois do fechamento', async ({ api, userA }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const weekday = addDays(todayKey(), weekdayOfSafe(1));
    const result = await bookTracked(
      api,
      userA.token,
      {
        productId: pair.product.id,
        employeeId: pair.employee.id,
        date: saoPauloIso(weekday, '17:45'),
        notes: e2eNote('gap-estoura-fechamento'),
      },
      userA.createdIds,
    );
    expect(result.status).toBe(400);
  });

  test('reservas simultâneas do mesmo slot devem gravar apenas uma', async ({
    api,
    userA,
    userB,
  }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const open = await findOpenSlot(api, userA.token, pair);
    const payloadA = {
      productId: pair.product.id,
      employeeId: pair.employee.id,
      date: open.slot.start,
      notes: e2eNote('gap-race-a'),
    };
    const payloadB = {
      productId: pair.product.id,
      employeeId: pair.employee.id,
      date: open.slot.start,
      notes: e2eNote('gap-race-b'),
    };

    const [first, second] = await Promise.all([
      bookTracked(api, userA.token, payloadA, userA.createdIds),
      bookTracked(api, userB.token, payloadB, userB.createdIds),
    ]);

    const created = [first, second].filter((result) => result.status === 201);
    expect(created.length, 'Falta trava transacional contra double-booking').toBe(1);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
  });
});

function weekdayOfSafe(targetWeekday: number) {
  const today = todayKey();
  for (let offset = 1; offset <= 8; offset += 1) {
    const key = addDays(today, offset);
    const weekday = new Date(`${key}T12:00:00-03:00`).getUTCDay();
    if (weekday === targetWeekday) return offset;
  }
  return 1;
}
