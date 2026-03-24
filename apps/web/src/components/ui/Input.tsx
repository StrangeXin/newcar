import { forwardRef, type InputHTMLAttributes } from 'react';

type InputSize = 'sm' | 'md' | 'lg';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  inputSize?: InputSize;
  error?: boolean;
}

const sizeClass: Record<InputSize, string> = {
  sm: 'h-8 text-[var(--text-sm)]',
  md: 'h-10 text-[var(--text-base)]',
  lg: 'h-11 text-[var(--text-md)]',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ inputSize = 'md', error = false, className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full rounded-[var(--radius-md)] border bg-[var(--surface-subtle)] px-3 text-[var(--text)] placeholder:text-[var(--text-muted)] transition-all duration-[180ms] ease-out focus:bg-[var(--surface)] focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 ${
          error
            ? 'border-[var(--error)]'
            : 'border-[var(--border)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--focus-glow)]'
        } ${sizeClass[inputSize]} ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
