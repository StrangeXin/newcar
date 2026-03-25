'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type Locale = 'zh' | 'en';

const STORAGE_KEY = 'locale';
const DEFAULT_LOCALE: Locale = 'zh';

function getLocaleSnapshot(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  return (localStorage.getItem(STORAGE_KEY) as Locale) || DEFAULT_LOCALE;
}

function getServerSnapshot(): Locale {
  return DEFAULT_LOCALE;
}

function subscribe(callback: () => void): () => void {
  function onStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) callback();
  }
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

export function useLocale() {
  const locale = useSyncExternalStore(subscribe, getLocaleSnapshot, getServerSnapshot);

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.setAttribute('data-locale', next);
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: next }));
  }, []);

  return { locale, setLocale };
}
