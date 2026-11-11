export const ADMIN_THEME_STORAGE_KEY = 'admin-theme';

export type AppColorMode = 'dark' | 'light';

/**
 * Rotas que seguem o tema claro/escuro. As telas de link de e-mail (esqueci a senha, redefinir,
 * confirmar e-mail, convite) usam o mesmo cartão do login e o mesmo botão de tema, então
 * entram aqui também (ARQ-10): antes o botão aparecia nelas e não fazia nada.
 */
export const APP_THEME_PREFIXES = [
  '/admin',
  '/professional',
  '/book',
  '/appointments',
  '/profile',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/confirm-email',
  '/accept-invite',
];

const PREFERS_LIGHT_QUERY = '(prefers-color-scheme: light)';

function hasStoredSession() {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.localStorage.getItem('token'));
  } catch {
    return false;
  }
}

/**
 * `/` serves the institutional page for visitors (always dark) and the client
 * home for a logged-in user (light/dark toggle).
 */
export function isAppThemePath(pathname: string) {
  if (pathname === '/') return hasStoredSession();
  return APP_THEME_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * ARQ-10: quem já escolheu um tema fica com ele; quem nunca escolheu segue o sistema
 * (`prefers-color-scheme`). Sem como perguntar ao sistema, vale o escuro de antes.
 */
export function resolveAppTheme(stored: string | null, prefersLight: boolean): AppColorMode {
  if (stored === 'light' || stored === 'dark') return stored;
  return prefersLight ? 'light' : 'dark';
}

/** A consulta ao tema do sistema; `null` se o navegador não souber responder. */
export function prefersLightMediaQuery() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(PREFERS_LIGHT_QUERY);
}

/**
 * Roda no <head>, antes da primeira pintura, para a tela não piscar no tema errado.
 * Mesma regra de `isAppThemePath` + `resolveAppTheme` (o teste compara as duas).
 */
export const adminThemeBootstrapScript = `(function(){try{var root=document.documentElement;var p=location.pathname;var app=${JSON.stringify(
  APP_THEME_PREFIXES,
)}.some(function(x){return p.indexOf(x)===0});var themed=p==='/'?!!localStorage.getItem('token'):app;var theme='dark';if(themed){var s=localStorage.getItem('${ADMIN_THEME_STORAGE_KEY}');theme=s==='light'||s==='dark'?s:(window.matchMedia&&window.matchMedia('${PREFERS_LIGHT_QUERY}').matches?'light':'dark')}if(theme==='dark'){root.classList.add('dark')}else{root.classList.remove('dark')}root.style.colorScheme=theme}catch(e){document.documentElement.classList.add('dark')}})();`;
