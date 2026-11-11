// ARQ-11: cookie de "sessão presente", para o servidor (middleware e a home) saber quem mandar
// para o login sem piscar a tela. NÃO leva o token, que continua no localStorage: é só dica de
// navegação, e forjar o cookie só mostra a casca vazia do painel. A API segue sendo a autoridade.
import { parseSessionRole, type SessionRole } from './route-access';

export const SESSION_COOKIE = 'leemia_session';
export const SESSION_ROLE_COOKIE = 'leemia_role';
export const SESSION_COOKIE_VALUE = '1';
/** Mesmo prazo do JWT (12 h). É renovado a cada carga de página com sessão válida. */
export const SESSION_COOKIE_MAX_AGE = 12 * 60 * 60;

function attributes(maxAge: number, secure: boolean) {
  return `Path=/; Max-Age=${maxAge}; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/** Papel que vai no cookie. Valor desconhecido conta como cliente (a home dele é "/"). */
export function sessionRoleOf(role: string | null | undefined): SessionRole {
  return parseSessionRole(role) ?? 'USER';
}

/** Linhas para `document.cookie` que marcam a sessão. */
export function sessionCookieStrings(role: SessionRole, secure: boolean) {
  const attrs = attributes(SESSION_COOKIE_MAX_AGE, secure);
  return [
    `${SESSION_COOKIE}=${SESSION_COOKIE_VALUE}; ${attrs}`,
    `${SESSION_ROLE_COOKIE}=${role}; ${attrs}`,
  ];
}

/** Linhas para `document.cookie` que apagam a marca da sessão. */
export function clearedSessionCookieStrings(secure: boolean) {
  const attrs = attributes(0, secure);
  return [`${SESSION_COOKIE}=; ${attrs}`, `${SESSION_ROLE_COOKIE}=; ${attrs}`];
}

/** Lê o cabeçalho/`document.cookie` e diz se a marca da sessão está lá. */
export function cookieHeaderHasSession(cookieHeader: string) {
  return cookieHeader
    .split(';')
    .some((part) => part.trim() === `${SESSION_COOKIE}=${SESSION_COOKIE_VALUE}`);
}

function isSecureContext() {
  return typeof window !== 'undefined' && window.location.protocol === 'https:';
}

function write(lines: string[]) {
  if (typeof document === 'undefined') return;
  try {
    for (const line of lines) document.cookie = line;
  } catch {
    // Cookies bloqueados: a proteção no cliente (shell) continua valendo.
  }
}

export function writeSessionCookie(role: string | null | undefined) {
  write(sessionCookieStrings(sessionRoleOf(role), isSecureContext()));
}

export function clearSessionCookie() {
  write(clearedSessionCookieStrings(isSecureContext()));
}

export function hasSessionCookie() {
  if (typeof document === 'undefined') return false;
  try {
    return cookieHeaderHasSession(document.cookie);
  } catch {
    return false;
  }
}
