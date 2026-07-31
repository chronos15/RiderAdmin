import { useEffect, useState } from 'react';
import type { ThemeMode } from '../types/admin';

const storageKey = 'riderx-admin-theme';

export function useTheme() {
  const preferred = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const [theme, setTheme] = useState<ThemeMode>(() => (localStorage.getItem(storageKey) as ThemeMode) || preferred);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem(storageKey, theme);
  }, [theme]);

  return { theme, setTheme, toggleTheme: () => setTheme((value) => (value === 'dark' ? 'light' : 'dark')) };
}
