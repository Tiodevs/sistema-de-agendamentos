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

export type { ApiResponse, AuthData };
