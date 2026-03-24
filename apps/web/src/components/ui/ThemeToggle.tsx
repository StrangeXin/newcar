'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === 'orange' ? 'indigo' : 'orange';
  const Icon = theme === 'orange' ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius-md)] text-[var(--text-soft)] transition hover:bg-[var(--accent-muted)] hover:text-[var(--accent)]"
      aria-label={`切换到${next === 'orange' ? '橙暖' : '靛蓝'}主题`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
