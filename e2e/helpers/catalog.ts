import type { APIRequestContext } from '@playwright/test';
import {
  bookAppointment,
  getAvailability,
  getEmployees,
  getProducts,
  type Availability,
  type AvailabilitySlot,
  type Employee,
  type Product,
} from './api';
import { addDays, isSunday, todayKey, weekdayOf } from './dates';

export type CatalogPair = {
  product: Product;
  employee: Employee;
};

export async function resolveCatalogPair(
  api: APIRequestContext,
  token: string,
): Promise<CatalogPair> {
  const [productsRes, employeesRes] = await Promise.all([
    getProducts(api, token),
    getEmployees(api, token),
  ]);

  const products = productsRes.body.data?.products || [];
  const employees = employeesRes.body.data?.employees || [];

  if (!products.length || !employees.length) {
    throw new Error(
      'Seed incompleto: não há produtos ou profissionais ativos para testar o agendamento.',
    );
  }

  const preferredProduct = products.find((product) => product.name === 'Barba') || products[0];
  const matchingEmployee =
    employees.find((employee) =>
      employee.products.some((item) => item.product.id === preferredProduct.id),
    ) || employees.find((employee) => employee.products.length > 0);

  if (!matchingEmployee) {
    throw new Error('Nenhum profissional está vinculado a um serviço ativo.');
  }

  const linkedProduct =
    products.find((product) =>
      matchingEmployee.products.some((item) => item.product.id === product.id),
    ) || preferredProduct;

  return { product: linkedProduct, employee: matchingEmployee };
}

export function unmatchedEmployee(employees: Employee[], productId: string) {
  return employees.find(
    (employee) => !employee.products.some((item) => item.product.id === productId),
  );
}

export async function findOpenSlot(
  api: APIRequestContext,
  token: string,
  pair: CatalogPair,
  options: { minDaysAhead?: number; preferLast?: boolean; skipDateKeys?: string[] } = {},
) {
  const minDaysAhead = options.minDaysAhead ?? 14;
  const preferLast = options.preferLast ?? true;
  const skip = new Set(options.skipDateKeys || []);

  for (let offset = minDaysAhead; offset < minDaysAhead + 45; offset += 1) {
    const dateKey = addDays(todayKey(), offset);
    if (isSunday(dateKey) || weekdayOf(dateKey) === 6 || skip.has(dateKey)) continue;

    const availability = await getAvailability(
      api,
      token,
      pair.employee.id,
      pair.product.id,
      dateKey,
    );
    const data = availability.body.data;
    if (availability.status !== 200 || !data || data.isClosed) continue;

    const openSlots = data.slots.filter((slot) => slot.available);
    if (!openSlots.length) continue;

    const slot = preferLast ? openSlots[openSlots.length - 1] : openSlots[0];
    return { dateKey, slot, availability: data };
  }

  throw new Error(
    `Não encontrei horário livre para ${pair.product.name} com ${pair.employee.name} nos próximos 45 dias.`,
  );
}

export async function bookTracked(
  api: APIRequestContext,
  token: string,
  payload: {
    productId: string;
    employeeId: string;
    date: string;
    notes?: string;
    clientId?: string;
  },
  tracker: string[],
) {
  const result = await bookAppointment(api, token, payload);
  const id = result.body.data?.appointment?.id;
  if (result.status === 201 && id) tracker.push(id);
  return result;
}

export function unavailableSlots(availability: Availability): AvailabilitySlot[] {
  return availability.slots.filter((slot) => !slot.available);
}
