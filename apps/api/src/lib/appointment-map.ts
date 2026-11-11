import { userAvatarUrl } from './avatar';

export const appointmentClientSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  avatar: true,
  updatedAt: true,
} as const;

export const appointmentEmployeeSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  avatar: true,
  user: { select: { id: true, avatar: true, updatedAt: true } },
} as const;

export const appointmentProductSelect = {
  id: true,
  name: true,
  duration: true,
  price: true,
} as const;

export const appointmentInclude = {
  client: { select: appointmentClientSelect },
  product: { select: appointmentProductSelect },
  employee: { select: appointmentEmployeeSelect },
} as const;

export function mapClientAvatar(client: {
  id: string;
  name: string;
  /** `null` no cliente cadastrado pela recepção sem e-mail (UX-03). */
  email: string | null;
  phone: string | null;
  avatar: string | null;
  updatedAt: Date;
}) {
  return {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    avatarUrl: userAvatarUrl(client.id, client.avatar, client.updatedAt),
  };
}

export function mapEmployeeAvatar(employee: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  user?: { id: string; avatar: string | null; updatedAt: Date } | null;
}) {
  return {
    id: employee.id,
    name: employee.name,
    email: employee.email,
    phone: employee.phone,
    avatar: employee.user
      ? userAvatarUrl(employee.user.id, employee.user.avatar, employee.user.updatedAt)
      : employee.avatar,
  };
}

type AppointmentRecord = {
  price: unknown;
  product: { price: unknown };
  client: Parameters<typeof mapClientAvatar>[0];
  employee: Parameters<typeof mapEmployeeAvatar>[0];
};

/** O agendamento como vai para o JSON: preços em número e as fotos já resolvidas. */
export type MappedAppointment<T extends AppointmentRecord> = Omit<
  T,
  'client' | 'employee' | 'price' | 'product'
> & {
  price: number;
  product: Omit<T['product'], 'price'> & { price: number };
  client: ReturnType<typeof mapClientAvatar>;
  employee: ReturnType<typeof mapEmployeeAvatar>;
};

export function mapAppointment<T extends AppointmentRecord>(appointment: T): MappedAppointment<T> {
  const { client, employee, price, product, ...rest } = appointment;
  // O tipo de retorno diz `number` nos preços (e não o Decimal do Prisma): é o que o contrato com
  // o web confere (ARQ-04). O TypeScript não deriva isso sozinho de um spread genérico.
  return {
    ...rest,
    price: Number(price),
    product: { ...product, price: Number(product.price) },
    client: mapClientAvatar(client),
    employee: mapEmployeeAvatar(employee),
  } as MappedAppointment<T>;
}
