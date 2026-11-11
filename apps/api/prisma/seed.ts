import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/database';
import { assertDisposableDatabase } from '../src/lib/database-guard';

const SEED_NOTE = '[seed]';

/** Senha das contas fictícias. Sem SEED_PASSWORD, cada execução gera uma nova e a mostra no fim. */
const PASSWORD_FROM_ENV = process.env.SEED_PASSWORD?.trim();
const SEED_PASSWORD = PASSWORD_FROM_ENV || `Seed-${randomBytes(9).toString('base64url')}!`;

const DEFAULT_ADMIN = { name: 'Admin Leemia', email: 'admin@leemia.dev' };
const DEFAULT_CLIENT = {
  name: 'Cliente Leemia',
  email: 'cliente@leemia.dev',
  phone: '(11) 97777-2000',
};

/** Opcional: promover uma conta que você já cadastrou. Ela mantém nome e senha. */
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() || DEFAULT_ADMIN.email;
const CLIENT_EMAIL = process.env.SEED_CLIENT_EMAIL?.trim().toLowerCase() || DEFAULT_CLIENT.email;

const DEFAULT_HOURS = [
  { dayOfWeek: 0, openTime: '08:00', closeTime: '18:00', isClosed: true },
  { dayOfWeek: 1, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 2, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 3, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 4, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 5, openTime: '08:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 6, openTime: '08:00', closeTime: '12:00', isClosed: false },
];

const PRODUCTS = [
  {
    name: 'Corte masculino',
    description: 'Corte clássico ou degradê, com finalização.',
    price: 80,
    duration: 45,
  },
  {
    name: 'Barba',
    description: 'Aparar, desenho e toalha quente.',
    price: 50,
    duration: 30,
  },
  {
    name: 'Corte + barba',
    description: 'Combo completo de corte e barba.',
    price: 120,
    duration: 75,
  },
  {
    name: 'Hidratação',
    description: 'Tratamento hidratante para fios.',
    price: 90,
    duration: 60,
  },
  {
    name: 'Design de sobrancelha',
    description: 'Modelagem e finalização das sobrancelhas.',
    price: 40,
    duration: 20,
  },
  {
    name: 'Relaxamento capilar',
    description: 'Massagem e relaxamento do couro cabeludo.',
    price: 110,
    duration: 50,
  },
] as const;

const PROFESSIONALS = [
  {
    name: 'Marina Costa',
    email: 'marina.costa@leemia.dev',
    phone: '(11) 98888-1001',
    products: ['Corte masculino', 'Corte + barba', 'Hidratação'],
  },
  {
    name: 'Rafael Souza',
    email: 'rafael.souza@leemia.dev',
    phone: '(11) 98888-1002',
    products: ['Corte masculino', 'Barba', 'Corte + barba'],
  },
  {
    name: 'Ana Oliveira',
    email: 'ana.oliveira@leemia.dev',
    phone: '(11) 98888-1003',
    products: ['Hidratação', 'Design de sobrancelha', 'Relaxamento capilar'],
  },
] as const;

const EXTRA_CLIENTS = [
  { name: 'Camila Rocha', email: 'camila.rocha@leemia.dev', phone: '(11) 97777-2001' },
  { name: 'Bruno Almeida', email: 'bruno.almeida@leemia.dev', phone: '(11) 97777-2002' },
  { name: 'Juliana Martins', email: 'juliana.martins@leemia.dev', phone: '(11) 97777-2003' },
] as const;

function atDays(daysFromToday: number, hour: number, minute: number): Date {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function isOpenDay(date: Date): boolean {
  const day = date.getDay();
  const hour = date.getHours() + date.getMinutes() / 60;
  if (day === 0) return false;
  if (day === 6) return hour >= 8 && hour < 12;
  return hour >= 8 && hour < 18;
}

/**
 * Cria a conta ou a devolve ao estado do seed. Uma conta real (`fictitious: false`) só ganha
 * papel, fica ativa e confirmada: nome, telefone e senha não mudam.
 */
async function upsertUser(
  passwordHash: string,
  data: {
    name: string;
    email: string;
    phone?: string | null;
    role: 'USER' | 'ADMIN' | 'EMPLOYEE';
    fictitious: boolean;
  },
) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });

  if (!existing) {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        role: data.role,
        password: passwordHash,
        emailVerifiedAt: new Date(),
      },
    });
  }

  return prisma.user.update({
    where: { id: existing.id },
    data: {
      role: data.role,
      active: true,
      emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
      ...(data.fictitious
        ? { name: data.name, phone: data.phone ?? existing.phone, password: passwordHash }
        : {}),
    },
  });
}

