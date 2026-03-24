import { type HTMLAttributes, type ReactNode } from 'react';

type CardVariant = 'default' | 'subtle' | 'accent';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  children: ReactNode;
}

const variantClass: Record<CardVariant, string> = {
  default:
    'bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-card)]',
  subtle:
    'bg-[var(--surface-subtle)] border border-[var(--border-soft)]',
  accent:
    'bg-[var(--surface)] border-2 border-[var(--accent)]',
};

export function Card({ variant = 'default', className = '', children, ...props }: CardProps) {
  return (
    <div className={`rounded-[var(--radius-lg)] ${variantClass[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`font-[family-name:var(--font-display)] ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`text-[var(--text-soft)] ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}
