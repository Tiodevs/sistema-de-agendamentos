export const ADMIN_THEME_STORAGE_KEY = 'admin-theme';

const APP_THEME_PREFIXES = [
  '/admin',
  '/professional',
  '/book',
  '/appointments',
  '/profile',
  '/login',
  '/register',
];

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

export const adminThemeBootstrapScript = `(function(){try{var root=document.documentElement;var p=location.pathname;var app=p.indexOf('/admin')===0||p.indexOf('/professional')===0||p.indexOf('/book')===0||p.indexOf('/appointments')===0||p.indexOf('/profile')===0||p.indexOf('/login')===0||p.indexOf('/register')===0;var themed=p==='/'?!!localStorage.getItem('token'):app;if(themed&&localStorage.getItem('${ADMIN_THEME_STORAGE_KEY}')==='light'){root.classList.remove('dark');root.style.colorScheme='light'}else{root.classList.add('dark');root.style.colorScheme='dark'}}catch(e){document.documentElement.classList.add('dark')}})();`;
