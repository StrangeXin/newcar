'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type Theme = 'orange' | 'indigo';

const STORAGE_KEY = 'theme';
const DEFAULT_THEME: Theme = 'orange';

function getThemeSnapshot(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  return (localStorage.getItem(STORAGE_KEY) as Theme) || DEFAULT_THEME;
}

function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

function subscribe(callback: () => void): () => void {
  function onStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) callback();
  }
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.setAttribute('data-theme', next);
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: next }));
  }, []);

  return { theme, setTheme };
}
