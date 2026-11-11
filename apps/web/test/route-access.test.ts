import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  homePathForRole,
  isPrivatePath,
  isPublicAuthPath,
  loginPathWithNext,
  parseSessionRole,
  resolvePostAuthPath,
  routeRedirect,
} from '../src/lib/route-access';
import {
  SESSION_COOKIE_MAX_AGE,
  clearedSessionCookieStrings,
  cookieHeaderHasSession,
  sessionCookieStrings,
  sessionRoleOf,
} from '../src/lib/session-cookie';

describe('rotas privadas e públicas (ARQ-11)', () => {
  it('admin, profissional e as telas do cliente pedem sessão', () => {
    for (const path of [
      '/admin',
      '/admin/clients/42',
      '/professional',
      '/professional/agenda',
      '/book',
      '/appointments',
      '/profile',
    ]) {
      assert.equal(isPrivatePath(path), true, path);
    }
  });

  it('landing e telas de conta abrem sem sessão', () => {
    for (const path of ['/', '/login', '/register', '/forgot-password', '/accept-invite']) {
      assert.equal(isPrivatePath(path), false, path);
    }
  });

  it('não confunde prefixo parecido com a área', () => {
    assert.equal(isPrivatePath('/administrador'), false);
    assert.equal(isPrivatePath('/booking'), false);
    assert.equal(isPublicAuthPath('/login-ajuda'), false);
  });

  it('reconhece as telas públicas de conta', () => {
    for (const path of [
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
      '/confirm-email',
      '/accept-invite',
    ]) {
      assert.equal(isPublicAuthPath(path), true, path);
    }
    assert.equal(isPublicAuthPath('/'), false);
    assert.equal(isPublicAuthPath('/book'), false);
  });

  it('lê o papel do cookie e acha a home de cada um', () => {
    assert.equal(parseSessionRole('ADMIN'), 'ADMIN');
    assert.equal(parseSessionRole('admin'), null);
    assert.equal(parseSessionRole(undefined), null);
    assert.equal(homePathForRole('ADMIN'), '/admin');
    assert.equal(homePathForRole('EMPLOYEE'), '/professional');
    assert.equal(homePathForRole('USER'), '/');
    assert.equal(homePathForRole(null), '/');
  });
});

describe('destino depois de entrar (UX-08)', () => {
  it('cliente segue para o next', () => {
    assert.equal(resolvePostAuthPath('/', '/book?productId=abc'), '/book?productId=abc');
    assert.equal(resolvePostAuthPath('/', '/appointments'), '/appointments');
  });

  it('cliente não vai para a área de admin ou profissional', () => {
    assert.equal(resolvePostAuthPath('/', '/admin/clients'), '/');
    assert.equal(resolvePostAuthPath('/', '/professional'), '/');
  });

  it('admin e profissional só seguem o next da própria área', () => {
    assert.equal(resolvePostAuthPath('/admin', '/book'), '/admin');
    assert.equal(resolvePostAuthPath('/admin', '/admin/clients/42'), '/admin/clients/42');
    assert.equal(resolvePostAuthPath('/admin', '/professional/agenda'), '/admin');
    assert.equal(
      resolvePostAuthPath('/professional', '/professional/agenda'),
      '/professional/agenda',
    );
    assert.equal(resolvePostAuthPath('/professional', '/admin'), '/professional');
  });

  it('next ausente, inseguro ou de tela de conta cai na home', () => {
    assert.equal(resolvePostAuthPath('/', null), '/');
    assert.equal(resolvePostAuthPath('/', 'https://evil.example'), '/');
    assert.equal(resolvePostAuthPath('/', '//evil.example'), '/');
    assert.equal(resolvePostAuthPath('/', '/login?next=/book'), '/');
    assert.equal(resolvePostAuthPath('/admin', '/register'), '/admin');
  });

  it('monta o login com o caminho de volta', () => {
    assert.equal(
      loginPathWithNext('/admin/clients?page=2'),
      '/login?next=%2Fadmin%2Fclients%3Fpage%3D2',
    );
    assert.equal(loginPathWithNext('/book'), '/login?next=%2Fbook');
  });

  it('login sem next quando ele não ajuda', () => {
    assert.equal(loginPathWithNext('/'), '/login');
    assert.equal(loginPathWithNext('/login?next=%2Fbook'), '/login');
    assert.equal(loginPathWithNext('//evil.example'), '/login');
    assert.equal(loginPathWithNext(null), '/login');
  });
});

