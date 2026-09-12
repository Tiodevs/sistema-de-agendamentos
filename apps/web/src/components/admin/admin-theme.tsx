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
import { ADMIN_THEME_STORAGE_KEY, isAppThemePath } from '@/lib/admin-theme-script';

export type AdminColorMode = 'dark' | 'light';

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

    const stored = window.localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
    const next: AdminColorMode = stored === 'light' ? 'light' : 'dark';
    setThemeState(next);
    applyHtmlTheme(next);
    setMounted(true);

    return () => {
      applyHtmlTheme('dark');
    };
  }, [isThemed]);

  const setTheme = useCallback(
    (next: AdminColorMode) => {
      setThemeState(next);
      if (isThemed) {
        window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, next);
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
