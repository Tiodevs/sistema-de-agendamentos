import { expect, type Page } from '@playwright/test';
import { INTRO_STORAGE_KEY } from './env';
import type { AuthUser, Availability } from './api';
import { formatLongDate, formatSlotTime, parseDateKey, todayKey } from './dates';

export async function skipIntro(page: Page) {
  await page.addInitScript((key) => {
    try {
      sessionStorage.setItem(key, '1');
    } catch {
      // ignore
    }
  }, INTRO_STORAGE_KEY);
}

export async function injectSession(page: Page, token: string, user: AuthUser) {
  await page.addInitScript(
    ({ authToken, profile, introKey }) => {
      try {
        localStorage.setItem('token', authToken);
        localStorage.setItem('user', JSON.stringify(profile));
        sessionStorage.setItem(introKey, '1');
      } catch {
        // ignore
      }
    },
    { authToken: token, profile: user, introKey: INTRO_STORAGE_KEY },
  );
}

export async function loginViaUi(page: Page, email: string, password: string) {
  await skipIntro(page);
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}

export async function registerViaUi(
  page: Page,
  account: { name: string; email: string; password: string; phone?: string },
) {
  await skipIntro(page);
  await page.goto('/register');
  await page.getByLabel('Nome completo').fill(account.name);
  await page.getByLabel('E-mail').fill(account.email);
  if (account.phone) await page.getByLabel(/Telefone/).fill(account.phone);
  await page.getByLabel('Senha', { exact: true }).fill(account.password);
  await page.getByLabel('Confirmar senha').fill(account.password);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/register'), { timeout: 20_000 });
}

export async function logoutViaUi(page: Page) {
  await page.getByRole('button', { name: 'Menu do usuário' }).click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await page.waitForURL('**/login', { timeout: 20_000 });
}

export async function openBooking(page: Page) {
  await page.goto('/book');
  await page.getByRole('heading', { name: 'Novo agendamento' }).waitFor({ timeout: 20_000 });
}

export async function chooseService(page: Page, name: string) {
  await page.getByText(name, { exact: true }).click();
  await page.getByRole('button', { name: 'Próximo' }).click();
  await page.getByRole('heading', { name: 'Escolha o profissional' }).waitFor();
}

export async function chooseProfessional(page: Page, name: string) {
  await page.getByText(name, { exact: true }).click();
  await page.getByRole('button', { name: 'Próximo' }).click();
  await page.getByRole('heading', { name: 'Data e horário' }).waitFor();
}

export async function revealBookingDate(page: Page, dateKey: string) {
  const currentMonth = parseDateKey(todayKey()).month;
  const target = parseDateKey(dateKey);
  const monthDiff =
    target.year * 12 + target.month - (parseDateKey(todayKey()).year * 12 + currentMonth);

  for (let i = 0; i < monthDiff; i += 1) {
    const next = page.getByRole('button', { name: 'Próximo mês' });
    if (await next.isEnabled()) await next.click();
  }

  return page.getByRole('button', { name: formatLongDate(dateKey) });
}

export async function selectBookingDate(page: Page, dateKey: string) {
  const labeled = await revealBookingDate(page, dateKey);
  await expect(labeled).toBeVisible();

  if ((await labeled.getAttribute('aria-pressed')) === 'true') {
    return undefined;
  }

  const pending = page.waitForResponse(
    (response) => {
      try {
        const url = new URL(response.url());
        return (
          response.ok() &&
          url.pathname.includes('/appointments/availability') &&
          url.searchParams.get('date') === dateKey
        );
      } catch {
        return false;
      }
    },
    { timeout: 15_000 },
  );

  await labeled.click();
  const response = await pending;
  const payload = (await response.json()) as { data?: Availability };
  return payload.data;
}

export async function chooseSlot(page: Page, isoStart: string) {
  const label = formatSlotTime(isoStart);
  await page.getByRole('button', { name: label, exact: true }).click();
}

export async function waitForSlotGrid(page: Page) {
  await expect(
    page.getByText(/Fechado neste dia|Nenhum horário disponível|\d+ horário/),
  ).toBeVisible({ timeout: 15_000 });
}

export async function waitForOpenSlots(page: Page) {
  await expect(page.getByText('Fechado neste dia')).toHaveCount(0);
  await expect(page.getByText(/\d+ horário/)).toBeVisible({ timeout: 15_000 });
}

export async function confirmBooking(page: Page) {
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click();
  await page.waitForURL('**/appointments', { timeout: 20_000 });
}
