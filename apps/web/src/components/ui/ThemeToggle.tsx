'use client';

import { useTheme } from '@/hooks/useTheme';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === 'orange' ? 'indigo' : 'orange';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius-md)] text-[var(--text-soft)] transition hover:bg-[var(--accent-muted)] hover:text-[var(--accent)]"
      aria-label={`切换到${next === 'orange' ? '橙暖' : '靛蓝'}主题`}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <clipPath id="left-half">
          <rect x="0" y="0" width="10" height="20" />
        </clipPath>
        <clipPath id="right-half">
          <rect x="10" y="0" width="10" height="20" />
        </clipPath>
        <circle cx="10" cy="10" r="8" fill="#f97316" clipPath="url(#left-half)"
          opacity={theme === 'orange' ? 1 : 0.35} className="transition-opacity" />
        <circle cx="10" cy="10" r="8" fill="#6366f1" clipPath="url(#right-half)"
          opacity={theme === 'indigo' ? 1 : 0.35} className="transition-opacity" />
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      </svg>
    </button>
  );
}
