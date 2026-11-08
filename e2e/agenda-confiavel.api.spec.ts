import { randomBytes } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import {
  apiJson,
  cancelAppointment,
  e2eNote,
  getAppointmentById,
  getEmployees,
  getMyAppointments,
  login,
} from './helpers/api';
import { bookTracked, findOpenSlot, resolveCatalogPair } from './helpers/catalog';
import {
  hardDeleteAppointments,
  insertAppointmentDirectly,
  insertEmployeeInvite,
  setUserRole,
} from './helpers/db';
import { ADMIN, E2E_NOTE_PREFIX, USER_B } from './helpers/env';
import { expect, test } from './fixtures';

/**
 * Fase 1 da auditoria (agenda confiável): máquina de estados, prazo de cancelamento, mudanças
 * de expediente que cuidam do que já está marcado, exclusões que não quebram e convite do
 * profissional. Roda contra o Docker; os testes de admin pulam sem SEED_PASSWORD.
 */

type StatusAppointment = {
  id: string;
  status: string;
  allowedStatuses?: string[];
  cancellableUntil?: string;
};

type Affected = { id: string };

async function adminToken(api: APIRequestContext) {
  if (!ADMIN.password) return '';
  try {
    return (await login(api, ADMIN.email, ADMIN.password)).token;
  } catch {
    return '';
  }
}

function affectedIds(details: Record<string, unknown> | undefined) {
  const list = (details?.appointments ?? []) as Affected[];
  return list.map((item) => item.id);
}

