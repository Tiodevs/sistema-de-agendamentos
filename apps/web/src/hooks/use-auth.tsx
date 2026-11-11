'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  getMe,
  isAbortError,
  logoutSession,
  setUnauthorizedHandler,
  type AuthData,
} from '@/lib/api';
import { isPublicAuthPath, loginPathWithNext, resolvePostAuthPath } from '@/lib/route-access';
import { clearSessionCookie, hasSessionCookie, writeSessionCookie } from '@/lib/session-cookie';

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
  logout: (options?: { notifyServer?: boolean }) => Promise<void>;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

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
    pendingEmail: extra.pendingEmail ?? null,
    // Sessão salva antes do campo existir: assume confirmado até o /me responder.
    emailVerified: extra.emailVerified ?? true,
    createdAt: extra.createdAt,
  };
}

function readStoredSession(): Session | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);
    if (!token || !rawUser) return null;
    const user = toUser(JSON.parse(rawUser) as User);
    if (!user?.id || !user.role) return null;
    return { user, token };
  } catch {
    return null;
  }
}

function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** ARQ-11: o cookie de "sessão presente" acompanha a sessão; o token fica só no localStorage. */
function syncSessionCookie(session: Session | null) {
  if (session) writeSessionCookie(session.user.role);
  else clearSessionCookie();
}

function persistSession(session: Session | null) {
  cachedSession = session;
  syncSessionCookie(session);
  try {
    if (session) {
      localStorage.setItem(TOKEN_KEY, session.token);
      localStorage.setItem(USER_KEY, JSON.stringify(session.user));
      return;
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // Private mode can block storage.
  }
}

function isUnauthorized(error: unknown) {
  return error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403);
}

export function homePathForUser(user: User) {
  if (user.role === 'ADMIN') return '/admin';
  if (user.role === 'EMPLOYEE' || user.employeeId) return '/professional';
  return '/';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
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
      // Entrou enquanto uma sessão antiga ainda era conferida: a nova já vale.
      setIsLoading(false);
    },
    [applySession],
  );

  const logout = useCallback(
    async (options?: { notifyServer?: boolean }) => {
      if (options?.notifyServer !== false && cachedSession?.token) {
        try {
          await logoutSession();
        } catch {
          // The local session is cleared even if the API is unreachable.
        }
      }
      applySession(null);
    },
    [applySession],
  );

  const updateUser = useCallback(
    (userData: User) => {
      if (!cachedSession?.token) return;
      applySession({ user: userData, token: cachedSession.token });
    },
    [applySession],
  );

  const refreshUser = useCallback(async () => {
    const tokenAtStart = cachedSession?.token;
    try {
      const response = await getMe();
      // Só atualiza se a sessão ainda é a mesma de quando a chamada saiu.
      if (response.data?.user && tokenAtStart && cachedSession?.token === tokenAtStart) {
        applySession({ user: response.data.user, token: tokenAtStart });
      }
    } catch (error) {
      if (isUnauthorized(error)) void logout({ notifyServer: false });
    }
  }, [applySession, logout]);

  useEffect(() => {
    const stored = cachedSession ?? readStoredSession();
    if (!stored) {
      // Cookie sem token (storage limpo): apaga, senão o middleware mandaria o login para a home.
      clearSessionCookie();
      setIsLoading(false);
      return undefined;
    }

    // ARQ-11: com o cookie, a sessão salva vale na hora e o /me confirma por trás. Sem ele (sessão
    // de antes do cookie existir, ou cookie de 12 h vencido), ela só vale depois de a API
    // confirmar o token: quem volta com token vencido não vê o painel piscar antes do login.
    const trusted = cachedSession !== null || hasSessionCookie();
    if (trusted) {
      applySession(stored);
      setIsLoading(false);
    }

    const controller = new AbortController();
    // Outra sessão entrou (ou esta saiu) enquanto o /me estava no ar: a resposta não vale mais.
    const isCurrent = () => !controller.signal.aborted && readStoredToken() === stored.token;

    getMe(controller.signal)
      .then((response) => {
        if (!isCurrent()) return;
        applySession({ user: response.data?.user ?? stored.user, token: stored.token });
      })
      .catch((error) => {
        if (isAbortError(error) || !isCurrent()) return;
        if (isUnauthorized(error)) {
          applySession(null);
          return;
        }
        // API fora do ar ou lenta: segue com a sessão salva, como já era.
        if (!trusted) applySession(stored);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [applySession]);

  // ARQ-09: ponto único do 401. O JWT dura 12 h; quando uma chamada autenticada volta 401, a
  // sessão sai e a pessoa vai para o login com o caminho de volta.
  useEffect(() => {
    setUnauthorizedHandler((failedToken) => {
      // Chamadas paralelas voltam 401 juntas: só a primeira age. Resposta atrasada de uma sessão
      // antiga não derruba a atual.
      if (!cachedSession || cachedSession.token !== failedToken) return;
      applySession(null);
      const { pathname, search } = window.location;
      if (isPublicAuthPath(pathname)) return;
      router.replace(loginPathWithNext(`${pathname}${search}`));
    });
    return () => setUnauthorizedHandler(null);
  }, [applySession, router]);

  // ARQ-11: sair (ou entrar com outra conta) em uma aba vale para as outras. O evento `storage`
  // só chega nas outras abas. Em rota privada, o shell leva ao login quando a sessão some.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== null && event.key !== TOKEN_KEY && event.key !== USER_KEY) return;
      const stored = readStoredSession();
      if (!stored && !cachedSession) return;
      // Só o estado desta aba muda: o localStorage já foi escrito pela outra.
      cachedSession = stored;
      syncSessionCookie(stored);
      setUser(stored?.user ?? null);
      setToken(stored?.token ?? null);
      if (stored) setIsLoading(false);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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

/**
 * Login e cadastro: quem já tem sessão (ou acabou de entrar) segue para o `next` ou para a home
 * do papel (UX-08). `next` já deve ter passado por `safeNextPath`.
 */
export function useRedirectAuthenticated(next: string | null) {
  const { user, isAuthenticated, isLoading, refreshUser } = useAuth();
  const router = useRouter();
  const recheckedRef = useRef(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    // Aba parada além das 12 h: o cookie venceu e o middleware devolveria a pessoa para cá, em
    // laço. Confere a sessão na API uma vez: ou o cookie volta, ou o 401 central encerra a sessão.
    if (!hasSessionCookie()) {
      if (!recheckedRef.current) {
        recheckedRef.current = true;
        void refreshUser();
      }
      return;
    }
    router.replace(resolvePostAuthPath(homePathForUser(user), next));
  }, [isLoading, isAuthenticated, user, next, refreshUser, router]);
}
