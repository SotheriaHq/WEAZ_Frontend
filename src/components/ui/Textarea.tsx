import React, { forwardRef } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Label text displayed above the textarea */
  label?: string;
  /** Whether the field is required (shows asterisk) */
  required?: boolean;
  /** Error message to display below the textarea */
  error?: string;
  /** Helper text displayed below the textarea */
  helperText?: string;
  /** Current character count for counter display */
  charCount?: number;
  /** Maximum character count for counter display */
  maxCharCount?: number;
  /** Full width */
  fullWidth?: boolean;
}

/**
 * Reusable Textarea component with theme-aware styling
 * Supports labels, error states, and character counters
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      required,
      error,
      helperText,
      charCount,
      maxCharCount,
      fullWidth = true,
      className = '',
      disabled,
      rows = 3,
      ...props
    },
    ref
  ) => {
    // Base textarea classes - Google-style elevated, soft shadow, scale on focus, no border lighting
    const baseClasses = `
      ${fullWidth ? 'w-full' : ''}
      px-4 py-3 text-sm font-medium
      bg-[color:var(--surface-primary)]
      rounded-2xl
      text-[color:var(--wiez-text-primary)]
      placeholder:text-[color:var(--wiez-text-placeholder)]
      shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]
      border border-black/[0.04] dark:border-white/[0.06]
      focus:outline-none focus:shadow-[0_4px_18px_rgba(0,0,0,0.1)] dark:focus:shadow-[0_4px_22px_rgba(0,0,0,0.55)] focus:scale-[1.006] focus:border-black/[0.08] dark:focus:border-white/[0.12]
      transition-all duration-200
      resize-none
      ${
        error
          ? '!border-[color:var(--wiez-action-danger)] !shadow-[0_2px_12px_rgba(239,68,68,0.2)]'
          : 'hover:shadow-[0_3px_12px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_3px_12px_rgba(0,0,0,0.45)]'
      }
      ${
        disabled
          ? 'opacity-60 cursor-not-allowed bg-[color:var(--wiez-surface-subtle)] text-[color:var(--wiez-text-disabled)] shadow-none'
          : ''
      }
    `;

    const showCounter = typeof charCount === 'number' && typeof maxCharCount === 'number';
    const isOverLimit = showCounter && charCount! > maxCharCount!;

    return (
      <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
        {/* Label */}
        {label && (
          <label className="block text-xs font-bold uppercase tracking-wider text-[color:var(--wiez-text-secondary)] mb-2">
            {label}
            {required && <span className="text-[color:var(--wiez-brand-accent)] ml-1">*</span>}
          </label>
        )}

        {/* Textarea */}
        <textarea
          ref={ref}
          disabled={disabled}
          rows={rows}
          className={baseClasses}
          {...props}
        />

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

Textarea.displayName = 'Textarea';

export default Textarea;
