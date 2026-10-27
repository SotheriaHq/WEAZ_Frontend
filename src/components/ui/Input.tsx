import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Label text displayed above the input */
  label?: string;
  /** Whether the field is required (shows asterisk) */
  required?: boolean;
  /** Error message to display below the input */
  error?: string;
  /** Helper text displayed below the input */
  helperText?: string;
  /** Icon to display at the start of the input */
  startIcon?: React.ReactNode;
  /** Icon to display at the end of the input */
  endIcon?: React.ReactNode;
  /** Current character count for counter display */
  charCount?: number;
  /** Maximum character count for counter display */
  maxCharCount?: number;
  /** Size variant */
  inputSize?: 'sm' | 'md' | 'lg';
  /** Full width */
  fullWidth?: boolean;
}

/**
 * Reusable Input component with theme-aware styling
 * Supports labels, icons, error states, and character counters
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      required,
      error,
      helperText,
      startIcon,
      endIcon,
      charCount,
      maxCharCount,
      inputSize = 'md',
      fullWidth = true,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    // Size variants
    const sizeClasses = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-3 text-sm',
      lg: 'px-4 py-3.5 text-base',
    };

    // Base input classes
    const baseClasses = `
      ${fullWidth ? 'w-full' : ''}
      ${sizeClasses[inputSize]} font-medium
      ${startIcon ? 'pl-10' : ''}
      ${endIcon ? 'pr-10' : ''}
      bg-[color:var(--wiez-surface-page)]
      border rounded-xl
      text-[color:var(--wiez-text-primary)]
      placeholder:text-[color:var(--wiez-text-placeholder)]
      shadow-sm
      focus:outline-none focus:ring-1 focus:ring-[color:var(--wiez-border-focus)] focus:border-[color:var(--wiez-border-focus)]
      transition-all duration-200
      ${
        error
          ? 'border-[color:var(--wiez-action-danger)]'
          : 'border-[color:var(--wiez-border-input)] hover:border-[color:var(--wiez-border-default)]'
      }
      ${
        disabled
          ? 'opacity-60 cursor-not-allowed bg-[color:var(--wiez-surface-subtle)] text-[color:var(--wiez-text-disabled)]'
          : ''
      }
    `;

    const showCounter = typeof charCount === 'number' && typeof maxCharCount === 'number';
    const isOverLimit = showCounter && charCount! > maxCharCount!;

    return (
      <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
        {/* Label */}
        {label && (
          <label className="block text-sm font-semibold text-[color:var(--wiez-text-secondary)] mb-2">
            {label}
            {required && <span className="text-[color:var(--wiez-brand-accent)] ml-1">*</span>}
          </label>
        )}

        {/* Input wrapper */}
        <div className="relative">
          {/* Start Icon */}
          {startIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--wiez-text-muted)]">
              {startIcon}
            </div>
          )}

          {/* Input */}
          <input
            ref={ref}
            disabled={disabled}
            className={baseClasses}
            {...props}
          />

          {/* End Icon */}
          {endIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--wiez-text-muted)]">
              {endIcon}
            </div>
          )}
        </div>

        {/* Bottom row: helper/error text + character counter */}
        {(helperText || error || showCounter) && (
          <div className="flex items-center justify-between mt-1.5 gap-2">
            <div className="flex-1">
              {error ? (
                <p className="text-xs text-[color:var(--wiez-action-danger)]">{error}</p>
              ) : helperText ? (
                <p className="text-xs text-[color:var(--wiez-text-muted)]">{helperText}</p>
              ) : null}
            </div>
            {showCounter && (
              <span
                className={`text-xs font-medium ${
                  isOverLimit
                    ? 'text-[color:var(--wiez-action-danger)]'
                    : 'text-[color:var(--wiez-text-muted)]'
                }`}
              >
                {charCount}/{maxCharCount}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