describe('decisão do middleware (ARQ-11)', () => {
  const visitor = { hasSession: false, role: null };

  it('sem cookie, rota privada vai para o login com next', () => {
    assert.equal(
      routeRedirect({ pathname: '/admin/clients', search: '?page=2', ...visitor }),
      '/login?next=%2Fadmin%2Fclients%3Fpage%3D2',
    );
    assert.equal(
      routeRedirect({ pathname: '/book', search: '?productId=abc', ...visitor }),
      '/login?next=%2Fbook%3FproductId%3Dabc',
    );
    assert.equal(
      routeRedirect({ pathname: '/profile', search: '', ...visitor }),
      '/login?next=%2Fprofile',
    );
  });

  it('sem cookie, rota pública segue', () => {
    for (const pathname of ['/', '/login', '/register', '/reset-password', '/accept-invite']) {
      assert.equal(routeRedirect({ pathname, search: '', ...visitor }), null, pathname);
    }
  });

  it('com cookie, login e cadastro vão para a home do papel', () => {
    assert.equal(
      routeRedirect({ pathname: '/login', search: '', hasSession: true, role: 'ADMIN' }),
      '/admin',
    );
    assert.equal(
      routeRedirect({ pathname: '/register', search: '', hasSession: true, role: 'EMPLOYEE' }),
      '/professional',
    );
    assert.equal(
      routeRedirect({ pathname: '/login', search: '', hasSession: true, role: 'USER' }),
      '/',
    );
    assert.equal(
      routeRedirect({ pathname: '/login', search: '', hasSession: true, role: null }),
      '/',
    );
  });

  it('com cookie, login com next respeita o papel', () => {
    const search = '?next=%2Fbook%3FproductId%3Dabc';
    assert.equal(
      routeRedirect({ pathname: '/register', search, hasSession: true, role: 'USER' }),
      '/book?productId=abc',
    );
    assert.equal(
      routeRedirect({ pathname: '/login', search, hasSession: true, role: 'ADMIN' }),
      '/admin',
    );
    assert.equal(
      routeRedirect({
        pathname: '/login',
        search: '?next=https%3A%2F%2Fevil.example',
        hasSession: true,
        role: 'USER',
      }),
      '/',
    );
  });

  it('com cookie, admin e profissional não ficam na landing', () => {
    assert.equal(
      routeRedirect({ pathname: '/', search: '', hasSession: true, role: 'ADMIN' }),
      '/admin',
    );
    assert.equal(
      routeRedirect({ pathname: '/', search: '', hasSession: true, role: 'EMPLOYEE' }),
      '/professional',
    );
    assert.equal(
      routeRedirect({ pathname: '/', search: '', hasSession: true, role: 'USER' }),
      null,
    );
  });

  it('com cookie, as demais rotas seguem (o papel é conferido no cliente e na API)', () => {
    assert.equal(
      routeRedirect({ pathname: '/admin', search: '', hasSession: true, role: 'USER' }),
      null,
    );
    assert.equal(
      routeRedirect({ pathname: '/book', search: '', hasSession: true, role: 'USER' }),
      null,
    );
    assert.equal(
      routeRedirect({ pathname: '/forgot-password', search: '', hasSession: true, role: 'USER' }),
      null,
    );
  });

  it('nunca manda para o mesmo lugar (sem laço)', () => {
    for (const role of ['ADMIN', 'EMPLOYEE', 'USER', null] as const) {
      for (const pathname of ['/', '/admin', '/professional', '/book']) {
        const target = routeRedirect({ pathname, search: '', hasSession: true, role });
        assert.notEqual(target, pathname);
        if (target) {
          assert.equal(
            routeRedirect({ pathname: target, search: '', hasSession: true, role }),
            null,
          );
        }
      }
    }
    const login = routeRedirect({ pathname: '/admin', search: '', ...visitor });
    assert.ok(login);
    assert.equal(
      routeRedirect({ pathname: '/login', search: login.slice('/login'.length), ...visitor }),
      null,
    );
  });
});

describe('cookie de sessão (ARQ-11)', () => {
  it('marca a sessão e o papel, sem token, por 12 h', () => {
    const lines = sessionCookieStrings('ADMIN', true);
    assert.deepEqual(lines, [
      `leemia_session=1; Path=/; Max-Age=${SESSION_COOKIE_MAX_AGE}; SameSite=Lax; Secure`,
      `leemia_role=ADMIN; Path=/; Max-Age=${SESSION_COOKIE_MAX_AGE}; SameSite=Lax; Secure`,
    ]);
    assert.equal(SESSION_COOKIE_MAX_AGE, 12 * 60 * 60);
  });

  it('sem https não leva Secure (dev local)', () => {
    for (const line of sessionCookieStrings('USER', false)) {
      assert.equal(line.includes('Secure'), false);
    }
  });

  it('apaga com Max-Age=0 nos mesmos atributos', () => {
    assert.deepEqual(clearedSessionCookieStrings(false), [
      'leemia_session=; Path=/; Max-Age=0; SameSite=Lax',
      'leemia_role=; Path=/; Max-Age=0; SameSite=Lax',
    ]);
  });

  it('papel desconhecido conta como cliente', () => {
    assert.equal(sessionRoleOf('ADMIN'), 'ADMIN');
    assert.equal(sessionRoleOf('EMPLOYEE'), 'EMPLOYEE');
    assert.equal(sessionRoleOf('SUPERUSER'), 'USER');
    assert.equal(sessionRoleOf(null), 'USER');
  });

  it('acha a marca da sessão no cabeçalho de cookies', () => {
    assert.equal(cookieHeaderHasSession('leemia_session=1; leemia_role=USER'), true);
    assert.equal(cookieHeaderHasSession('tema=dark;leemia_session=1'), true);
    assert.equal(cookieHeaderHasSession('leemia_role=USER'), false);
    assert.equal(cookieHeaderHasSession('leemia_session=; leemia_role='), false);
    assert.equal(cookieHeaderHasSession('outro_leemia_session=1'), false);
    assert.equal(cookieHeaderHasSession(''), false);
  });
});