test.describe('Agenda confiável (Fase 1)', () => {
  test('status final, cedo demais e desfazer; agendamento não se exclui (DOM-01, DOM-04, UX-06)', async ({
    api,
    userA,
  }) => {
    const token = await adminToken(api);
    test.skip(!token, 'Sem a senha do admin (SEED_PASSWORD ou E2E_ADMIN_PASSWORD).');

    const pair = await resolveCatalogPair(api, userA.token);
    const open = await findOpenSlot(api, userA.token, pair);
    const created = await bookTracked(
      api,
      userA.token,
      {
        productId: pair.product.id,
        employeeId: pair.employee.id,
        date: open.slot.start,
        notes: e2eNote('maquina-de-estados'),
      },
      userA.createdIds,
    );
    expect(created.status).toBe(201);
    const id = created.body.data?.appointment.id as string;

    const list = await apiJson<{ appointments: StatusAppointment[] }>(
      api,
      'GET',
      `/api/appointments?from=${open.dateKey}&to=${open.dateKey}`,
      { token },
    );
    const row = list.body.data?.appointments.find((item) => item.id === id);
    expect(row?.allowedStatuses).toEqual(['CONFIRMED', 'CANCELLED']);

    const early = await apiJson(api, 'PATCH', `/api/appointments/${id}/status`, {
      token,
      data: { status: 'COMPLETED' },
    });
    expect(early.status).toBe(409);
    expect(early.body.code).toBe('TOO_EARLY');

    const confirmed = await apiJson<{ appointment: StatusAppointment; undoUntil: string | null }>(
      api,
      'PATCH',
      `/api/appointments/${id}/status`,
      { token, data: { status: 'CONFIRMED' } },
    );
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data?.appointment.status).toBe('CONFIRMED');
    expect(confirmed.body.data?.undoUntil).toBeTruthy();

    const undone = await apiJson<{ appointment: StatusAppointment }>(
      api,
      'POST',
      `/api/appointments/${id}/status/undo`,
      { token },
    );
    expect(undone.status).toBe(200);
    expect(undone.body.data?.appointment.status).toBe('SCHEDULED');

    const cancelled = await apiJson<{ appointment: StatusAppointment; undoUntil: string | null }>(
      api,
      'PATCH',
      `/api/appointments/${id}/status`,
      { token, data: { status: 'CANCELLED' } },
    );
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data?.undoUntil).toBeNull();

    const reactivate = await apiJson(api, 'PATCH', `/api/appointments/${id}/status`, {
      token,
      data: { status: 'CONFIRMED' },
    });
    expect(reactivate.status).toBe(409);
    expect(reactivate.body.code).toBe('FINAL_STATUS');

    const undoCancel = await apiJson(api, 'POST', `/api/appointments/${id}/status/undo`, { token });
    expect(undoCancel.status).toBe(409);

    const removed = await apiJson(api, 'DELETE', `/api/appointments/${id}`, { token });
    expect(removed.status).toBe(409);
    expect(removed.body.code).toBe('APPOINTMENT_DELETE_DISABLED');
  });

  test('cliente não cancela em cima da hora e vê até quando pode (DOM-09)', async ({
    api,
    userA,
  }) => {
    const pair = await resolveCatalogPair(api, userA.token);

    // Direto no banco: um horário daqui a pouco mais de 1h, sem depender do expediente de agora.
    let appointmentId = '';
    for (const offset of [61, 74, 88, 97, 109]) {
      const date = new Date(Date.now() + offset * 60_000);
      try {
        const row = await insertAppointmentDirectly({
          clientId: userA.user.id,
          employeeId: pair.employee.id,
          productId: pair.product.id,
          date,
          endDate: new Date(date.getTime() + 5 * 60_000),
          notes: e2eNote('cancelar-em-cima-da-hora'),
        });
        appointmentId = row.id;
        break;
      } catch {
        // Sobrepôs outro horário do profissional: tenta o próximo.
      }
    }
    test.skip(!appointmentId, 'Sem espaço livre na próxima hora para montar o cenário.');
    userA.createdIds.push(appointmentId);

    const mine = await getMyAppointments(api, userA.token);
    const row = mine.body.data?.appointments.find((item) => item.id === appointmentId) as
      | StatusAppointment
      | undefined;
    expect(row?.allowedStatuses).toEqual([]);
    expect(row?.cancellableUntil).toBeTruthy();

    const result = await cancelAppointment(api, userA.token, appointmentId);
    expect(result.status).toBe(409);
    expect(result.body.code).toBe('CANCELLATION_WINDOW_CLOSED');
  });

  test('profissional confirma e cancela pelo painel, mas não conclui antes do horário (DOM-03)', async ({
    api,
    userA,
    professional,
  }) => {
    test.skip(
      !professional.token || !professional.user.employeeId,
      'Sem a conta da profissional do seed (SEED_PASSWORD ou E2E_PROFESSIONAL_PASSWORD).',
    );

    const employees = await getEmployees(api, userA.token);
    const employee = employees.body.data?.employees.find(
      (item) => item.id === professional.user.employeeId,
    );
    const product = employee?.products.find((item) => item.product.active)?.product;
    test.skip(!employee || !product, 'A profissional do seed não atende nenhum serviço ativo.');

    const pair = {
      employee: employee!,
      product: { ...product!, description: null },
    };
    const open = await findOpenSlot(api, userA.token, pair);
    const created = await bookTracked(
      api,
      userA.token,
      {
        productId: pair.product.id,
        employeeId: pair.employee.id,
        date: open.slot.start,
        notes: e2eNote('profissional-status'),
      },
      userA.createdIds,
    );
    expect(created.status).toBe(201);
    const id = created.body.data?.appointment.id as string;

    const path = `/api/professional/appointments/${id}/status`;
    const early = await apiJson(api, 'PATCH', path, {
      token: professional.token,
      data: { status: 'NO_SHOW' },
    });
    expect(early.status).toBe(409);
    expect(early.body.code).toBe('TOO_EARLY');

    const confirmed = await apiJson<{ appointment: StatusAppointment }>(api, 'PATCH', path, {
      token: professional.token,
      data: { status: 'CONFIRMED' },
    });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data?.appointment.allowedStatuses).toEqual(['CANCELLED']);

    const cancelled = await apiJson<{ appointment: StatusAppointment }>(api, 'PATCH', path, {
      token: professional.token,
      data: { status: 'CANCELLED' },
    });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data?.appointment.status).toBe('CANCELLED');

    const seen = await getAppointmentById(api, userA.token, id);
    expect(seen.body.data?.appointment.status).toBe('CANCELLED');
  });

  test('fechar um dia com horário marcado pede decisão e cancela avisando (DOM-02)', async ({
    api,
    userA,
  }) => {
    const token = await adminToken(api);
    test.skip(!token, 'Sem a senha do admin (SEED_PASSWORD ou E2E_ADMIN_PASSWORD).');

    const pair = await resolveCatalogPair(api, userA.token);
    const open = await findOpenSlot(api, userA.token, pair, { minDaysAhead: 30 });
    const created = await bookTracked(
      api,
      userA.token,
      {
        productId: pair.product.id,
        employeeId: pair.employee.id,
        date: open.slot.start,
        notes: e2eNote('dia-fechado'),
      },
      userA.createdIds,
    );
    expect(created.status).toBe(201);
    const id = created.body.data?.appointment.id as string;

    const payload = { date: open.dateKey, title: `${E2E_NOTE_PREFIX} Dia fechado`, isClosed: true };
    const ask = await apiJson(api, 'POST', '/api/schedule/special-days', { token, data: payload });
    expect(ask.status).toBe(409);
    expect(ask.body.code).toBe('AFFECTED_APPOINTMENTS');
    const ids = affectedIds(ask.body.details);
    expect(ids).toContain(id);

    // Só cancela se todos os afetados forem do teste: nunca mexe em dado do seed.
    const onlyOurs = ids.every((value) => userA.createdIds.includes(value));
    const decision = onlyOurs ? 'cancel' : 'keep';
    const saved = await apiJson<{
      day: { id: string };
      impact: { affected: number; cancelled: number };
    }>(api, 'POST', `/api/schedule/special-days?onAffected=${decision}`, { token, data: payload });

    try {
      expect(saved.status).toBe(201);
      expect(saved.body.data?.impact.affected).toBe(ids.length);
      if (onlyOurs) {
        expect(saved.body.data?.impact.cancelled).toBe(ids.length);
        const after = await getAppointmentById(api, userA.token, id);
        expect(after.body.data?.appointment.status).toBe('CANCELLED');
      } else {
        test.info().annotations.push({
          type: 'note',
          description: 'Havia outros agendamentos no dia: o teste manteve todos (onAffected=keep).',
        });
      }
    } finally {
      const dayId = saved.body.data?.day.id;
      if (dayId) {
        await apiJson(api, 'DELETE', `/api/schedule/special-days/${dayId}?onAffected=keep`, {
          token,
        });
      }
    }
  });

  test('profissional com horário marcado: desativar pede decisão e, com histórico, não exclui (DOM-02, DOM-04)', async ({
    api,
    userA,
  }) => {
    const token = await adminToken(api);
    test.skip(!token, 'Sem a senha do admin (SEED_PASSWORD ou E2E_ADMIN_PASSWORD).');

    const pair = await resolveCatalogPair(api, userA.token);
    const email = `e2e.employee.${randomBytes(4).toString('hex')}@leemia.dev`;
    const created = await apiJson<{ employee: { id: string; access?: { status: string } } }>(
      api,
      'POST',
      '/api/employees',
      { token, data: { name: 'E2E Profissional Temporário', email } },
    );
    expect(created.status).toBe(201);
    const employeeId = created.body.data?.employee.id as string;
    expect(created.body.data?.employee.access?.status).toBe('pending');

    try {
      const assigned = await apiJson(api, 'PUT', `/api/employees/${employeeId}/products`, {
        token,
        data: { productIds: [pair.product.id] },
      });
      expect(assigned.status).toBe(200);

      const tempPair = {
        product: pair.product,
        employee: {
          id: employeeId,
          name: 'E2E Profissional Temporário',
          active: true,
          products: [],
        },
      };
      const open = await findOpenSlot(api, userA.token, tempPair);
      const booked = await bookTracked(
        api,
        userA.token,
        {
          productId: pair.product.id,
          employeeId,
          date: open.slot.start,
          notes: e2eNote('profissional-temporario'),
        },
        userA.createdIds,
      );
      expect(booked.status).toBe(201);
      const bookedId = booked.body.data?.appointment.id as string;

      const ask = await apiJson(api, 'PATCH', `/api/employees/${employeeId}/toggle`, { token });
      expect(ask.status).toBe(409);
      expect(ask.body.code).toBe('AFFECTED_APPOINTMENTS');
      expect(affectedIds(ask.body.details)).toEqual([bookedId]);

      const deactivated = await apiJson<{
        employee: { active: boolean };
        impact: { cancelled: number };
      }>(api, 'PATCH', `/api/employees/${employeeId}/toggle?onAffected=cancel`, { token });
      expect(deactivated.status).toBe(200);
      expect(deactivated.body.data?.employee.active).toBe(false);
      expect(deactivated.body.data?.impact.cancelled).toBe(1);

      const after = await getAppointmentById(api, userA.token, bookedId);
      expect(after.body.data?.appointment.status).toBe('CANCELLED');

      const blocked = await apiJson(api, 'DELETE', `/api/employees/${employeeId}`, { token });
      expect(blocked.status).toBe(409);
      expect(blocked.body.code).toBe('HAS_APPOINTMENTS');
    } finally {
      await hardDeleteAppointments(userA.createdIds.splice(0));
      const removed = await apiJson(api, 'DELETE', `/api/employees/${employeeId}`, { token });
      expect(removed.status).toBe(200);
    }
  });

  test('convite: cadastrar com o e-mail de um cliente não promove; aceitar com a senha liga (SEC-03)', async ({
    api,
    userB,
  }) => {
    const token = await adminToken(api);
    test.skip(!token, 'Sem a senha do admin (SEED_PASSWORD ou E2E_ADMIN_PASSWORD).');
    expect(userB.user.role).toBe('USER');

    const created = await apiJson<{ employee: { id: string; access?: { status: string } } }>(
      api,
      'POST',
      '/api/employees',
      { token, data: { name: 'E2E Convite', email: USER_B.email } },
    );
    expect(created.status).toBe(201);
    const employeeId = created.body.data?.employee.id as string;

    try {
      expect(created.body.data?.employee.access?.status).toBe('pending');
      const before = await login(api, USER_B.email, USER_B.password);
      expect(before.user.role).toBe('USER');
      expect(before.user.employeeId).toBeNull();

      const inviteToken = randomBytes(32).toString('base64url');
      await insertEmployeeInvite({ employeeId, email: USER_B.email, token: inviteToken });

      const preview = await apiJson<{ invite: { email: string; accountExists: boolean } }>(
        api,
        'POST',
        '/api/auth/invites/preview',
        { data: { token: inviteToken } },
      );
      expect(preview.status).toBe(200);
      expect(preview.body.data?.invite.accountExists).toBe(true);

      const noPassword = await apiJson(api, 'POST', '/api/auth/invites/accept', {
        data: { token: inviteToken },
      });
      expect(noPassword.status).toBe(401);
      expect(noPassword.body.code).toBe('PASSWORD_REQUIRED');

      const wrong = await apiJson(api, 'POST', '/api/auth/invites/accept', {
        data: { token: inviteToken, password: 'Senha@Errada1' },
      });
      expect(wrong.status).toBe(401);

      const accepted = await apiJson<{
        user: { role: string; employeeId: string | null };
        token: string;
      }>(api, 'POST', '/api/auth/invites/accept', {
        data: { token: inviteToken, password: USER_B.password },
      });
      expect(accepted.status).toBe(200);
      expect(accepted.body.data?.user.role).toBe('EMPLOYEE');
      expect(accepted.body.data?.user.employeeId).toBe(employeeId);

      const reused = await apiJson(api, 'POST', '/api/auth/invites/accept', {
        data: { token: inviteToken, password: USER_B.password },
      });
      expect(reused.status).toBe(400);

      const panel = await apiJson(api, 'GET', '/api/professional/appointments', {
        token: accepted.body.data?.token,
      });
      expect(panel.status).toBe(200);
    } finally {
      await apiJson(api, 'DELETE', `/api/employees/${employeeId}/access`, { token });
      await apiJson(api, 'DELETE', `/api/employees/${employeeId}`, { token });
      await setUserRole(USER_B.email, 'USER');
    }
  });
});
