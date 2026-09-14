import { login } from './helpers/api';
import { ADMIN } from './helpers/env';
import { injectSession } from './helpers/ui';
import { expect, test } from './fixtures';

test.describe('Agenda por profissional no admin', () => {
  test('a tela de Horários permite personalizar expediente sem abrir outra página', async ({
    page,
    api,
  }) => {
    let session: Awaited<ReturnType<typeof login>>;
    try {
      session = await login(api, ADMIN.email, ADMIN.password);
    } catch {
      test.skip(true, 'Admin do seed indisponível para o teste de UI');
      return;
    }
    if (session.user.role !== 'ADMIN') {
      test.skip(true, 'A conta E2E_ADMIN não tem papel ADMIN');
      return;
    }

    await injectSession(page, session.token, session.user);
    await page.goto('/admin/schedule');
    await expect(page.getByRole('heading', { name: 'Horários e feriados' })).toBeVisible();

    await page.getByRole('button', { name: /Por profissional/i }).click();
    await expect(page.getByRole('heading', { name: 'Agenda por profissional' })).toBeVisible();
    await expect(page.getByText(/O padrão é o horário do estabelecimento/i)).toBeVisible();

    await page.getByRole('button', { name: /Marina Costa/i }).click();
    await expect(page.getByText(/Expediente de Marina Costa/)).toBeVisible();
    await expect(page.getByText(/Usando o horário do estabelecimento/)).toBeVisible();
    await expect(page.getByText('Personalizar')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Folgas e horários especiais' })).toBeVisible();
  });
});
