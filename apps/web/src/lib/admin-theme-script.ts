export const ADMIN_THEME_STORAGE_KEY = 'admin-theme';

export function isAppThemePath(pathname: string) {
  return (
    pathname.startsWith('/admin') ||
    pathname === '/' ||
    pathname.startsWith('/book') ||
    pathname.startsWith('/appointments')
  );
}

export const adminThemeBootstrapScript = `(function(){try{var root=document.documentElement;var p=location.pathname;var themed=p.indexOf('/admin')===0||p==='/'||p.indexOf('/book')===0||p.indexOf('/appointments')===0;if(themed&&localStorage.getItem('${ADMIN_THEME_STORAGE_KEY}')==='light'){root.classList.remove('dark');root.style.colorScheme='light'}else{root.classList.add('dark');root.style.colorScheme='dark'}}catch(e){document.documentElement.classList.add('dark')}})();`;
