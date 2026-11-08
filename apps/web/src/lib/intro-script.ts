// Abertura animada da Leemia (UX-04): só em "/", só para visitante (sem sessão), no máximo uma
// vez por aparelho dentro de INTRO_TTL_MS, nunca com prefers-reduced-motion. Links de e-mail
// (reset de senha, confirmação), login, cadastro e as áreas do app abrem direto.
//
// Este arquivo não importa nada: o layout injeta o script antes da hidratação, os testes de
// apps/web/test rodam fora do Next e o E2E importa as chaves daqui.

/** Chave antiga, por aba (sessionStorage). Ainda conta como "já viu nesta aba". */
export const INTRO_STORAGE_KEY = 'leemia-intro-v1';
/** Quando este aparelho viu a abertura (localStorage, epoch em ms). */
export const INTRO_SEEN_AT_KEY = 'leemia-intro-seen-at';
/** Depois desse prazo a abertura pode voltar para quem não está logado. */
export const INTRO_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const INTRO_DURATION_MS = 4000;
/**
 * Abertura que só começaria depois disso (rede lenta) é pulada: a página já está à vista e uma
 * abertura atrasada é pior do que nenhuma. O véu do CSS (globals.css) some logo depois, mesmo
 * se o JavaScript nunca carregar, então a tela nunca fica preta.
 */
export const INTRO_LATE_START_MS = 2500;

/** Mesma chave do token da sessão em hooks/use-auth. */
const SESSION_TOKEN_KEY = 'token';
const FORCE_PATTERN_SOURCE = '(?:^|[?&])intro=1(?:&|$)';

export type IntroEnvironment = {
  pathname: string;
  search: string;
  reducedMotion: boolean;
  hasSession: boolean;
  seenInTab: boolean;
  seenAt: number | null;
  now: number;
};

/** `/?intro=1` força a abertura (demonstração), mas só na home. */
export function isIntroForced(search: string): boolean {
  return new RegExp(FORCE_PATTERN_SOURCE).test(search);
}

export function parseIntroSeenAt(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function shouldPlayIntro(env: IntroEnvironment): boolean {
  if (env.pathname !== '/') return false;
  if (isIntroForced(env.search)) return true;
  if (env.reducedMotion || env.hasSession || env.seenInTab) return false;
  if (env.seenAt !== null && env.now - env.seenAt < INTRO_TTL_MS) return false;
  return true;
}

/**
 * Roda no <head>, antes da hidratação, com a mesma regra de `shouldPlayIntro`: liga o véu escuro
 * para a landing não piscar antes da abertura. Qualquer erro (storage bloqueado) = sem abertura.
 */
export const introBootstrapScript = `(function(){try{if(location.pathname!=='/')return;var force=/${FORCE_PATTERN_SOURCE}/.test(location.search);if(!force){if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;if(localStorage.getItem('${SESSION_TOKEN_KEY}'))return;if(sessionStorage.getItem('${INTRO_STORAGE_KEY}')==='1')return;var seen=Number(localStorage.getItem('${INTRO_SEEN_AT_KEY}'));if(isFinite(seen)&&seen>0&&Date.now()-seen<${INTRO_TTL_MS})return}document.documentElement.dataset.leemiaIntro='1'}catch(e){}})();`;

function readIntroEnvironment(): IntroEnvironment {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    hasSession: Boolean(window.localStorage.getItem(SESSION_TOKEN_KEY)),
    seenInTab: window.sessionStorage.getItem(INTRO_STORAGE_KEY) === '1',
    seenAt: parseIntroSeenAt(window.localStorage.getItem(INTRO_SEEN_AT_KEY)),
    now: Date.now(),
  };
}

/** A decisão do navegador; storage inacessível (modo privado restrito) = sem abertura. */
export function shouldPlayIntroNow(): boolean {
  try {
    return shouldPlayIntro(readIntroEnvironment());
  } catch {
    return false;
  }
}

export function markIntroSeen(now = Date.now()) {
  try {
    window.localStorage.setItem(INTRO_SEEN_AT_KEY, String(now));
  } catch {
    // Storage bloqueado: a regra acima já não toca a abertura nesse caso.
  }
  try {
    window.sessionStorage.setItem(INTRO_STORAGE_KEY, '1');
  } catch {
    // idem
  }
}

export function clearIntroPlaceholder() {
  document.documentElement.removeAttribute('data-leemia-intro');
}
