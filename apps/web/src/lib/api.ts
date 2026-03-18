const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiResponse<T> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
  errors?: Array<{ field: string; message: string }>;
}

interface AuthData {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    employeeId: string | null;
    createdAt: string;
  };
  token: string;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    throw data;
  }

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
  });
}

export async function getMe(): Promise<ApiResponse<{ user: AuthData['user'] }>> {
  return apiRequest('/api/auth/me');
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
}

export async function getClients(search?: string): Promise<ApiResponse<{ clients: Client[] }>> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiRequest(`/api/auth/clients${query}`);
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
}

export interface ProductPayload {
  name: string;
  description?: string;
  price: number;
  duration: number;
}

export async function getProducts(includeInactive = false): Promise<ApiResponse<{ products: Product[] }>> {
  const query = includeInactive ? '?includeInactive=true' : '';
  return apiRequest(`/api/products${query}`);
}

export async function getProduct(id: string): Promise<ApiResponse<{ product: Product }>> {
  return apiRequest(`/api/products/${id}`);
}

export async function createProduct(body: ProductPayload): Promise<ApiResponse<{ product: Product }>> {
  return apiRequest('/api/products', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateProduct(id: string, body: Partial<ProductPayload>): Promise<ApiResponse<{ product: Product }>> {
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

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  active: boolean;
  products: EmployeeProduct[];
  createdAt: string;
  updatedAt: string;
}

export interface EmployeePayload {
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
}

export async function getEmployees(includeInactive = false): Promise<ApiResponse<{ employees: Employee[] }>> {
  const query = includeInactive ? '?includeInactive=true' : '';
  return apiRequest(`/api/employees${query}`);
}

export async function getEmployee(id: string): Promise<ApiResponse<{ employee: Employee }>> {
  return apiRequest(`/api/employees/${id}`);
}

export async function createEmployee(body: EmployeePayload): Promise<ApiResponse<{ employee: Employee }>> {
  return apiRequest('/api/employees', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateEmployee(id: string, body: Partial<EmployeePayload>): Promise<ApiResponse<{ employee: Employee }>> {
  return apiRequest(`/api/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function toggleEmployee(id: string): Promise<ApiResponse<{ employee: Employee }>> {
  return apiRequest(`/api/employees/${id}/toggle`, {
    method: 'PATCH',
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

export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface Appointment {
  id: string;
  date: string;
  endDate: string;
  status: AppointmentStatus;
  notes: string | null;
  price: number;
  client: { id: string; name: string; email: string; phone: string | null };
  product: { id: string; name: string; duration: number; price: number };
  employee: { id: string; name: string; email: string; phone: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentPayload {
  productId: string;
  employeeId: string;
  clientId: string;
  date: string;
  notes?: string;
}

export interface AvailabilitySlot {
  start: string;
  end: string;
  available: boolean;
}

export interface AvailabilityResponse {
  date: string;
  employee: { id: string; name: string };
  product: { id: string; name: string; duration: number };
  businessHours: { start: string; end: string };
  isClosed?: boolean;
  slots: AvailabilitySlot[];
}

export async function getAppointments(filters?: {
  employeeId?: string;
  clientId?: string;
  status?: string;
  from?: string;
  to?: string;
}): Promise<ApiResponse<{ appointments: Appointment[] }>> {
  const params = new URLSearchParams();
  if (filters?.employeeId) params.set('employeeId', filters.employeeId);
  if (filters?.clientId) params.set('clientId', filters.clientId);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/api/appointments${query}`);
}

export async function getAppointment(id: string): Promise<ApiResponse<{ appointment: Appointment }>> {
  return apiRequest(`/api/appointments/${id}`);
}

export async function createAppointment(body: AppointmentPayload): Promise<ApiResponse<{ appointment: Appointment }>> {
  return apiRequest('/api/appointments', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Usuário cria agendamento para si mesmo (clientId inferido do token) */
export async function bookAppointment(body: Omit<AppointmentPayload, 'clientId'>): Promise<ApiResponse<{ appointment: Appointment }>> {
  return apiRequest('/api/appointments/book', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Listar apenas os agendamentos do usuário autenticado */
export async function getMyAppointments(status?: string): Promise<ApiResponse<{ appointments: Appointment[] }>> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/api/appointments/my${query}`);
}

/** Usuário cancela seu próprio agendamento */
export async function cancelMyAppointment(id: string): Promise<ApiResponse<{ appointment: Appointment }>> {
  return apiRequest(`/api/appointments/${id}/cancel`, {
    method: 'PATCH',
  });
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
): Promise<ApiResponse<{ appointment: Appointment }>> {
  return apiRequest(`/api/appointments/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteAppointment(id: string): Promise<ApiResponse<{ appointment: Appointment }>> {
  return apiRequest(`/api/appointments/${id}`, {
    method: 'DELETE',
  });
}

export async function getAvailableSlots(
  employeeId: string,
  productId: string,
  date: string,
): Promise<ApiResponse<AvailabilityResponse>> {
  const params = new URLSearchParams({ employeeId, productId, date });
  return apiRequest(`/api/appointments/availability?${params.toString()}`);
}

/* ─── Schedule (Business Hours & Special Days) ─── */

export interface BusinessHour {
  id: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
  dayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessHourPayload {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
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

export async function getBusinessHours(): Promise<ApiResponse<{ hours: BusinessHour[] }>> {
  return apiRequest('/api/schedule/business-hours');
}

export async function updateAllBusinessHours(hours: BusinessHourPayload[]): Promise<ApiResponse<{ hours: BusinessHour[] }>> {
  return apiRequest('/api/schedule/business-hours', {
    method: 'PUT',
    body: JSON.stringify({ hours }),
  });
}

export async function getSpecialDays(): Promise<ApiResponse<{ days: SpecialDay[] }>> {
  return apiRequest('/api/schedule/special-days');
}

export async function createSpecialDay(body: SpecialDayPayload): Promise<ApiResponse<{ day: SpecialDay }>> {
  return apiRequest('/api/schedule/special-days', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateSpecialDay(id: string, body: Partial<SpecialDayPayload>): Promise<ApiResponse<{ day: SpecialDay }>> {
  return apiRequest(`/api/schedule/special-days/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteSpecialDay(id: string): Promise<ApiResponse<{ day: SpecialDay }>> {
  return apiRequest(`/api/schedule/special-days/${id}`, {
    method: 'DELETE',
  });
}

/* ─── Dashboard ─── */

export interface DashboardData {
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
  topProducts: Array<{ productId: string; name: string; count: number }>;
  topEmployees: Array<{ employeeId: string; name: string; count: number }>;
}

export async function getDashboardStats(): Promise<ApiResponse<DashboardData>> {
  return apiRequest('/api/dashboard/stats');
}

/* ─── Professional ─── */

export interface ProfessionalDashboardData {
  employee: { id: string; name: string; email: string; phone: string | null } | null;
  overview: {
    monthAppointments: number;
    appointmentChange: number;
    monthRevenue: number;
    revenueChange: number;
    weekAppointments: number;
    completedMonth: number;
    cancelledMonth: number;
    totalClients: number;
  };
  todayAppointments: Array<{
    id: string;
    date: string;
    endDate: string;
    status: AppointmentStatus;
    client: { id: string; name: string; phone: string | null };
    product: { id: string; name: string; duration: number };
  }>;
  statusBreakdown: Record<string, number>;
  topProducts: Array<{ productId: string; name: string; count: number }>;
}

export async function getProfessionalDashboard(): Promise<ApiResponse<ProfessionalDashboardData>> {
  return apiRequest('/api/professional/dashboard');
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
  status: string,
): Promise<ApiResponse<{ appointment: Appointment }>> {
  return apiRequest(`/api/professional/appointments/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export type { ApiResponse, AuthData };
