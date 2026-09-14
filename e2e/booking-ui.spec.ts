import { e2eNote, getMyAppointments } from './helpers/api';
import { bookTracked, findOpenSlot, resolveCatalogPair } from './helpers/catalog';
import { USER_A } from './helpers/env';
import {
  chooseProfessional,
  chooseService,
  chooseSlot,
  confirmBooking,
  injectSession,
  loginViaUi,
  openBooking,
  selectBookingDate,
  waitForOpenSlots,
  waitForSlotGrid,
} from './helpers/ui';
import { expect, test } from './fixtures';

test.describe('Fluxo de agendamento na interface', () => {
  test('cliente autentica, agenda um horário livre e vê o compromisso na lista', async ({
    page,
    api,
    userA,
  }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const open = await findOpenSlot(api, userA.token, pair);
    const note = e2eNote('ui-agendar');

    await loginViaUi(page, USER_A.email, USER_A.password);
    await openBooking(page);

    await expect(page.getByRole('button', { name: 'Próximo' })).toBeDisabled();
    await chooseService(page, pair.product.name);
    await chooseProfessional(page, pair.employee.name);

    await waitForSlotGrid(page);
    await selectBookingDate(page, open.dateKey);
    await waitForOpenSlots(page);

    await expect(page.getByRole('button', { name: 'Confirmar agendamento' })).toBeDisabled();
    await chooseSlot(page, open.slot.start);
    await page.getByLabel(/Observações/i).fill(note);
    await confirmBooking(page);

    await expect(page.getByRole('heading', { name: 'Meus agendamentos' })).toBeVisible();
    await expect(page.getByText(pair.product.name).first()).toBeVisible();
    await expect(page.getByText(note)).toBeVisible();

    const mine = await getMyAppointments(api, userA.token);
    const created = mine.body.data?.appointments.find((appointment) => appointment.notes === note);
    expect(created, 'Agendamento criado pelo fluxo da UI deveria aparecer em /my').toBeTruthy();
    if (created) userA.createdIds.push(created.id);
  });

  test('não é possível confirmar sem escolher um horário disponível', async ({
    page,
    api,
    userA,
  }) => {
    const pair = await resolveCatalogPair(api, userA.token);

    await loginViaUi(page, USER_A.email, USER_A.password);
    await openBooking(page);
    await chooseService(page, pair.product.name);
    await chooseProfessional(page, pair.employee.name);

    await waitForSlotGrid(page);
    await expect(page.getByRole('button', { name: 'Confirmar agendamento' })).toBeDisabled();
  });

  test('horário ocupado some da grade e o segundo cliente não consegue escolhê-lo', async ({
    page,
    api,
    userA,
    userB,
  }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const open = await findOpenSlot(api, userA.token, pair);
    const note = e2eNote('ui-ocupado');

    const booked = await bookTracked(
      api,
      userA.token,
      {
        productId: pair.product.id,
        employeeId: pair.employee.id,
        date: open.slot.start,
        notes: note,
      },
      userA.createdIds,
    );
    expect(booked.status).toBe(201);

    await injectSession(page, userB.token, userB.user);
    await openBooking(page);
    await chooseService(page, pair.product.name);
    await chooseProfessional(page, pair.employee.name);
    await waitForSlotGrid(page);
    await selectBookingDate(page, open.dateKey);
    await waitForOpenSlots(page);

    const takenLabel = new Date(open.slot.start).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
    await expect(page.getByRole('button', { name: takenLabel, exact: true })).toHaveCount(0);
  });
});
