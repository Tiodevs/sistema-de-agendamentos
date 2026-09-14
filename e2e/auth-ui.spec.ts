import {
  FAKE_RESET_TOKEN,
  GENERIC_RESET_MESSAGE,
  RESET_TOKEN_STORAGE_KEY,
  createFreshClient,
  getMe,
  uniqueAuthAccount,
} from './helpers/auth';
import { USER_A } from './helpers/env';
import { injectSession, loginViaUi, logoutViaUi, registerViaUi, skipIntro } from './helpers/ui';
import { expect, test } from './fixtures';

test.describe('Fluxo de autenticação na interface', () => {
  test('cliente entra, persiste o JWT e chega na home', async ({ page, userA }) => {
    await loginViaUi(page, USER_A.email, USER_A.password);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: 'Menu do usuário' })).toBeVisible();

    const stored = await page.evaluate(() => ({
      token: localStorage.getItem('token'),
      user: localStorage.getItem('user'),
    }));
    expect(stored.token).toBeTruthy();
    expect(stored.token?.split('.').length).toBe(3);
    const profile = JSON.parse(stored.user || '{}') as { id?: string; role?: string };
    expect(profile.id).toBe(userA.user.id);
    expect(profile.role).toBe('USER');
  });

  test('senha errada permanece no login e não grava sessão', async ({ page, userA }) => {
    await skipIntro(page);
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(userA.user.email);
    await page.getByLabel('Senha', { exact: true }).fill('SenhaErrada@123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByText('E-mail ou senha inválidos')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  });

  test('campo de senha começa oculto e o botão revela o valor', async ({ page }) => {
    await skipIntro(page);
    await page.goto('/login');
    const field = page.locator('#password');
    await expect(field).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Mostrar senha' }).click();
    await expect(field).toHaveAttribute('type', 'text');
  });

  test('login aponta para cadastro e recuperação de senha', async ({ page }) => {
    await skipIntro(page);
    await page.goto('/login');
    await expect(page.getByRole('link', { name: 'Criar conta' })).toHaveAttribute(
      'href',
      '/register',
    );
    await expect(page.getByRole('link', { name: 'Esqueceu a senha?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  test('cadastro pela UI autentica e leva à home', async ({ page, api }) => {
    const account = uniqueAuthAccount('ui-reg');
    await registerViaUi(page, { ...account, phone: '(11) 90000-0001' });
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(page.getByRole('button', { name: 'Menu do usuário' })).toBeVisible();

    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
    const me = await getMe(api, token || undefined);
    expect(me.status).toBe(200);
    expect(me.body.data?.user.email).toBe(account.email.toLowerCase());
    expect(me.body.data?.user.role).toBe('USER');
  });

  test('cadastro mostra os requisitos da senha enquanto o usuário digita', async ({ page }) => {
    await skipIntro(page);
    await page.goto('/register');

    await expect(page.getByTestId('password-strength')).toHaveText('Comece a digitar');
    await expect(page.getByTestId('password-rule-length')).toHaveAttribute('data-met', 'false');
    await expect(page.getByTestId('password-match')).toHaveCount(0);

    const password = page.getByLabel('Senha', { exact: true });
    await password.fill('abcdefg');
    await expect(page.getByTestId('password-rule-length')).toHaveAttribute('data-met', 'false');
    await expect(page.getByTestId('password-strength')).toHaveText('Fraca');

    await password.fill('abcdefgh');
    await expect(page.getByTestId('password-rule-length')).toHaveAttribute('data-met', 'true');
    await expect(page.getByTestId('password-rule-uppercase')).toHaveAttribute('data-met', 'false');

    await password.fill('Abcdefgh');
    await expect(page.getByTestId('password-rule-uppercase')).toHaveAttribute('data-met', 'true');
    await expect(page.getByTestId('password-strength')).toHaveText('Quase lá');

    await password.fill('Abcdefg!');
    await expect(page.getByTestId('password-rule-special')).toHaveAttribute('data-met', 'true');
    await expect(page.getByTestId('password-strength')).toHaveText('Pronto');

    await page.getByLabel('Confirmar senha').fill('Abcdefg?');
    await expect(page.getByTestId('password-match')).toHaveText('Ainda não coincidem');
    await page.getByLabel('Confirmar senha').fill('Abcdefg!');
    await expect(page.getByTestId('password-match')).toHaveAttribute('data-met', 'true');
    await expect(page.getByTestId('password-match')).toHaveText('Senhas iguais');
  });

  test('cadastro recusa senhas diferentes sem chamar a API', async ({ page }) => {
    await skipIntro(page);
    await page.goto('/register');
    let registerCalled = false;
    page.on('request', (request) => {
      if (request.url().includes('/api/auth/register')) registerCalled = true;
    });
    await page.getByLabel('Nome completo').fill('E2E Senha Diferente');
    await page.getByLabel('E-mail').fill(uniqueAuthAccount('mismatch').email);
    await page.getByLabel('Senha', { exact: true }).fill('Senha@1234');
    await page.getByLabel('Confirmar senha').fill('Senha@9999');
    await page.getByRole('button', { name: 'Criar conta' }).click();

    await expect(page.getByText('As senhas não coincidem')).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
    expect(registerCalled).toBe(false);
  });

  test('quem já está logado não permanece na tela de login', async ({ page, userA }) => {
    await injectSession(page, userA.token, userA.user);
    await page.goto('/login');
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Menu do usuário' })).toBeVisible();
  });

  test('rotas autenticadas redirecionam visitante para o login', async ({ page }) => {
    await skipIntro(page);
    await page.goto('/appointments');
    await page.waitForURL(/\/login/, { timeout: 20_000 });

    await page.goto('/admin');
    await page.waitForURL(/\/login/, { timeout: 20_000 });

    await page.goto('/professional');
    await page.waitForURL(/\/login/, { timeout: 20_000 });
  });

  test('cliente autenticado não fica nas áreas admin ou profissional', async ({ page, userA }) => {
    await injectSession(page, userA.token, userA.user);

    await page.goto('/admin');
    await page.waitForURL((url) => !url.pathname.startsWith('/admin'), { timeout: 20_000 });
    await expect(page).not.toHaveURL(/\/admin/);

    await page.goto('/professional');
    await page.waitForURL((url) => !url.pathname.startsWith('/professional'), { timeout: 20_000 });
    await expect(page).not.toHaveURL(/\/professional/);
  });

  test('sair limpa o localStorage, invalida o JWT e impede voltar pela história', async ({
    page,
    api,
  }) => {
    const { account, token } = await createFreshClient(api, 'ui-logout');
    await loginViaUi(page, account.email, account.password);
    await logoutViaUi(page);
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('user'))).toBeNull();

    const oldSession = await getMe(api, token);
    expect(oldSession.status).toBe(401);

    await page.goto('/appointments');
    await page.waitForURL(/\/login/, { timeout: 20_000 });
  });
});

test.describe('Recuperação de senha na interface', () => {
  test('pedido de recuperação mostra a mensagem genérica', async ({ page, userA }) => {
    await skipIntro(page);
    await page.goto('/forgot-password');
    await page.getByLabel('E-mail').fill(userA.user.email);
    await page.getByRole('button', { name: 'Enviar link' }).click();
    await expect(page.getByText(GENERIC_RESET_MESSAGE)).toBeVisible();
    await expect(page.getByText(/expira em 30 minutos/i)).toBeVisible();
  });

  test('reset sem token avisa link inválido', async ({ page }) => {
    await skipIntro(page);
    await page.goto('/reset-password');
    await expect(page.getByRole('heading', { name: 'Link inválido' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Pedir novo link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  test('confirmação de e-mail sem token avisa link inválido', async ({ page }) => {
    await skipIntro(page);
    await page.goto('/confirm-email');
    await expect(page.getByRole('heading', { name: 'Link inválido' })).toBeVisible();
  });

  test('token some da URL, não fica no storage e um valor inventado é recusado', async ({
    page,
  }) => {
    await skipIntro(page);
    await page.goto(`/reset-password#token=${FAKE_RESET_TOKEN}`);
    await expect(page.getByRole('heading', { name: 'Nova senha' })).toBeVisible();
    await expect(page).toHaveURL(/\/reset-password$/);
    expect(page.url()).not.toContain('token=');
    expect(
      await page.evaluate((key) => sessionStorage.getItem(key), RESET_TOKEN_STORAGE_KEY),
    ).toBeNull();

    await page.getByLabel('Nova senha').fill('NovaSenha@123');
    await page.getByLabel('Confirmar senha').fill('NovaSenha@123');
    await page.getByRole('button', { name: 'Redefinir senha' }).click();
    await expect(page.getByText(/inválido ou expirado/i)).toBeVisible();
  });

  test('link antigo com token na query também some da URL', async ({ page }) => {
    await skipIntro(page);
    await page.goto(`/reset-password?token=${FAKE_RESET_TOKEN}`);
    await expect(page.getByRole('heading', { name: 'Nova senha' })).toBeVisible();
    await expect(page).toHaveURL(/\/reset-password$/);
    expect(page.url()).not.toContain('token=');
  });

  test('login?reset=1 avisa que a senha foi redefinida', async ({ page }) => {
    await skipIntro(page);
    await page.goto('/login?reset=1');
    await expect(page.getByText('Senha redefinida. Entre com a nova senha.')).toBeVisible();
  });
});

test.describe('Troca de senha no perfil', () => {
  test('cliente troca a senha na UI e a sessão antiga deixa de valer', async ({ page, api }) => {
    const { account } = await createFreshClient(api, 'ui-pwd');
    await loginViaUi(page, account.email, account.password);
    const previousToken = await page.evaluate(() => localStorage.getItem('token'));
    expect(previousToken).toBeTruthy();

    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Perfil' })).toBeVisible();
    await expect(page.locator('#confirm-new-password')).toBeVisible();

    const nextPassword = `${account.password}Z`;
    await page.locator('#current-password').fill(account.password);
    await page.locator('#new-password').fill(nextPassword);
    await page.locator('#confirm-new-password').fill(nextPassword);
    await page.getByRole('button', { name: 'Atualizar senha' }).click();
    await expect(page.getByText(/senha atualizada/i)).toBeVisible({ timeout: 15_000 });

    const oldSession = await getMe(api, previousToken || undefined);
    expect(oldSession.status).toBe(401);

    const storedToken = await page.evaluate(() => localStorage.getItem('token'));
    expect(storedToken).toBeTruthy();
    expect(storedToken).not.toBe(previousToken);
    const me = await getMe(api, storedToken || undefined);
    expect(me.status).toBe(200);
  });
});
