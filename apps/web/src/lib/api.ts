import {
  ApiError,
  INVALID_RESPONSE_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  apiErrorMessage,
  apiFieldErrors,
  errorFromFailure,
  errorFromResponse,
  isAbortError,
  isApiError,
} from './api-error';
import { DEFAULT_TIMEOUT_MS, UPLOAD_TIMEOUT_MS, createRequestSignal } from './request-signal';

// ARQ-09: em produção o build falha sem NEXT_PUBLIC_API_URL (checagem no next.config.ts), então
// este fallback só vale no dev local e nos testes.
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(
  /\/+$/,
  '',
);

interface ApiResponse<T> {
  status: 'success' | 'error';
  message?: string;
  /** Identificador estável do erro, por exemplo `EMAIL_NOT_VERIFIED`. */
  code?: string;
  data?: T;
  errors?: Array<{ field: string; message: string }>;
  /** Dados para a tela decidir, por exemplo a lista de agendamentos afetados (DOM-02). */
  details?: Record<string, unknown>;
}

import type {
  Appointment as AppointmentContract,
  AppointmentListQuery,
  AppointmentPage,
  AppointmentStatus as AppointmentStatusContract,
  Availability,
  AvailabilitySlot as AvailabilitySlotContract,
  ClientExistsDetails,
  ClientListItem,
  CreateClientBody,
  CreateClientResult,
  Pagination,
  TimeRange,
} from '@agendamentos/contracts';

export type { ClientExistsDetails, CreateClientBody, CreateClientResult, TimeRange };

/** Chamadas de leitura aceitam um `signal` para cancelar (TanStack Query, troca de filtro). */
export type ReadOptions = { signal?: AbortSignal };

export interface AuthData {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    employeeId: string | null;
    avatarUrl: string | null;
    pendingEmail?: string | null;
    /** Sem e-mail confirmado, o cliente não reserva. Ausente em sessões antigas. */
    emailVerified?: boolean;
    createdAt: string;
  };
  token: string;
}

// As telas importam tudo de `@/lib/api`; a lógica pura mora em `api-error.ts` para ser testável.
export { ApiError, apiErrorMessage, apiFieldErrors, isAbortError, isApiError };

type UnauthorizedHandler = (token: string) => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * ARQ-09: ponto único do 401. O `AuthProvider` registra aqui o que fazer quando uma chamada
 * autenticada volta 401 (JWT de 12 h vencido): limpar a sessão e levar ao login. O handler
 * recebe o token usado na chamada, para ignorar resposta atrasada de uma sessão antiga.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

type ApiRequestOptions = RequestInit & {
  /** Prazo da chamada. Padrão: 15 s; 60 s quando o corpo é upload (FormData). */
  timeoutMs?: number;
  /** 401 daqui não derruba a sessão (login com senha errada, logout). */
  skipUnauthorizedHandler?: boolean;
};

async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<ApiResponse<T>> {
  const { timeoutMs, skipUnauthorizedHandler, signal: callerSignal, ...init } = options;
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(init.headers);

  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const request = createRequestSignal(
    callerSignal,
    timeoutMs ?? (isFormData ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS),
  );

  let response: Response;
  let data: ApiResponse<T> | null = null;
  try {
    response = await fetch(url, { cache: 'no-store', ...init, headers, signal: request.signal });
    try {
      data = (await response.json()) as ApiResponse<T>;
    } catch (error) {
      // Prazo ou cancelamento no meio do corpo é falha da chamada; corpo que não é JSON, não.
      if (request.signal.aborted) throw error;
    }
  } catch (error) {
    throw errorFromFailure(error, {
      callerAborted: Boolean(callerSignal?.aborted),
      timedOut: request.timedOut(),
    });
  } finally {
    request.dispose();
  }

  // 401 em chamada com token é sessão vencida ou revogada: o handler central cuida da saída e a
  // tela recebe um texto que diz o que fazer.
  if (response.status === 401 && token && !skipUnauthorizedHandler) {
    unauthorizedHandler?.(token);
    throw new ApiError(401, SESSION_EXPIRED_MESSAGE, undefined, data?.code);
  }

  if (!response.ok) throw errorFromResponse(response.status, data);
  if (!data) throw new ApiError(response.status, INVALID_RESPONSE_MESSAGE);

  return data;
}

