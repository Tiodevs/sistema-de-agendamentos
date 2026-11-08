import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  INTRO_SEEN_AT_KEY,
  INTRO_STORAGE_KEY,
  INTRO_TTL_MS,
  introBootstrapScript,
  shouldPlayIntro,
  type IntroEnvironment,
} from '../src/lib/intro-script';

const NOW = Date.parse('2026-11-08T12:00:00-03:00');

const visitor: IntroEnvironment = {
  pathname: '/',
  search: '',
  reducedMotion: false,
  hasSession: false,
  seenInTab: false,
  seenAt: null,
  now: NOW,
};

/** Roda o script do <head> num navegador de mentira e diz se ele ligou o véu da abertura. */
function bootstrapTurnsVeilOn(env: IntroEnvironment): boolean {
  const local = new Map<string, string>();
  const session = new Map<string, string>();
  if (env.hasSession) local.set('token', 'jwt');
  if (env.seenAt !== null) local.set(INTRO_SEEN_AT_KEY, String(env.seenAt));
  if (env.seenInTab) session.set(INTRO_STORAGE_KEY, '1');

  const storage = (map: Map<string, string>) => ({
    getItem: (key: string) => map.get(key) ?? null,
  });
  const dataset: Record<string, string> = {};
  const fakeDate = { now: () => env.now };

  const run = new Function(
    'location',
    'window',
    'localStorage',
    'sessionStorage',
    'document',
    'Date',
    introBootstrapScript,
  );
  run(
    { pathname: env.pathname, search: env.search },
    { matchMedia: () => ({ matches: env.reducedMotion }) },
    storage(local),
    storage(session),
    { documentElement: { dataset } },
    fakeDate,
  );
  return dataset.leemiaIntro === '1';
}

const cases: Array<[string, Partial<IntroEnvironment>, boolean]> = [
  ['visitante na home, primeira vez', {}, true],
  ['link de redefinir senha', { pathname: '/reset-password' }, false],
  ['confirmação de e-mail', { pathname: '/confirm-email' }, false],
  ['login', { pathname: '/login' }, false],
  ['cadastro', { pathname: '/register' }, false],
  ['área do cliente', { pathname: '/book' }, false],
  ['admin', { pathname: '/admin' }, false],
  ['profissional', { pathname: '/professional/agenda' }, false],
  ['cliente logado na home', { hasSession: true }, false],
  ['prefers-reduced-motion', { reducedMotion: true }, false],
  ['já viu nesta aba (chave antiga)', { seenInTab: true }, false],
  ['viu há uma hora', { seenAt: NOW - 60 * 60 * 1000 }, false],
  ['viu dentro do prazo', { seenAt: NOW - INTRO_TTL_MS + 1000 }, false],
  ['prazo vencido', { seenAt: NOW - INTRO_TTL_MS - 1000 }, true],
  ['?intro=1 força na home', { search: '?intro=1', hasSession: true, seenInTab: true }, true],
  ['?intro=1 não vale fora da home', { pathname: '/login', search: '?intro=1' }, false],
];

describe('abertura só na home, para visitante, uma vez por aparelho (UX-04)', () => {
  for (const [label, override, expected] of cases) {
    it(label, () => {
      const env = { ...visitor, ...override };
      assert.equal(shouldPlayIntro(env), expected, 'regra do provider');
      assert.equal(bootstrapTurnsVeilOn(env), expected, 'script do <head>');
    });
  }

  it('storage bloqueado: o script não liga o véu', () => {
    const dataset: Record<string, string> = {};
    const blocked = {
      getItem: () => {
        throw new Error('SecurityError');
      },
    };
    new Function(
      'location',
      'window',
      'localStorage',
      'sessionStorage',
      'document',
      introBootstrapScript,
    )({ pathname: '/', search: '' }, { matchMedia: () => ({ matches: false }) }, blocked, blocked, {
      documentElement: { dataset },
    });
    assert.equal(dataset.leemiaIntro, undefined);
  });
});
