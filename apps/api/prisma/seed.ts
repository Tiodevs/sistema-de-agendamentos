import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/database';

const SEED_NOTE = '[seed]';
const SEED_PASSWORD = 'Senha@123';

const ADMIN_EMAIL = 'agedamentos.admin.felipe@gmail.com';
const CLIENT_EMAIL_CANDIDATES = ['agedamentos.felipe@gmail.com', 'agendamento.felipe@gmail.com'];

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
    email: 'marina.costa@sentier.dev',
    phone: '(11) 98888-1001',
    products: ['Corte masculino', 'Corte + barba', 'Hidratação'],
  },
  {
    name: 'Rafael Souza',
    email: 'rafael.souza@sentier.dev',
    phone: '(11) 98888-1002',
    products: ['Corte masculino', 'Barba', 'Corte + barba'],
  },
  {
    name: 'Ana Oliveira',
    email: 'ana.oliveira@sentier.dev',
    phone: '(11) 98888-1003',
    products: ['Hidratação', 'Design de sobrancelha', 'Relaxamento capilar'],
  },
] as const;

const EXTRA_CLIENTS = [
  { name: 'Camila Rocha', email: 'camila.rocha@sentier.dev', phone: '(11) 97777-2001' },
  { name: 'Bruno Almeida', email: 'bruno.almeida@sentier.dev', phone: '(11) 97777-2002' },
  { name: 'Juliana Martins', email: 'juliana.martins@sentier.dev', phone: '(11) 97777-2003' },
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

async function upsertUser(data: {
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  resetPassword: boolean;
}) {
  const password = await bcrypt.hash(SEED_PASSWORD, 12);
  const existing = await prisma.user.findUnique({ where: { email: data.email } });

  if (!existing) {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        role: data.role,
        password,
      },
    });
  }

  return prisma.user.update({
    where: { email: data.email },
    data: {
      name: data.name,
      phone: data.phone ?? existing.phone,
      role: data.role,
      active: true,
      ...(data.resetPassword ? { password } : {}),
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

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    throw new Error(
      `Conta admin não encontrada: ${ADMIN_EMAIL}. Crie a conta no cadastro antes de rodar o seed.`,
    );
  }

  let client = null;
  for (const email of CLIENT_EMAIL_CANDIDATES) {
    client = await prisma.user.findUnique({ where: { email } });
    if (client) break;
  }
  if (!client) {
    throw new Error(
      `Conta de cliente não encontrada. Esperado um destes e-mails: ${CLIENT_EMAIL_CANDIDATES.join(', ')}`,
    );
  }

  await prisma.user.update({
    where: { id: admin.id },
    data: { role: 'ADMIN', active: true },
  });
  await prisma.user.update({
    where: { id: client.id },
    data: { role: 'USER', active: true },
  });

  console.log(`Admin promovido: ${admin.email}`);
  console.log(`Cliente mantido como USER: ${client.email}`);

  for (const hour of DEFAULT_HOURS) {
    await prisma.businessHour.upsert({
      where: { dayOfWeek: hour.dayOfWeek },
      create: hour,
      update: hour,
    });
  }

  const natal = new Date(new Date().getFullYear(), 11, 25);
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

  const productsByName = new Map<string, { id: string; duration: number; price: unknown }>();
  for (const product of PRODUCTS) {
    const saved = await upsertProduct(product);
    productsByName.set(saved.name, saved);
  }

  const employeesByEmail = new Map<string, { id: string; name: string }>();
  for (const professional of PROFESSIONALS) {
    const user = await upsertUser({
      name: professional.name,
      email: professional.email,
      phone: professional.phone,
      role: 'EMPLOYEE',
      resetPassword: true,
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
      await upsertUser({
        name: extra.name,
        email: extra.email,
        phone: extra.phone,
        role: 'USER',
        resetPassword: true,
      }),
    );
  }

  await prisma.appointment.deleteMany({
    where: { notes: { startsWith: SEED_NOTE } },
  });

  const marina = employeesByEmail.get('marina.costa@sentier.dev')!;
  const rafael = employeesByEmail.get('rafael.souza@sentier.dev')!;
  const ana = employeesByEmail.get('ana.oliveira@sentier.dev')!;
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
  console.log(`Senha das contas fictícias (profissionais e clientes extras): ${SEED_PASSWORD}`);
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
