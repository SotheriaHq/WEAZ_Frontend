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
    // Base textarea classes
    const baseClasses = `
      ${fullWidth ? 'w-full' : ''}
      px-4 py-3 text-sm
      bg-white dark:bg-zinc-900/60
      border rounded-xl
      text-gray-900 dark:text-white
      placeholder-gray-400 dark:placeholder-zinc-500
      shadow-sm
      focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500
      transition-all duration-200
      resize-none
      ${
        error
          ? 'border-red-500 dark:border-red-500 focus:ring-red-500/50 focus:border-red-500'
          : 'border-gray-300/80 dark:border-zinc-700/60'
      }
      ${
        disabled
          ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-zinc-800/50'
          : ''
      }
    `;

    const showCounter = typeof charCount === 'number' && typeof maxCharCount === 'number';
    const isOverLimit = showCounter && charCount! > maxCharCount!;

    return (
      <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
        {/* Label */}
        {label && (
          <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
            {label}
            {required && <span className="text-purple-500 ml-1">*</span>}
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
                <p className="text-xs text-red-500">{error}</p>
              ) : helperText ? (
                <p className="text-xs text-gray-500 dark:text-zinc-500">{helperText}</p>
              ) : null}
            </div>
            {showCounter && (
              <span
                className={`text-xs font-medium ${
                  isOverLimit
                    ? 'text-red-500'
                    : 'text-gray-400 dark:text-zinc-500'
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
