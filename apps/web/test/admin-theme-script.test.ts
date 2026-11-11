import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  ADMIN_THEME_STORAGE_KEY,
  APP_THEME_PREFIXES,
  adminThemeBootstrapScript,
  resolveAppTheme,
} from '../src/lib/admin-theme-script';

type Env = {
  pathname: string;
  stored: string | null;
  /** `null` = navegador sem `matchMedia`. */
  prefersLight: boolean | null;
  hasSession: boolean;
};

const base: Env = { pathname: '/admin', stored: null, prefersLight: false, hasSession: true };

/** Roda o script do <head> num navegador de mentira e devolve o tema que ele aplicou. */
function bootstrapTheme(env: Env): { dark: boolean; colorScheme: string } {
  const local = new Map<string, string>();
  if (env.hasSession) local.set('token', 'jwt');
  if (env.stored !== null) local.set(ADMIN_THEME_STORAGE_KEY, env.stored);

  // O servidor manda <html class="dark">; o script parte daí.
  const classes = new Set(['dark']);
  const style: { colorScheme?: string } = {};
  const documentElement = {
    classList: {
      add: (name: string) => classes.add(name),
      remove: (name: string) => classes.delete(name),
    },
    style,
  };
  const window =
    env.prefersLight === null ? {} : { matchMedia: () => ({ matches: env.prefersLight }) };

  new Function('location', 'window', 'localStorage', 'document', adminThemeBootstrapScript)(
    { pathname: env.pathname },
    window,
    { getItem: (key: string) => local.get(key) ?? null },
    { documentElement },
  );
  return { dark: classes.has('dark'), colorScheme: style.colorScheme ?? '' };
}

const cases: Array<[string, Partial<Env>, 'dark' | 'light']> = [
  ['nunca escolheu, sistema escuro', {}, 'dark'],
  ['nunca escolheu, sistema claro', { prefersLight: true }, 'light'],
  ['escolheu claro, sistema escuro', { stored: 'light' }, 'light'],
  ['escolheu escuro, sistema claro', { stored: 'dark', prefersLight: true }, 'dark'],
  ['valor desconhecido salvo segue o sistema', { stored: 'azul', prefersLight: true }, 'light'],
  ['navegador sem matchMedia fica no escuro', { prefersLight: null }, 'dark'],
  ['login segue o sistema', { pathname: '/login', hasSession: false, prefersLight: true }, 'light'],
  [
    'redefinir senha segue o sistema',
    { pathname: '/reset-password', hasSession: false, prefersLight: true },
    'light',
  ],
  ['cliente logado na home segue o sistema', { pathname: '/', prefersLight: true }, 'light'],
  [
    'landing (visitante na home) é sempre escura',
    { pathname: '/', hasSession: false, prefersLight: true, stored: 'light' },
    'dark',
  ],
];

describe('tema padrão segue o sistema; a escolha salva manda (ARQ-10)', () => {
  for (const [label, override, expected] of cases) {
    it(label, () => {
      const env = { ...base, ...override };
      const applied = bootstrapTheme(env);
      assert.equal(applied.dark, expected === 'dark', 'classe dark no <html>');
      assert.equal(applied.colorScheme, expected, 'color-scheme');
    });
  }

  it('resolveAppTheme: a regra do provider é a mesma do script', () => {
    assert.equal(resolveAppTheme(null, false), 'dark');
    assert.equal(resolveAppTheme(null, true), 'light');
    assert.equal(resolveAppTheme('light', false), 'light');
    assert.equal(resolveAppTheme('dark', true), 'dark');
    assert.equal(resolveAppTheme('azul', true), 'light');
  });

  it('storage bloqueado: o script cai no escuro em vez de quebrar', () => {
    const classes = new Set<string>();
    const blocked = {
      getItem: () => {
        throw new Error('SecurityError');
      },
    };
    new Function('location', 'window', 'localStorage', 'document', adminThemeBootstrapScript)(
      { pathname: '/' },
      { matchMedia: () => ({ matches: true }) },
      blocked,
      { documentElement: { classList: { add: (name: string) => classes.add(name) }, style: {} } },
    );
    assert.ok(classes.has('dark'));
  });

  it('as telas de link de e-mail entram no tema, como login e cadastro', () => {
    for (const path of [
      '/forgot-password',
      '/reset-password',
      '/confirm-email',
      '/accept-invite',
    ]) {
      assert.ok(APP_THEME_PREFIXES.includes(path), path);
    }
  });
});