export async function registerUser(body: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<ApiResponse<AuthData>> {
  return apiRequest<AuthData>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function loginUser(body: {
  email: string;
  password: string;
}): Promise<ApiResponse<AuthData>> {
  return apiRequest<AuthData>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    // 401 aqui é e-mail ou senha errados, não sessão vencida.
    skipUnauthorizedHandler: true,
  });
}

export async function logoutSession(): Promise<ApiResponse<void>> {
  return apiRequest('/api/auth/logout', {
    method: 'POST',
    // A sessão já está saindo: token vencido não deve mandar para o login com `next`.
    skipUnauthorizedHandler: true,
  });
}

export async function requestPasswordReset(email: string): Promise<ApiResponse<void>> {
  return apiRequest('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(body: {
  token: string;
  password: string;
}): Promise<ApiResponse<void>> {
  return apiRequest('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Confirma o e-mail pelo link: o do cadastro (`changed: false`) ou um novo pedido no perfil. */
export async function confirmEmailChange(
  token: string,
): Promise<ApiResponse<{ changed: boolean }>> {
  return apiRequest('/api/auth/confirm-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function resendEmailVerification(): Promise<
  ApiResponse<{ alreadyVerified: boolean }>
> {
  return apiRequest('/api/auth/verify-email/resend', {
    method: 'POST',
  });
}

export async function changePassword(body: {
  currentPassword: string;
  newPassword: string;
}): Promise<ApiResponse<AuthData>> {
  return apiRequest<AuthData>('/api/auth/password', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getMe(
  signal?: AbortSignal,
): Promise<ApiResponse<{ user: AuthData['user'] }>> {
  return apiRequest('/api/auth/me', { signal });
}

export async function updateMyProfile(body: {
  name: string;
  email: string;
  phone?: string;
}): Promise<ApiResponse<{ user: AuthData['user'] }>> {
  return apiRequest('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function uploadMyAvatar(file: File): Promise<ApiResponse<{ user: AuthData['user'] }>> {
  const body = new FormData();
  body.append('avatar', file);
  return apiRequest('/api/auth/profile/avatar', {
    method: 'POST',
    body,
  });
}

export async function deleteMyAvatar(): Promise<ApiResponse<{ user: AuthData['user'] }>> {
  return apiRequest('/api/auth/profile/avatar', {
    method: 'DELETE',
  });
}

/** Cliente como a API devolve (contrato compartilhado). `email` é `null` no cliente rápido. */
export type Client = ClientListItem;

export type ClientsPagination = Pagination;

export interface ClientFavorite {
  id: string;
  name: string;
  count: number;
}

export interface ClientStats {
  total: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  noShow: number;
  completedRevenue: number;
  expectedRevenue: number;
  lastAppointmentAt: string | null;
  favoriteProduct: ClientFavorite | null;
  favoriteEmployee: ClientFavorite | null;
}

export interface GetClientsOptions {
  search?: string;
  includeInactive?: boolean;
  active?: boolean;
  role?: string;
  page?: number;
  limit?: number;
}

export async function getClients(
  searchOrOptions?: string | GetClientsOptions,
  request: ReadOptions = {},
): Promise<ApiResponse<{ clients: Client[]; pagination?: ClientsPagination }>> {
  const options: GetClientsOptions =
    typeof searchOrOptions === 'string' ? { search: searchOrOptions } : (searchOrOptions ?? {});
  const params = new URLSearchParams();
  if (options.search) params.set('search', options.search);
  if (options.includeInactive) params.set('includeInactive', 'true');
  if (typeof options.active === 'boolean') params.set('active', String(options.active));
  if (options.role) params.set('role', options.role);
  if (options.page) params.set('page', String(options.page));
  if (options.limit) params.set('limit', String(options.limit));
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/api/auth/clients${query}`, request);
}

/**
 * UX-03: cliente rápido cadastrado pela recepção. Contato repetido volta 409 `CLIENT_EXISTS` com
 * o cliente que já existe em `details` (`ClientExistsDetails`).
 */
export async function createClient(
  body: CreateClientBody,
): Promise<ApiResponse<CreateClientResult>> {
  return apiRequest('/api/auth/clients', { method: 'POST', body: JSON.stringify(body) });
}

/* ─── Products ─── */

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  /** Só para o admin: com histórico, o serviço não é excluído, só desativado (DOM-04). */
  appointmentCount?: number;
}

export interface ProductPayload {
  name: string;
  description?: string;
  price: number;
  duration: number;
}

export async function getProducts(
  includeInactive = false,
): Promise<ApiResponse<{ products: Product[] }>> {
  const query = includeInactive ? '?includeInactive=true' : '';
  return apiRequest(`/api/products${query}`);
}

export async function getProduct(id: string): Promise<ApiResponse<{ product: Product }>> {
  return apiRequest(`/api/products/${id}`);
}

export async function createProduct(
  body: ProductPayload,
): Promise<ApiResponse<{ product: Product }>> {
  return apiRequest('/api/products', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateProduct(
  id: string,
  body: Partial<ProductPayload>,
): Promise<ApiResponse<{ product: Product }>> {
  return apiRequest(`/api/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function toggleProduct(id: string): Promise<ApiResponse<{ product: Product }>> {
  return apiRequest(`/api/products/${id}/toggle`, {
    method: 'PATCH',
  });
}

export async function deleteProduct(id: string): Promise<ApiResponse<{ product: Product }>> {
  return apiRequest(`/api/products/${id}`, {
    method: 'DELETE',
  });
}

/* ─── Employees ─── */

export interface EmployeeProduct {
  product: {
    id: string;
    name: string;
    price: number;
    duration: number;
    active: boolean;
  };
  assignedAt: string;
}

/**
 * Acesso ao painel do profissional (SEC-03): conta ligada, convite em aberto, convite vencido ou
 * sem acesso. O vínculo só acontece quando o dono do e-mail aceita o convite.
 */
export type EmployeeAccess =
  | { status: 'linked'; email: string | null }
  | { status: 'pending' | 'expired'; sentAt: string; expiresAt: string }
  | { status: 'none' };

export interface Employee {
  id: string;
  name: string;
  email?: string;
  phone?: string | null;
  avatar: string | null;
  active: boolean;
  products: EmployeeProduct[];
  createdAt: string;
  updatedAt: string;
  /** Só para o admin. */
  access?: EmployeeAccess;
  /** Só para o admin: com histórico, o profissional não é excluído, só desativado (DOM-04). */
  appointmentCount?: number;
}

export interface EmployeePayload {
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  /** Respiro, em minutos, entre dois atendimentos (UX-12). */
  bufferMinutes?: number;
}

export async function getEmployees(
  includeInactive = false,
): Promise<ApiResponse<{ employees: Employee[] }>> {
  const query = includeInactive ? '?includeInactive=true' : '';
  return apiRequest(`/api/employees${query}`);
}

export async function getEmployee(id: string): Promise<ApiResponse<{ employee: Employee }>> {
  return apiRequest(`/api/employees/${id}`);
}

export async function createEmployee(
  body: EmployeePayload,
): Promise<ApiResponse<{ employee: Employee }>> {
  return apiRequest('/api/employees', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateEmployee(
  id: string,
  body: Partial<EmployeePayload>,
): Promise<ApiResponse<{ employee: Employee }>> {
  return apiRequest(`/api/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/** Desativar com horários marcados responde 409 AFFECTED_APPOINTMENTS sem `onAffected` (DOM-02). */
export async function toggleEmployee(
  id: string,
  onAffected?: AffectedDecision,
): Promise<ApiResponse<{ employee: Employee; impact?: ImpactSummary }>> {
  return apiRequest(`/api/employees/${id}/toggle${affectedQuery(onAffected)}`, {
    method: 'PATCH',
  });
}

/** Envia ou reenvia o convite de acesso ao painel (SEC-03). */
export async function sendEmployeeInvite(id: string): Promise<ApiResponse<{ employee: Employee }>> {
  return apiRequest(`/api/employees/${id}/invite`, {
    method: 'POST',
  });
}

/** Desfaz o vínculo com a conta e devolve a pessoa ao papel de cliente. */
export async function revokeEmployeeAccess(
  id: string,
): Promise<ApiResponse<{ employee: Employee }>> {
  return apiRequest(`/api/employees/${id}/access`, {
    method: 'DELETE',
  });
}

export async function deleteEmployee(id: string): Promise<ApiResponse<{ employee: Employee }>> {
  return apiRequest(`/api/employees/${id}`, {
    method: 'DELETE',
  });
}

export async function assignEmployeeProducts(
  employeeId: string,
  productIds: string[],
): Promise<ApiResponse<{ employee: Employee }>> {
  return apiRequest(`/api/employees/${employeeId}/products`, {
    method: 'PUT',
    body: JSON.stringify({ productIds }),
  });
}

/* ─── Appointments ─── */

export type AppointmentStatus = AppointmentStatusContract;

export interface Appointment extends AppointmentContract {
  /** Status que quem pediu pode marcar agora (DOM-01). A API decide; a tela só mostra. */
  allowedStatuses?: AppointmentStatus[];
  /** Até quando cliente e profissional cancelam sozinhos (DOM-09). Depois, só o estúdio. */
  cancellableUntil?: string;
}

/** Resposta de uma mudança de status: até `undoUntil` dá para desfazer (cancelamento não). */
export interface StatusChangeResult {
  appointment: Appointment;
  undoUntil: string | null;
}

export interface AppointmentPayload {
  productId: string;
  employeeId: string;
  clientId: string;
  date: string;
  notes?: string;
}

export type AvailabilitySlot = AvailabilitySlotContract;
export type AvailabilityResponse = Availability;

export type AppointmentsQuery = AppointmentListQuery;

/**
 * Agenda do admin (UX-09): paginada e, sem período nem cliente, a partir de hoje. A resposta
 * traz `pagination` e o `period` que a API aplicou.
 */
export async function getAppointments(
  filters: AppointmentsQuery = {},
  request: ReadOptions = {},
): Promise<ApiResponse<AppointmentPage>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/api/appointments${query}`, request);
}

export async function getClient(
  id: string,
  request: ReadOptions = {},
): Promise<ApiResponse<{ client: Client; stats: ClientStats; appointments: Appointment[] }>> {
  // SEC-07: o id pode vir da URL da página; codificado, não muda o caminho da chamada.
  return apiRequest(`/api/auth/clients/${encodeURIComponent(id)}`, request);
}

export async function getAppointment(
  id: string,
): Promise<ApiResponse<{ appointment: Appointment }>> {
  return apiRequest(`/api/appointments/${id}`);
}

export async function createAppointment(
  body: AppointmentPayload,
): Promise<ApiResponse<{ appointment: Appointment }>> {
  return apiRequest('/api/appointments', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Usuário cria agendamento para si mesmo (clientId inferido do token) */
export async function bookAppointment(
  body: Omit<AppointmentPayload, 'clientId'>,
): Promise<ApiResponse<{ appointment: Appointment }>> {
  return apiRequest('/api/appointments/book', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Listar apenas os agendamentos do usuário autenticado */
export async function getMyAppointments(
  status?: string,
): Promise<ApiResponse<{ appointments: Appointment[] }>> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/api/appointments/my${query}`);
}

/** Usuário cancela seu próprio agendamento */
export async function cancelMyAppointment(
  id: string,
): Promise<ApiResponse<{ appointment: Appointment }>> {
  return apiRequest(`/api/appointments/${id}/cancel`, {
    method: 'PATCH',
  });
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
): Promise<ApiResponse<StatusChangeResult>> {
  return apiRequest(`/api/appointments/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

/** Desfaz a última mudança de status feita por você (até 10 min; cancelamento não). */
export async function undoAppointmentStatus(
  id: string,
): Promise<ApiResponse<{ appointment: Appointment }>> {
  return apiRequest(`/api/appointments/${id}/status/undo`, {
    method: 'POST',
  });
}

export async function getAvailableSlots(
  employeeId: string,
  productId: string,
  date: string,
  request: ReadOptions = {},
): Promise<ApiResponse<AvailabilityResponse>> {
  const params = new URLSearchParams({ employeeId, productId, date });
  return apiRequest(`/api/appointments/availability?${params.toString()}`, request);
}

/* ─── Schedule (Business Hours & Special Days) ─── */

/** O que fazer com os agendamentos marcados que ficariam sem atendimento (DOM-02). */
export type AffectedDecision = 'keep' | 'cancel';

export interface AffectedAppointment {
  id: string;
  date: string;
  endDate: string;
  status: AppointmentStatus;
  client: { id: string; name: string };
  product: { id: string; name: string };
  employee: { id: string; name: string };
}

export interface ImpactSummary {
  affected: number;
  cancelled: number;
}

function affectedQuery(onAffected?: AffectedDecision) {
  return onAffected ? `?onAffected=${onAffected}` : '';
}

/**
 * A API responde 409 `AFFECTED_APPOINTMENTS` quando a mudança deixaria agendamentos sem
 * atendimento e ninguém disse o que fazer com eles. Devolve a lista, ou `null` se for outro erro.
 */
export function affectedAppointmentsFrom(error: unknown): AffectedAppointment[] | null {
  if (!(error instanceof ApiError) || error.code !== 'AFFECTED_APPOINTMENTS') return null;
  const list = error.details?.appointments;
  return Array.isArray(list) ? (list as AffectedAppointment[]) : [];
}

export interface BusinessHour {
  id: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
  /** Pausas do dia (UX-12), ex.: almoço. */
  breaks?: TimeRange[];
  dayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessHourPayload {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
  /** Ausente = mantém as pausas já gravadas no dia. */
  breaks?: TimeRange[];
}

export interface SpecialDay {
  id: string;
  date: string;
  title: string;
  description: string | null;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SpecialDayPayload {
  date: string;
  title: string;
  description?: string;
  isClosed?: boolean;
  openTime?: string | null;
  closeTime?: string | null;
}

export async function getBusinessHours(
  request: ReadOptions = {},
): Promise<ApiResponse<{ hours: BusinessHour[] }>> {
  return apiRequest('/api/schedule/business-hours', request);
}

export async function updateAllBusinessHours(
  hours: BusinessHourPayload[],
  onAffected?: AffectedDecision,
): Promise<ApiResponse<{ hours: BusinessHour[]; impact?: ImpactSummary }>> {
  return apiRequest(`/api/schedule/business-hours${affectedQuery(onAffected)}`, {
    method: 'PUT',
    body: JSON.stringify({ hours }),
  });
}

export async function getSpecialDays(): Promise<ApiResponse<{ days: SpecialDay[] }>> {
  return apiRequest('/api/schedule/special-days');
}

export async function createSpecialDay(
  body: SpecialDayPayload,
  onAffected?: AffectedDecision,
): Promise<ApiResponse<{ day: SpecialDay; impact?: ImpactSummary }>> {
  return apiRequest(`/api/schedule/special-days${affectedQuery(onAffected)}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateSpecialDay(
  id: string,
  body: Partial<SpecialDayPayload>,
  onAffected?: AffectedDecision,
): Promise<ApiResponse<{ day: SpecialDay; impact?: ImpactSummary }>> {
  return apiRequest(`/api/schedule/special-days/${id}${affectedQuery(onAffected)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteSpecialDay(
  id: string,
  onAffected?: AffectedDecision,
): Promise<ApiResponse<{ impact?: ImpactSummary }>> {
  return apiRequest(`/api/schedule/special-days/${id}${affectedQuery(onAffected)}`, {
    method: 'DELETE',
  });
}

export interface EmployeeScheduleSummary {
  id: string;
  name: string;
  active: boolean;
  usesCustomHours: boolean;
  specialDaysCount: number;
}

export interface EmployeeSchedule {
  employee: { id: string; name: string; active: boolean };
  usesCustomHours: boolean;
  hours: BusinessHour[];
  specialDays: SpecialDay[];
  /** Respiro, em minutos, entre dois atendimentos do profissional (UX-12). */
  bufferMinutes?: number;
}

export async function getEmployeeScheduleSummaries(): Promise<
  ApiResponse<{ employees: EmployeeScheduleSummary[] }>
> {
  return apiRequest('/api/schedule/employees');
}

export async function getEmployeeSchedule(
  employeeId: string,
  request: ReadOptions = {},
): Promise<ApiResponse<EmployeeSchedule>> {
  return apiRequest(`/api/schedule/employees/${encodeURIComponent(employeeId)}`, request);
}

export async function updateEmployeeHours(
  employeeId: string,
  hours: BusinessHourPayload[],
  onAffected?: AffectedDecision,
): Promise<ApiResponse<EmployeeSchedule & { impact?: ImpactSummary }>> {
  return apiRequest(`/api/schedule/employees/${employeeId}/hours${affectedQuery(onAffected)}`, {
    method: 'PUT',
    body: JSON.stringify({ hours }),
  });
}

export async function resetEmployeeHours(
  employeeId: string,
  onAffected?: AffectedDecision,
): Promise<ApiResponse<EmployeeSchedule & { impact?: ImpactSummary }>> {
  return apiRequest(`/api/schedule/employees/${employeeId}/hours${affectedQuery(onAffected)}`, {
    method: 'DELETE',
  });
}

export async function createEmployeeSpecialDay(
  employeeId: string,
  body: SpecialDayPayload,
  onAffected?: AffectedDecision,
): Promise<ApiResponse<{ day: SpecialDay; impact?: ImpactSummary }>> {
  return apiRequest(
    `/api/schedule/employees/${employeeId}/special-days${affectedQuery(onAffected)}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

export async function updateEmployeeSpecialDay(
  employeeId: string,
  id: string,
  body: Partial<SpecialDayPayload>,
  onAffected?: AffectedDecision,
): Promise<ApiResponse<{ day: SpecialDay; impact?: ImpactSummary }>> {
  return apiRequest(
    `/api/schedule/employees/${employeeId}/special-days/${id}${affectedQuery(onAffected)}`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
  );
}

export async function deleteEmployeeSpecialDay(
  employeeId: string,
  id: string,
  onAffected?: AffectedDecision,
): Promise<ApiResponse<{ impact?: ImpactSummary }>> {
  return apiRequest(
    `/api/schedule/employees/${employeeId}/special-days/${id}${affectedQuery(onAffected)}`,
    {
      method: 'DELETE',
    },
  );
}

/* ─── Dashboard ─── */

export type DashboardPeriod = 'today' | 'week' | 'month' | 'last7' | 'last30';

export interface DashboardData {
  period?: {
    key: DashboardPeriod;
    label: string;
    start: string;
    end: string;
    rangeLabel: string;
    granularity: 'hour' | 'day' | 'week';
    employeeId?: string | null;
    productId?: string | null;
  };
  filters?: {
    employees: Array<{ id: string; name: string }>;
    products: Array<{ id: string; name: string }>;
  };
  overview: {
    activeProducts: number;
    totalProducts: number;
    activeEmployees: number;
    totalEmployees: number;
    totalClients: number;
    monthAppointments: number;
    appointmentChange: number;
    monthRevenue: number;
    revenueChange: number;
    totalAppointments?: number;
    bookedAppointments?: number;
    completedAppointments?: number;
    cancelledAppointments?: number;
    noShowAppointments?: number;
    uniqueClients?: number;
    completedRevenue?: number;
    expectedRevenue?: number;
    avgTicket?: number;
    occupancyRate?: number;
    occupancyMinutes?: number;
    availableMinutes?: number;
    completionRate?: number;
    cancellationRate?: number;
    noShowRate?: number;
    todayCount?: number;
  };
  todayAppointments: Array<{
    id: string;
    date: string;
    endDate: string;
    status: AppointmentStatus;
    client: { id: string; name: string };
    product: { id: string; name: string; duration: number };
    employee: { id: string; name: string };
  }>;
  todaySummary?: {
    total: number;
    remaining: number;
    completed: number;
  };
  periodAppointments?: Array<{
    id: string;
    date: string;
    endDate: string;
    status: AppointmentStatus;
    client: { id: string; name: string };
    product: { id: string; name: string; duration: number };
    employee: { id: string; name: string };
  }>;
  statusBreakdown: Record<string, number>;
  recentAppointments: Array<{
    id: string;
    date: string;
    endDate: string;
    status: AppointmentStatus;
    price: number;
    client: { id: string; name: string };
    product: { id: string; name: string; duration: number; price: number };
    employee: { id: string; name: string };
    createdAt: string;
  }>;
  topProducts: Array<{ productId: string; name: string; count: number; revenue?: number }>;
  topEmployees: Array<{ employeeId: string; name: string; count: number; revenue?: number }>;
  topClients?: Array<{ clientId: string; name: string; count: number; revenue?: number }>;
  timeSpent?: {
    totalMinutes: number;
    completedMinutes: number;
    scheduledMinutes: number;
  };
  weeklyActivity?: Array<{
    start: string;
    label?: string;
    tooltipLabel?: string;
    completedMinutes: number;
    scheduledMinutes: number;
    completedCount?: number;
    scheduledCount?: number;
  }>;
}

export async function getDashboardStats(params?: {
  period?: DashboardPeriod;
  employeeId?: string;
  productId?: string;
}): Promise<ApiResponse<DashboardData>> {
  const searchParams = new URLSearchParams();
  if (params?.period) searchParams.set('period', params.period);
  if (params?.employeeId) searchParams.set('employeeId', params.employeeId);
  if (params?.productId) searchParams.set('productId', params.productId);
  const qs = searchParams.toString();
  return apiRequest(`/api/dashboard/stats${qs ? `?${qs}` : ''}`);
}

/* ─── Professional ─── */

export interface ProfessionalDashboardData extends DashboardData {
  employee: { id: string; name: string; email: string; phone: string | null } | null;
}

export async function getProfessionalDashboard(params?: {
  period?: DashboardPeriod;
  productId?: string;
}): Promise<ApiResponse<ProfessionalDashboardData>> {
  const searchParams = new URLSearchParams();
  if (params?.period) searchParams.set('period', params.period);
  if (params?.productId) searchParams.set('productId', params.productId);
  const qs = searchParams.toString();
  return apiRequest(`/api/professional/dashboard${qs ? `?${qs}` : ''}`);
}

export async function getProfessionalAppointments(params?: {
  from?: string;
  to?: string;
  status?: string;
}): Promise<ApiResponse<{ appointments: Appointment[] }>> {
  const searchParams = new URLSearchParams();
  if (params?.from) searchParams.set('from', params.from);
  if (params?.to) searchParams.set('to', params.to);
  if (params?.status) searchParams.set('status', params.status);
  const qs = searchParams.toString();
  return apiRequest(`/api/professional/appointments${qs ? `?${qs}` : ''}`);
}

export async function updateProfessionalAppointmentStatus(
  id: string,
  status: AppointmentStatus,
): Promise<ApiResponse<StatusChangeResult>> {
  return apiRequest(`/api/professional/appointments/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function undoProfessionalAppointmentStatus(
  id: string,
): Promise<ApiResponse<{ appointment: Appointment }>> {
  return apiRequest(`/api/professional/appointments/${id}/status/undo`, {
    method: 'POST',
  });
}

/* ─── Convite do profissional (SEC-03) ─── */

export interface EmployeeInvitePreview {
  email: string;
  employeeName: string;
  /** Já existe conta com o e-mail do convite: a pessoa entra com a senha dela. */
  accountExists: boolean;
  expiresAt: string;
}

export async function previewEmployeeInvite(
  token: string,
): Promise<ApiResponse<{ invite: EmployeeInvitePreview }>> {
  return apiRequest('/api/auth/invites/preview', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

/**
 * Aceita o convite. Com sessão do mesmo e-mail, basta o token; sem sessão, `password` é a senha da
 * conta existente ou a senha nova. Devolve a sessão já como profissional.
 */
export async function acceptEmployeeInvite(body: {
  token: string;
  password?: string;
}): Promise<ApiResponse<AuthData>> {
  return apiRequest<AuthData>('/api/auth/invites/accept', {
    method: 'POST',
    body: JSON.stringify(body),
    // Com senha, 401 é senha incorreta (mesmo caminho do login), não sessão vencida.
    skipUnauthorizedHandler: body.password !== undefined,
  });
}

export type { ApiResponse };
