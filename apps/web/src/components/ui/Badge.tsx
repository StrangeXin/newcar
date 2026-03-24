import { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';

type BadgeVariant = 'accent' | 'success' | 'warning' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}

const variantClass: Record<BadgeVariant, string> = {
  accent:
    'bg-[var(--accent-muted)] text-[var(--accent-text)] border-[var(--accent-border)]',
  success:
    'bg-[var(--success-muted)] text-[var(--success-text)] border-[var(--success-border)]',
  warning:
    'bg-[var(--warning-muted)] text-[var(--warning-text)] border-[var(--warning-border)]',
  neutral:
    'bg-[#f8fafc] text-[var(--text-soft)] border-[var(--border)]',
};

export function Badge({ variant = 'neutral', icon: Icon, className = '', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-1 text-[var(--text-xs)] font-semibold ${variantClass[variant]} ${className}`}
    >
      {Icon ? <Icon className="h-3 w-3" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