async function upsertProduct(data: (typeof PRODUCTS)[number]) {
  const existing = await prisma.product.findFirst({ where: { name: data.name } });
  if (!existing) {
    return prisma.product.create({ data: { ...data, active: true } });
  }

  return prisma.product.update({
    where: { id: existing.id },
    data: {
      description: data.description,
      price: data.price,
      duration: data.duration,
      active: true,
    },
  });
}

async function upsertEmployee(data: {
  name: string;
  email: string;
  phone: string;
  userId: string;
}) {
  const existing = await prisma.employee.findUnique({ where: { email: data.email } });
  if (!existing) {
    return prisma.employee.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        userId: data.userId,
        active: true,
      },
    });
  }

  return prisma.employee.update({
    where: { id: existing.id },
    data: {
      name: data.name,
      phone: data.phone,
      userId: data.userId,
      active: true,
    },
  });
}

async function renameLegacyBrandEmails() {
  const fromDomain = '@sentier.dev';
  const toDomain = '@leemia.dev';

  const users = await prisma.user.findMany({
    where: { email: { endsWith: fromDomain } },
  });
  for (const user of users) {
    const nextEmail = user.email.replace(fromDomain, toDomain);
    const clash = await prisma.user.findUnique({ where: { email: nextEmail } });
    if (clash) continue;
    await prisma.user.update({ where: { id: user.id }, data: { email: nextEmail } });
  }

  const employees = await prisma.employee.findMany({
    where: { email: { endsWith: fromDomain } },
  });
  for (const employee of employees) {
    const nextEmail = employee.email.replace(fromDomain, toDomain);
    const clash = await prisma.employee.findUnique({ where: { email: nextEmail } });
    if (clash) continue;
    await prisma.employee.update({ where: { id: employee.id }, data: { email: nextEmail } });
  }
}

