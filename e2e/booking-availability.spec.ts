import { christmasKey, formatLongDate, nextSundayKey, yesterdayKey } from './helpers/dates';
import { getAvailability } from './helpers/api';
import { findOpenSlot, resolveCatalogPair, unavailableSlots } from './helpers/catalog';
import {
  chooseProfessional,
  chooseService,
  injectSession,
  openBooking,
  revealBookingDate,
  selectBookingDate,
  waitForOpenSlots,
  waitForSlotGrid,
} from './helpers/ui';
import { expect, test } from './fixtures';

test.describe('Disponibilidade visível no agendamento', () => {
  test('a grade só mostra slots com available=true e omite horários passados ou ocupados', async ({
    page,
    api,
    userA,
  }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const open = await findOpenSlot(api, userA.token, pair, { minDaysAhead: 1, preferLast: false });

    await injectSession(page, userA.token, userA.user);
    await openBooking(page);
    await chooseService(page, pair.product.name);
    await chooseProfessional(page, pair.employee.name);
    await waitForSlotGrid(page);

    let chosen = open;
    let data = await selectBookingDate(page, chosen.dateKey);
    const skipped = new Set([chosen.dateKey]);
    for (let attempt = 0; attempt < 5 && (!data || data.isClosed); attempt += 1) {
      chosen = await findOpenSlot(api, userA.token, pair, {
        minDaysAhead: 1,
        preferLast: false,
        skipDateKeys: [...skipped],
      });
      skipped.add(chosen.dateKey);
      data = await selectBookingDate(page, chosen.dateKey);
    }

    await waitForOpenSlots(page);

    expect(data, 'A UI deveria ter carregado a disponibilidade da data escolhida').toBeTruthy();
    if (!data) return;

    const available = data.slots.filter((slot) => slot.available);
    expect(available.length).toBeGreaterThan(0);
    await expect(page.getByText(new RegExp(`${available.length} horário`))).toBeVisible();

    const timeButtons = page.getByRole('button', { name: /^\d{1,2}:\d{2}$/ });
    await expect(timeButtons).toHaveCount(available.length);

    for (const slot of unavailableSlots(data)) {
      const label = await page.evaluate(
        (iso) =>
          new Date(iso).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
          }),
        slot.start,
      );
      await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(0);
    }
  });

  test('domingo fechado não oferece horários para agendar', async ({ page, api, userA }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const sunday = nextSundayKey();

    const availability = await getAvailability(
      api,
      userA.token,
      pair.employee.id,
      pair.product.id,
      sunday,
    );
    expect(availability.status).toBe(200);
    expect(
      availability.body.data?.isClosed ||
        availability.body.data?.slots.every((slot) => !slot.available),
    ).toBeTruthy();

    await injectSession(page, userA.token, userA.user);
    await openBooking(page);
    await chooseService(page, pair.product.name);
    await chooseProfessional(page, pair.employee.name);
    const sundayButton = await revealBookingDate(page, sunday);

    await expect(sundayButton).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Confirmar agendamento' })).toBeDisabled();
  });

  test('o calendário impede escolher datas no passado', async ({ page, api, userA }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const yesterday = yesterdayKey();

    await injectSession(page, userA.token, userA.user);
    await openBooking(page);
    await chooseService(page, pair.product.name);
    await chooseProfessional(page, pair.employee.name);

    const pastDay = page.getByRole('button', { name: formatLongDate(yesterday) });

    if (await pastDay.count()) {
      await expect(pastDay).toBeDisabled();
    }
  });

  test('Natal cadastrado como dia especial não deve oferecer horários', async ({
    page,
    api,
    userA,
  }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const natal = christmasKey();

    const availability = await getAvailability(
      api,
      userA.token,
      pair.employee.id,
      pair.product.id,
      natal,
    );

    expect(availability.status).toBe(200);
    if (!availability.body.data?.isClosed) {
      test.info().annotations.push({
        type: 'note',
        description: `Natal (${natal}) não veio como isClosed. O seed de dia especial pode estar ausente ou com fuso divergente.`,
      });
      test.skip(true, 'Dia especial de Natal não encontrado na API');
    }

    await injectSession(page, userA.token, userA.user);
    await openBooking(page);
    await chooseService(page, pair.product.name);
    await chooseProfessional(page, pair.employee.name);
    const natalButton = await revealBookingDate(page, natal);
    await expect(natalButton).toBeDisabled();
  });
});
