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

export type { ApiResponse, AuthData };
