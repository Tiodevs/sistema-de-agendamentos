'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import {
  ADMIN_THEME_STORAGE_KEY,
  isAppThemePath,
  prefersLightMediaQuery,
  resolveAppTheme,
  type AppColorMode,
} from '@/lib/admin-theme-script';

export type AdminColorMode = AppColorMode;

type AdminThemeContextValue = {
  theme: AdminColorMode;
  setTheme: (theme: AdminColorMode) => void;
  toggleTheme: () => void;
  mounted: boolean;
};

const AdminThemeContext = createContext<AdminThemeContextValue | null>(null);

function applyHtmlTheme(theme: AdminColorMode) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

/** Navegação privada ou storage bloqueado: sem escolha salva, vale o tema do sistema. */
function readStoredTheme() {
  try {
    return window.localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isThemed = isAppThemePath(pathname);
  const [theme, setThemeState] = useState<AdminColorMode>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!isThemed) {
      applyHtmlTheme('dark');
      setThemeState('dark');
      setMounted(true);
      return;
    }

    // ARQ-10: a escolha salva manda; sem ela, o tema segue o sistema (prefers-color-scheme),
    // inclusive se o sistema trocar de tema com a página aberta.
    const media = prefersLightMediaQuery();
    const sync = () => {
      const next = resolveAppTheme(readStoredTheme(), media?.matches ?? false);
      setThemeState(next);
      applyHtmlTheme(next);
    };
    sync();
    setMounted(true);
    // Safari antigo não tem addEventListener na consulta: lá o tema só não acompanha ao vivo.
    media?.addEventListener?.('change', sync);

    return () => {
      media?.removeEventListener?.('change', sync);
      applyHtmlTheme('dark');
    };
  }, [isThemed]);

  const setTheme = useCallback(
    (next: AdminColorMode) => {
      setThemeState(next);
      if (isThemed) {
        try {
          window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, next);
        } catch {
          // Sem storage o tema vale só nesta visita.
        }
        applyHtmlTheme(next);
      }
    },
    [isThemed],
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, mounted }),
    [mounted, setTheme, theme, toggleTheme],
  );

  return <AdminThemeContext.Provider value={value}>{children}</AdminThemeContext.Provider>;
}

export function useAdminTheme() {
  const context = useContext(AdminThemeContext);
  if (!context) {
    throw new Error('useAdminTheme deve ser usado dentro de AdminThemeProvider');
  }
  return context;
}
