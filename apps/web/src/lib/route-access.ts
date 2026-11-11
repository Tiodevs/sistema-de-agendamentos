// ARQ-11: quais rotas pedem sessão e para onde cada papel vai. Lógica pura, usada pelo
// middleware (servidor), pelo AuthProvider e pelas telas de login e cadastro. É só navegação:
// quem protege os dados é a API.
import { pathnameOf, safeNextPath, withNext } from './safe-next';

export type SessionRole = 'ADMIN' | 'EMPLOYEE' | 'USER';

const ADMIN_AREA = '/admin';
const PROFESSIONAL_AREA = '/professional';
/** Rotas do grupo `(user)` em `src/app/(user)`. */
const CLIENT_AREAS = ['/book', '/appointments', '/profile'];

/** Telas que abrem sem sessão: o 401 central não tira ninguém daqui. */
const PUBLIC_AUTH_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/confirm-email',
  '/accept-invite',
];

function isUnder(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function isPublicAuthPath(pathname: string) {
  return PUBLIC_AUTH_PATHS.some((base) => isUnder(pathname, base));
}

export function isPrivatePath(pathname: string) {
  return (
    isUnder(pathname, ADMIN_AREA) ||
    isUnder(pathname, PROFESSIONAL_AREA) ||
    CLIENT_AREAS.some((base) => isUnder(pathname, base))
  );
}

export function parseSessionRole(value: string | null | undefined): SessionRole | null {
  return value === 'ADMIN' || value === 'EMPLOYEE' || value === 'USER' ? value : null;
}

export function homePathForRole(role: SessionRole | null) {
  if (role === 'ADMIN') return ADMIN_AREA;
  if (role === 'EMPLOYEE') return PROFESSIONAL_AREA;
  return '/';
}

/**
 * Destino depois de entrar ou cadastrar (UX-08). `home` é a home do papel. O cliente segue para
 * o `next`; admin e profissional só quando o `next` é da área deles, senão vão para a home.
 */
export function resolvePostAuthPath(home: string, next: string | null | undefined) {
  const safe = safeNextPath(next);
  if (!safe) return home;
  const pathname = pathnameOf(safe);
  if (isPublicAuthPath(pathname)) return home;
  if (home === ADMIN_AREA || home === PROFESSIONAL_AREA) {
    return isUnder(pathname, home) ? safe : home;
  }
  return isUnder(pathname, ADMIN_AREA) || isUnder(pathname, PROFESSIONAL_AREA) ? home : safe;
}

/** `/login?next=<onde a pessoa estava>`; sem `next` quando ele não ajuda (home ou tela pública). */
export function loginPathWithNext(currentPath: string | null | undefined) {
  const safe = safeNextPath(currentPath);
  if (!safe) return '/login';
  const pathname = pathnameOf(safe);
  if (pathname === '/' || isPublicAuthPath(pathname)) return '/login';
  return withNext('/login', safe);
}

/**
 * Decisão do middleware: devolve o caminho para redirecionar ou `null` para seguir.
 * `search` é a query da requisição (com `?`), já sem os parâmetros internos do Next.
 */
export function routeRedirect(input: {
  pathname: string;
  search: string;
  hasSession: boolean;
  role: SessionRole | null;
}): string | null {
  const { pathname, search, hasSession, role } = input;

  if (!hasSession) {
    return isPrivatePath(pathname) ? loginPathWithNext(`${pathname}${search}`) : null;
  }

  const home = homePathForRole(role);
  if (pathname === '/login' || pathname === '/register') {
    return resolvePostAuthPath(home, new URLSearchParams(search).get('next'));
  }
  // Admin e profissional não têm o que ver em "/": vão direto ao painel, sem passar pela landing.
  if (pathname === '/' && home !== '/') return home;
  return null;
}
