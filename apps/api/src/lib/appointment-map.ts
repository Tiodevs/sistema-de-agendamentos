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
  email: string;
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

export function mapAppointment<
  T extends {
    price: unknown;
    product: { price: unknown };
    client: Parameters<typeof mapClientAvatar>[0];
    employee: Parameters<typeof mapEmployeeAvatar>[0];
  },
>(appointment: T) {
  const { client, employee, ...rest } = appointment;
  return {
    ...rest,
    price: Number(appointment.price),
    product: { ...appointment.product, price: Number(appointment.product.price) },
    client: mapClientAvatar(client),
    employee: mapEmployeeAvatar(employee),
  };
}
