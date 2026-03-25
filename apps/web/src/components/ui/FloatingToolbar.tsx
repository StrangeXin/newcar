'use client';

import { useLocale } from '@/hooks/useLocale';
import { ThemeToggle } from './ThemeToggle';

export function FloatingToolbar() {
  const { locale, setLocale } = useLocale();
  const nextLocale = locale === 'zh' ? 'en' : 'zh';

  return (
    <div className="fixed right-4 top-3 z-[60] flex items-center gap-1.5 rounded-full border border-[var(--border)]/60 bg-[var(--surface)]/80 px-1.5 py-1 shadow-[var(--shadow-sm)] backdrop-blur-md">
      <ThemeToggle />
      <div className="h-4 w-px bg-[var(--border)]" />
      <button
        type="button"
        onClick={() => setLocale(nextLocale)}
        className="inline-flex h-8 cursor-pointer items-center justify-center rounded-[var(--radius-md)] px-2 text-[11px] font-semibold text-[var(--text-soft)] transition hover:bg-[var(--accent-muted)] hover:text-[var(--accent)]"
        aria-label={`Switch to ${nextLocale === 'zh' ? '中文' : 'English'}`}
      >
        {locale === 'zh' ? 'EN' : '中'}
      </button>
    </div>
  );
}
