import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent)] text-white shadow-[var(--shadow-accent)] hover:bg-[var(--accent-hover)] hover:-translate-y-[1px]',
  secondary:
    'bg-white border border-[var(--border)] text-[var(--text)] hover:border-[var(--border-soft)]',
  ghost:
    'bg-transparent text-[var(--accent)] hover:bg-[var(--accent-muted)]',
  danger:
    'bg-[var(--error)] text-white hover:opacity-90',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[var(--text-sm)]',
  md: 'h-10 px-4 text-[var(--text-base)]',
  lg: 'h-11 px-5 text-[var(--text-md)]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`inline-flex cursor-pointer items-center justify-center rounded-[var(--radius-md)] font-semibold transition-all duration-[180ms] ease-out disabled:cursor-not-allowed disabled:opacity-50 ${variantClass[variant]} ${sizeClass[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
