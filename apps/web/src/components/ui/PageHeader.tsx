import { type ReactNode } from 'react';

interface PageHeaderProps {
  label?: string;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}

export function PageHeader({ label, title, description, className = '' }: PageHeaderProps) {
  return (
    <div className={className}>
      {label ? (
        <p className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.16em] text-[var(--accent-text-soft)]">
          {label}
        </p>
      ) : null}
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-[var(--text-2xl)] font-bold text-[var(--text)]">
        {title}
      </h1>
      {description ? (
        <p className="mt-1 text-[var(--text-base)] text-[var(--text-soft)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}
