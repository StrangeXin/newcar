'use client';

import { LucideIcon } from 'lucide-react';

type BadgeTone = 'accent' | 'success' | 'warning' | 'neutral';
type BadgeSize = 'sm' | 'md';

const toneClassMap: Record<BadgeTone, string> = {
  accent: 'bg-[var(--accent-muted)] text-[var(--accent-text)]',
  success: 'bg-[var(--success-muted)] text-[var(--success-text)]',
  warning: 'bg-[var(--warning-muted)] text-[var(--warning-text)]',
  neutral: 'bg-[var(--surface-subtle)] text-[var(--text-soft)]',
};

const sizeClassMap: Record<BadgeSize, { shell: string; icon: string }> = {
  sm: { shell: 'h-7 w-7 rounded-[var(--radius-sm)]', icon: 'h-4 w-4' },
  md: { shell: 'h-9 w-9 rounded-[var(--radius-sm)]', icon: 'h-5 w-5' },
};

interface IconBadgeProps {
  icon: LucideIcon;
  tone?: BadgeTone;
  size?: BadgeSize;
  className?: string;
}

export function IconBadge({ icon: Icon, tone = 'accent', size = 'sm', className = '' }: IconBadgeProps) {
  const sizeClass = sizeClassMap[size];
  return (
    <span className={`inline-flex items-center justify-center ${sizeClass.shell} ${toneClassMap[tone]} ${className}`}>
      <Icon className={sizeClass.icon} aria-hidden="true" />
    </span>
  );
}