async function main() {
  // O seed sobrescreve expediente, preços e senhas: nunca no Postgres de produção.
  assertDisposableDatabase(process.env.DATABASE_URL, 'Seed');

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  await renameLegacyBrandEmails();

  const admin = await upsertUser(passwordHash, {
    name: DEFAULT_ADMIN.name,
    email: ADMIN_EMAIL,
    role: 'ADMIN',
    fictitious: ADMIN_EMAIL === DEFAULT_ADMIN.email,
  });
  const client = await upsertUser(passwordHash, {
    name: DEFAULT_CLIENT.name,
    email: CLIENT_EMAIL,
    phone: DEFAULT_CLIENT.phone,
    role: 'USER',
    fictitious: CLIENT_EMAIL === DEFAULT_CLIENT.email,
  });

  console.log(`Admin: ${admin.email}`);
  console.log(`Cliente: ${client.email}`);

  for (const hour of DEFAULT_HOURS) {
    await prisma.businessHour.upsert({
      where: { dayOfWeek: hour.dayOfWeek },
      create: hour,
      update: hour,
    });
  }

  await prisma.specialDay.deleteMany({ where: { title: 'Natal' } });
  const natalYear = new Date().getFullYear();
  for (const year of [natalYear, natalYear + 1]) {
    const natal = new Date(Date.UTC(year, 11, 25));
    await prisma.specialDay.upsert({
      where: { date: natal },
      create: {
        date: natal,
        title: 'Natal',
        description: 'Estúdio fechado',
        isClosed: true,
      },
      update: {
        title: 'Natal',
        description: 'Estúdio fechado',
        isClosed: true,
      },
    });
  }

  const productsByName = new Map<string, { id: string; duration: number; price: unknown }>();
  for (const product of PRODUCTS) {
    const saved = await upsertProduct(product);
    productsByName.set(saved.name, saved);
  }

  const employeesByEmail = new Map<string, { id: string; name: string }>();
  for (const professional of PROFESSIONALS) {
    const user = await upsertUser(passwordHash, {
      name: professional.name,
      email: professional.email,
      phone: professional.phone,
      role: 'EMPLOYEE',
      fictitious: true,
    });
    const employee = await upsertEmployee({
      name: professional.name,
      email: professional.email,
      phone: professional.phone,
      userId: user.id,
    });
    employeesByEmail.set(professional.email, employee);

    await prisma.employeeProduct.deleteMany({ where: { employeeId: employee.id } });
    await prisma.employeeProduct.createMany({
      data: professional.products.map((productName) => {
        const product = productsByName.get(productName);
        if (!product) throw new Error(`Produto não encontrado: ${productName}`);
        return { employeeId: employee.id, productId: product.id };
      }),
    });
  }

  const extraClients = [];
  for (const extra of EXTRA_CLIENTS) {
    extraClients.push(
      await upsertUser(passwordHash, {
        name: extra.name,
        email: extra.email,
        phone: extra.phone,
        role: 'USER',
        fictitious: true,
      }),
    );
  }

  await prisma.appointment.deleteMany({
    where: { notes: { startsWith: SEED_NOTE } },
  });

  const marina = employeesByEmail.get('marina.costa@leemia.dev')!;
  const rafael = employeesByEmail.get('rafael.souza@leemia.dev')!;
  const ana = employeesByEmail.get('ana.oliveira@leemia.dev')!;
  const corte = productsByName.get('Corte masculino')!;
  const barba = productsByName.get('Barba')!;
  const combo = productsByName.get('Corte + barba')!;
  const hidratacao = productsByName.get('Hidratação')!;
  const sobrancelha = productsByName.get('Design de sobrancelha')!;
  const relaxamento = productsByName.get('Relaxamento capilar')!;

  const appointments = [
    {
      clientId: client.id,
      employeeId: marina.id,
      product: corte,
      date: atDays(2, 10, 0),
      status: 'SCHEDULED' as const,
      notes: `${SEED_NOTE} Corte do cliente principal com Marina`,
    },
    {
      clientId: client.id,
      employeeId: rafael.id,
      product: barba,
      date: atDays(4, 14, 0),
      status: 'CONFIRMED' as const,
      notes: `${SEED_NOTE} Barba do cliente principal com Rafael`,
    },
    {
      clientId: client.id,
      employeeId: ana.id,
      product: hidratacao,
      date: atDays(-5, 9, 30),
      status: 'COMPLETED' as const,
      notes: `${SEED_NOTE} Hidratação concluída`,
    },
    {
      clientId: extraClients[0].id,
      employeeId: marina.id,
      product: combo,
      date: atDays(3, 11, 0),
      status: 'CONFIRMED' as const,
      notes: `${SEED_NOTE} Combo da Camila`,
    },
    {
      clientId: extraClients[1].id,
      employeeId: rafael.id,
      product: corte,
      date: atDays(2, 9, 0),
      status: 'SCHEDULED' as const,
      notes: `${SEED_NOTE} Corte do Bruno`,
    },
    {
      clientId: extraClients[1].id,
      employeeId: rafael.id,
      product: barba,
      date: atDays(-2, 16, 0),
      status: 'NO_SHOW' as const,
      notes: `${SEED_NOTE} Bruno não compareceu`,
    },
    {
      clientId: extraClients[2].id,
      employeeId: ana.id,
      product: sobrancelha,
      date: atDays(5, 10, 30),
      status: 'SCHEDULED' as const,
      notes: `${SEED_NOTE} Sobrancelha da Juliana`,
    },
    {
      clientId: extraClients[2].id,
      employeeId: ana.id,
      product: relaxamento,
      date: atDays(-8, 15, 0),
      status: 'CANCELLED' as const,
      notes: `${SEED_NOTE} Relaxamento cancelado`,
    },
    {
      clientId: extraClients[0].id,
      employeeId: marina.id,
      product: hidratacao,
      date: atDays(7, 9, 0),
      status: 'SCHEDULED' as const,
      notes: `${SEED_NOTE} Hidratação da Camila no sábado`,
    },
  ];

  let created = 0;
  for (const item of appointments) {
    if (!isOpenDay(item.date)) {
      console.warn(`Horário fora do expediente, ajustando: ${item.notes}`);
    }

    const endDate = new Date(item.date.getTime() + item.product.duration * 60 * 1000);
    await prisma.appointment.create({
      data: {
        clientId: item.clientId,
        employeeId: item.employeeId,
        productId: item.product.id,
        date: item.date,
        endDate,
        price: item.product.price as number,
        status: item.status,
        notes: item.notes,
      },
    });
    created += 1;
  }

  console.log(`Produtos: ${productsByName.size}`);
  console.log(`Profissionais: ${employeesByEmail.size}`);
  console.log(`Clientes extras: ${extraClients.length}`);
  console.log(`Agendamentos criados: ${created}`);
  console.log(
    PASSWORD_FROM_ENV
      ? 'Senha das contas fictícias: a de SEED_PASSWORD.'
      : `Senha das contas fictícias (gerada nesta execução): ${SEED_PASSWORD}`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
