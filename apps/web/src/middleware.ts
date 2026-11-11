import { NextResponse, type NextRequest } from 'next/server';
import { parseSessionRole, routeRedirect } from '@/lib/route-access';
import { SESSION_COOKIE, SESSION_COOKIE_VALUE, SESSION_ROLE_COOKIE } from '@/lib/session-cookie';

/**
 * ARQ-11: proteção de rota no servidor, antes de qualquer HTML. Sem o cookie de sessão, rota
 * privada vai para `/login?next=...`; com ele, `/login` e `/register` vão para a home do papel
 * (ou para o `next`). O cookie não leva o token e pode ser forjado: isto só evita tela piscando
 * e redirecionamento no cliente. Os dados continuam protegidos pela API.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Query sem o parâmetro interno das navegações do App Router, para o `next` sair limpo.
  const params = new URLSearchParams(request.nextUrl.searchParams);
  params.delete('_rsc');
  const query = params.toString();

  const target = routeRedirect({
    pathname,
    search: query ? `?${query}` : '',
    hasSession: request.cookies.get(SESSION_COOKIE)?.value === SESSION_COOKIE_VALUE,
    role: parseSessionRole(request.cookies.get(SESSION_ROLE_COOKIE)?.value),
  });

  return target ? NextResponse.redirect(new URL(target, request.url)) : NextResponse.next();
}

export const config = {
  // Tudo, menos a API (rewrite), os arquivos do Next e qualquer arquivo estático (tem ponto).
  matcher: ['/((?!api/|_next/|.*\\..*).*)'],
};
