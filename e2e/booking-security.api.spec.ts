import {
  cancelAppointment,
  e2eNote,
  getAllAppointments,
  getAppointmentById,
  getClientById,
  getClients,
  getEmployees,
  getProducts,
} from './helpers/api';
import { bookTracked, findOpenSlot, resolveCatalogPair } from './helpers/catalog';
import { injectSession } from './helpers/ui';
import { expect, test } from './fixtures';

test.describe('Autorização do fluxo de agendamento', () => {
  test('cliente não cancela agendamento de outra pessoa', async ({ api, userA, userB }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const open = await findOpenSlot(api, userA.token, pair);
    const created = await bookTracked(
      api,
      userA.token,
      {
        productId: pair.product.id,
        employeeId: pair.employee.id,
        date: open.slot.start,
        notes: e2eNote('nao-cancela-alheio'),
      },
      userA.createdIds,
    );
    expect(created.status).toBe(201);
    const id = created.body.data?.appointment.id as string;

    const result = await cancelAppointment(api, userB.token, id);
    expect(result.status).toBe(403);
    expect(result.body.message).toMatch(/próprios agendamentos/i);
  });

  test('cliente não altera status pela rota administrativa', async ({ api, userA }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const open = await findOpenSlot(api, userA.token, pair);
    const created = await bookTracked(
      api,
      userA.token,
      {
        productId: pair.product.id,
        employeeId: pair.employee.id,
        date: open.slot.start,
        notes: e2eNote('nao-status-admin'),
      },
      userA.createdIds,
    );
    const id = created.body.data?.appointment.id as string;
    const result = await api.fetch(`/api/appointments/${id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userA.token}` },
      data: { status: 'COMPLETED' },
    });
    expect(result.status()).toBe(403);
  });
});

test.describe('Lacunas de segurança e privacidade', { tag: '@gap' }, () => {
  test('cliente não deve listar a agenda de todo o estúdio', async ({ api, userA }) => {
    const result = await getAllAppointments(api, userA.token);
    expect(result.status, 'GET /api/appointments deveria ser restrito a admin').toBe(403);
  });

  test('cliente não deve ler agendamento de outra pessoa por ID', async ({ api, userA, userB }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const open = await findOpenSlot(api, userA.token, pair);
    const created = await bookTracked(
      api,
      userA.token,
      {
        productId: pair.product.id,
        employeeId: pair.employee.id,
        date: open.slot.start,
        notes: e2eNote('idor-get-id'),
      },
      userA.createdIds,
    );
    const id = created.body.data?.appointment.id as string;

    const result = await getAppointmentById(api, userB.token, id);
    expect(result.status).toBe(403);
    expect(result.body.data?.appointment?.client.email).toBeUndefined();
  });

  test('cliente não deve listar e-mails e telefones de todos os usuários', async ({
    api,
    userA,
  }) => {
    const result = await getClients(api, userA.token);
    expect(result.status, 'GET /api/auth/clients deveria exigir admin').toBe(403);

    const ownFile = await getClientById(api, userA.token, userA.user.id);
    expect(ownFile.status, 'GET /api/auth/clients/:id deveria exigir admin').toBe(403);
  });

  test('cliente não deve consultar produtos inativos', async ({ api, userA }) => {
    const result = await getProducts(api, userA.token, true);
    expect(result.status).toBe(403);
  });

  test('listagem de profissionais para agendar não deve expor e-mail e telefone', async ({
    api,
    userA,
  }) => {
    const result = await getEmployees(api, userA.token);
    expect(result.status).toBe(200);
    const employees = result.body.data?.employees || [];
    expect(employees.length).toBeGreaterThan(0);
    for (const employee of employees) {
      expect(employee, `PII vazada em ${employee.name}`).not.toHaveProperty('email');
      expect(employee.phone).toBeFalsy();
    }
  });

  test('profissional não deveria usar o fluxo de cliente em /book', async ({
    page,
    professional,
  }) => {
    test.skip(!professional.token, 'Conta de profissional do seed não autenticou neste ambiente');
    await injectSession(page, professional.token, professional.user);
    await page.goto('/book');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/book/);
  });
});
