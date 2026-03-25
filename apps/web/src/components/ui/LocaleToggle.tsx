'use client';

import { useLocale } from '@/hooks/useLocale';

export function LocaleToggle() {
  const { locale, setLocale } = useLocale();
  const nextLocale = locale === 'zh' ? 'en' : 'zh';

  return (
    <button
      type="button"
      onClick={() => setLocale(nextLocale)}
      className="inline-flex h-8 cursor-pointer items-center justify-center rounded-[var(--radius-md)] px-2 text-[11px] font-semibold text-[var(--text-soft)] transition hover:bg-[var(--accent-muted)] hover:text-[var(--accent)]"
      aria-label={`Switch to ${nextLocale === 'zh' ? '中文' : 'English'}`}
    >
      {locale === 'zh' ? 'EN' : '中'}
    </button>
  );
}
