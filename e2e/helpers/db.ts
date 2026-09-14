import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { E2E_NOTE_PREFIX, USER_A, USER_B } from './env';
import { loadApiEnv } from './load-api-env';

const trackedEmails = new Set<string>();

/** Contas `e2e.auth.*` / `e2e.user.*` criadas pelos testes — nunca profissionais do seed. */
function isDisposableE2eEmail(email: string) {
  const value = email.trim().toLowerCase();
  return /^e2e\.(auth|user)\./.test(value);
}

export function trackE2eEmail(email: string) {
  const value = email.trim().toLowerCase();
  if (value) trackedEmails.add(value);
}

function takeTrackedEmails() {
  const emails = [...trackedEmails];
  trackedEmails.clear();
  return emails;
}

function reusableEmails() {
  return new Set([USER_A.email.trim().toLowerCase(), USER_B.email.trim().toLowerCase()]);
}

async function withPrisma<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
  loadApiEnv();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL não encontrada (apps/api/.env). Sem ela o E2E não consegue apagar os dados de teste.',
    );
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });
  try {
    return await fn(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function deleteAppointmentsForClients(prisma: PrismaClient, clientIds: string[]) {
  if (!clientIds.length) return;
  await prisma.appointment.deleteMany({ where: { clientId: { in: clientIds } } });
}

async function deleteUsersByIds(prisma: PrismaClient, userIds: string[]) {
  if (!userIds.length) return;
  await deleteAppointmentsForClients(prisma, userIds);
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

export async function hardDeleteAppointments(ids: string[]) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return;
  await withPrisma((prisma) => prisma.appointment.deleteMany({ where: { id: { in: uniqueIds } } }));
}

/** Recria USER_A/USER_B no banco sem passar pelo rate limit de cadastro da API. */
export async function ensureReusableE2eUsers() {
  const accounts = [USER_A, USER_B].filter((account) => isDisposableE2eEmail(account.email));
  if (!accounts.length) return;

  await withPrisma(async (prisma) => {
    for (const account of accounts) {
      await upsertE2eUser(prisma, account);
    }
  });
}

export async function insertE2eUser(account: { name: string; email: string; password: string }) {
  trackE2eEmail(account.email);
  await withPrisma((prisma) => upsertE2eUser(prisma, account));
}

async function upsertE2eUser(
  prisma: PrismaClient,
  account: { name: string; email: string; password: string },
) {
  const email = account.email.trim().toLowerCase();
  const password = await bcrypt.hash(account.password, 12);
  await prisma.user.upsert({
    where: { email },
    create: {
      name: account.name,
      email,
      password,
      phone: '(11) 90000-0001',
      role: 'USER',
    },
    update: {
      name: account.name,
      password,
      active: true,
    },
  });
}

/**
 * Remove lixo E2E do banco.
 * - `leftover`: agendamentos `[e2e]` e contas únicas (`e2e.auth.*`). Mantém USER_A/USER_B.
 * - `all`: também apaga USER_A/USER_B quando o e-mail é de teste.
 */
export async function sweepE2eDatabase(mode: 'leftover' | 'all') {
  const extraEmails = takeTrackedEmails();
  const keep = mode === 'leftover' ? reusableEmails() : new Set<string>();

  const result = await withPrisma(async (prisma) => {
    const marked = await prisma.appointment.deleteMany({
      where: { notes: { startsWith: E2E_NOTE_PREFIX } },
    });

    const candidates = await prisma.user.findMany({
      where: {
        OR: [
          { email: { startsWith: 'e2e.' } },
          ...(extraEmails.length ? [{ email: { in: extraEmails } }] : []),
        ],
      },
      select: { id: true, email: true },
    });

    const toDelete = candidates.filter((user) => {
      const email = user.email.toLowerCase();
      if (keep.has(email)) return false;
      return isDisposableE2eEmail(email) || extraEmails.includes(email);
    });

    await deleteUsersByIds(
      prisma,
      toDelete.map((user) => user.id),
    );

    return { appointments: marked.count, users: toDelete.length };
  });

  if (result.appointments || result.users) {
    console.log(
      `[e2e] hard delete (${mode}): ${result.users} conta(s), ${result.appointments} agendamento(s)`,
    );
  }

  return result;
}

type EmployeeHourRow = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
};

export async function snapshotEmployeeSchedule(employeeId: string) {
  return withPrisma(async (prisma) => ({
    hours: await prisma.employeeBusinessHour.findMany({ where: { employeeId } }),
    specialDays: await prisma.employeeSpecialDay.findMany({ where: { employeeId } }),
  }));
}

export async function restoreEmployeeSchedule(
  employeeId: string,
  snapshot: Awaited<ReturnType<typeof snapshotEmployeeSchedule>>,
) {
  await withPrisma(async (prisma) => {
    await prisma.employeeBusinessHour.deleteMany({ where: { employeeId } });
    await prisma.employeeSpecialDay.deleteMany({ where: { employeeId } });
    if (snapshot.hours.length) {
      await prisma.employeeBusinessHour.createMany({ data: snapshot.hours });
    }
    if (snapshot.specialDays.length) {
      await prisma.employeeSpecialDay.createMany({ data: snapshot.specialDays });
    }
  });
}

export async function replaceEmployeeHours(employeeId: string, hours: EmployeeHourRow[]) {
  await withPrisma(async (prisma) => {
    await prisma.employeeBusinessHour.deleteMany({ where: { employeeId } });
    if (hours.length) {
      await prisma.employeeBusinessHour.createMany({
        data: hours.map((hour) => ({ ...hour, employeeId })),
      });
    }
  });
}

export async function replaceEmployeeSpecialDays(
  employeeId: string,
  days: Array<{
    date: string;
    title: string;
    description?: string;
    isClosed: boolean;
    openTime?: string | null;
    closeTime?: string | null;
  }>,
) {
  await withPrisma(async (prisma) => {
    await prisma.employeeSpecialDay.deleteMany({ where: { employeeId } });
    if (days.length) {
      await prisma.employeeSpecialDay.createMany({
        data: days.map((day) => ({
          employeeId,
          date: new Date(`${day.date}T00:00:00.000Z`),
          title: day.title,
          description: day.description ?? null,
          isClosed: day.isClosed,
          openTime: day.openTime ?? null,
          closeTime: day.closeTime ?? null,
        })),
      });
    }
  });
}
