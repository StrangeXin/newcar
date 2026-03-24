'use client';

import { LucideIcon } from 'lucide-react';

type BadgeTone = 'accent' | 'success' | 'neutral';
type BadgeSize = 'sm' | 'md';

const toneClassMap: Record<BadgeTone, string> = {
  accent: 'bg-orange-100 text-orange-700',
  success: 'bg-emerald-100 text-emerald-700',
  neutral: 'bg-slate-100 text-slate-700',
};

const sizeClassMap: Record<BadgeSize, { shell: string; icon: string }> = {
  sm: { shell: 'h-6 w-6 rounded-md', icon: 'h-3.5 w-3.5' },
  md: { shell: 'h-7 w-7 rounded-md', icon: 'h-4 w-4' },
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
