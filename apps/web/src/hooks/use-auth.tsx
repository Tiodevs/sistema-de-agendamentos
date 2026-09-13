'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { ApiError, getMe, type AuthData } from '@/lib/api';

type User = AuthData['user'];

type Session = {
  user: User;
  token: string;
};

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let cachedSession: Session | null = null;

function toUser(value: User): User {
  const extra = value as User & { employee?: { id: string } | null };
  return {
    id: extra.id,
    name: extra.name,
    email: extra.email,
    phone: extra.phone,
    role: extra.role,
    employeeId: extra.employeeId ?? extra.employee?.id ?? null,
    avatarUrl: extra.avatarUrl ?? null,
    createdAt: extra.createdAt,
  };
}

function readStoredSession(): Session | null {
  try {
    const token = localStorage.getItem('token');
    const rawUser = localStorage.getItem('user');
    if (!token || !rawUser) return null;
    const user = toUser(JSON.parse(rawUser) as User);
    if (!user?.id || !user.role) return null;
    return { user, token };
  } catch {
    return null;
  }
}

function persistSession(session: Session | null) {
  cachedSession = session;
  try {
    if (session) {
      localStorage.setItem('token', session.token);
      localStorage.setItem('user', JSON.stringify(session.user));
      return;
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  } catch {
    // Private mode can block storage.
  }
}

function isUnauthorized(error: unknown) {
  return error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403);
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

export function homePathForUser(user: User) {
  if (user.role === 'ADMIN') return '/admin';
  if (user.role === 'EMPLOYEE' || user.employeeId) return '/professional';
  return '/';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(cachedSession?.user ?? null);
  const [token, setToken] = useState<string | null>(cachedSession?.token ?? null);
  const [isLoading, setIsLoading] = useState(!cachedSession);

  const applySession = useCallback((session: Session | null) => {
    const next = session ? { user: toUser(session.user), token: session.token } : null;
    persistSession(next);
    setUser(next?.user ?? null);
    setToken(next?.token ?? null);
  }, []);

  const login = useCallback(
    (userData: User, authToken: string) => {
      applySession({ user: userData, token: authToken });
    },
    [applySession],
  );

  const logout = useCallback(() => {
    applySession(null);
  }, [applySession]);

  const updateUser = useCallback(
    (userData: User) => {
      if (!cachedSession?.token) return;
      applySession({ user: userData, token: cachedSession.token });
    },
    [applySession],
  );

  const refreshUser = useCallback(async () => {
    try {
      const response = await getMe();
      if (response.data?.user && cachedSession?.token) {
        applySession({ user: response.data.user, token: cachedSession.token });
      }
    } catch (error) {
      if (isUnauthorized(error)) logout();
    }
  }, [applySession, logout]);

  useEffect(() => {
    const stored = cachedSession ?? readStoredSession();
    if (!stored) {
      setIsLoading(false);
      return undefined;
    }

    applySession(stored);
    setIsLoading(false);

    const controller = new AbortController();
    getMe(controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        if (response.data?.user) {
          applySession({ user: response.data.user, token: stored.token });
        }
      })
      .catch((error) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        if (isUnauthorized(error)) logout();
      });

    return () => controller.abort();
  }, [applySession, logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        login,
        logout,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
