import type { APIRequestContext } from '@playwright/test';
import { E2E_NOTE_PREFIX } from './env';

export type ApiResult<T = unknown> = {
  status: number;
  body: {
    status?: string;
    message?: string;
    data?: T;
    errors?: Array<{ field: string; message: string }>;
  };
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  employeeId: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number;
  active: boolean;
};

export type Employee = {
  id: string;
  name: string;
  email?: string;
  phone?: string | null;
  active: boolean;
  products: Array<{ product: Pick<Product, 'id' | 'name' | 'price' | 'duration' | 'active'> }>;
};

export type AvailabilitySlot = {
  start: string;
  end: string;
  available: boolean;
};

export type Availability = {
  date: string;
  employee: { id: string; name: string };
  product: { id: string; name: string; duration: number };
  businessHours: { start: string; end: string };
  isClosed?: boolean;
  slots: AvailabilitySlot[];
};

export type Appointment = {
  id: string;
  date: string;
  endDate: string;
  status: string;
  notes: string | null;
  price: number;
  client: { id: string; name: string; email: string; phone: string | null };
  product: { id: string; name: string; duration: number; price: number };
  employee: { id: string; name: string; email: string; phone: string | null };
};

export async function apiJson<T = unknown>(
  api: APIRequestContext,
  method: string,
  path: string,
  options: { token?: string; data?: unknown } = {},
): Promise<ApiResult<T>> {
  const response = await api.fetch(path, {
    method,
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    data: options.data,
  });

  let body: ApiResult<T>['body'] = {};
  try {
    body = (await response.json()) as ApiResult<T>['body'];
  } catch {
    body = {};
  }

  return { status: response.status(), body };
}

export async function login(api: APIRequestContext, email: string, password: string) {
  const result = await apiJson<{ user: AuthUser; token: string }>(api, 'POST', '/api/auth/login', {
    data: { email, password },
  });

  if (result.status !== 200 || !result.body.data?.token || !result.body.data.user) {
    throw new Error(
      `Falha no login E2E de ${email} (${result.status}): ${result.body.message || 'sem mensagem'}. Confirme o túnel do banco (\`npm run db:tunnel\`) e as variáveis E2E_USER_*.`,
    );
  }

  return result.body.data;
}

export async function registerClient(
  api: APIRequestContext,
  data: { name: string; email: string; password: string },
) {
  return apiJson<{ user: AuthUser; token: string }>(api, 'POST', '/api/auth/register', {
    data: { ...data, phone: '(11) 90000-0001' },
  });
}

export async function ensureClient(
  api: APIRequestContext,
  data: { name: string; email: string; password: string },
) {
  try {
    return await login(api, data.email, data.password);
  } catch {
    const created = await registerClient(api, data);
    if (created.status === 201 && created.body.data?.token && created.body.data.user) {
      return created.body.data;
    }
    return login(api, data.email, data.password);
  }
}

export async function getProducts(api: APIRequestContext, token: string, includeInactive = false) {
  const query = includeInactive ? '?includeInactive=true' : '';
  const result = await apiJson<{ products: Product[] }>(api, 'GET', `/api/products${query}`, {
    token,
  });
  return result;
}

export async function getEmployees(api: APIRequestContext, token: string, includeInactive = false) {
  const query = includeInactive ? '?includeInactive=true' : '';
  const result = await apiJson<{ employees: Employee[] }>(api, 'GET', `/api/employees${query}`, {
    token,
  });
  return result;
}

export async function getAvailability(
  api: APIRequestContext,
  token: string,
  employeeId: string,
  productId: string,
  date: string,
) {
  const params = new URLSearchParams({ employeeId, productId, date });
  return apiJson<Availability>(api, 'GET', `/api/appointments/availability?${params.toString()}`, {
    token,
  });
}

export async function bookAppointment(
  api: APIRequestContext,
  token: string,
  data: { productId: string; employeeId: string; date: string; notes?: string; clientId?: string },
) {
  return apiJson<{ appointment: Appointment }>(api, 'POST', '/api/appointments/book', {
    token,
    data,
  });
}

export async function getMyAppointments(api: APIRequestContext, token: string) {
  return apiJson<{ appointments: Appointment[] }>(api, 'GET', '/api/appointments/my', { token });
}

export async function getAllAppointments(api: APIRequestContext, token: string) {
  return apiJson<{ appointments: Appointment[] }>(api, 'GET', '/api/appointments', { token });
}

export async function getAppointmentById(api: APIRequestContext, token: string, id: string) {
  return apiJson<{ appointment: Appointment }>(api, 'GET', `/api/appointments/${id}`, { token });
}

export async function cancelAppointment(api: APIRequestContext, token: string, id: string) {
  return apiJson<{ appointment: Appointment }>(api, 'PATCH', `/api/appointments/${id}/cancel`, {
    token,
  });
}

export async function getClients(api: APIRequestContext, token: string) {
  return apiJson<{
    clients: Array<{ id: string; name: string; email: string; phone: string | null }>;
  }>(api, 'GET', '/api/auth/clients', { token });
}

export async function createAdminAppointment(
  api: APIRequestContext,
  token: string,
  data: { productId: string; employeeId: string; clientId: string; date: string },
) {
  return apiJson<{ appointment: Appointment }>(api, 'POST', '/api/appointments', {
    token,
    data,
  });
}

export function e2eNote(label: string) {
  return `${E2E_NOTE_PREFIX} ${label} ${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}
