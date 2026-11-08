import { uniqueAuthAccount } from './helpers/auth';
import { resolveCatalogPair } from './helpers/catalog';
import { addDays, formatLongDate, todayKey } from './helpers/dates';
import {
  chooseProfessional,
  chooseService,
  injectSession,
  openBooking,
  registerViaUi,
  revealBookingDate,
} from './helpers/ui';
import { expect, test } from './fixtures';

test.describe('Limites da reserva na interface (SEC-02)', () => {
  test('cadastro novo vê o aviso para confirmar o e-mail e pode reenviar o link', async ({
    page,
  }) => {
    const account = uniqueAuthAccount('ui-verify');
    await registerViaUi(page, { ...account, phone: '(11) 90000-0001' });

    const notice = page.getByTestId('email-verification-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(account.email.toLowerCase());

    await notice.getByRole('button', { name: 'Reenviar link' }).click();
    await expect(notice.getByRole('button', { name: 'Link enviado' })).toBeDisabled();

    await openBooking(page);
    await expect(page.getByTestId('email-verification-notice')).toBeVisible();
  });

  test('cliente confirmado não vê o aviso e o calendário vai só até 60 dias', async ({
    page,
    api,
    userA,
  }) => {
    const pair = await resolveCatalogPair(api, userA.token);
    const dayAfterLimit = addDays(todayKey(), 61);

    await injectSession(page, userA.token, userA.user);
    await openBooking(page);
    await expect(page.getByTestId('email-verification-notice')).toHaveCount(0);
    await chooseService(page, pair.product.name);
    await chooseProfessional(page, pair.employee.name);

    await revealBookingDate(page, dayAfterLimit);
    await expect(page.getByRole('button', { name: 'Próximo mês' })).toBeDisabled();

    // Se o dia seguinte ao limite cai no mês seguinte, ele nem aparece no calendário.
    const beyond = page.getByRole('button', { name: formatLongDate(dayAfterLimit) });
    if (await beyond.count()) {
      await expect(beyond).toBeDisabled();
    }
  });
});
