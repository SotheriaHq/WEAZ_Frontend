import React, { forwardRef } from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      required,
      error,
      helperText,
      fullWidth = true,
      className = '',
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses = `
      ${fullWidth ? 'w-full' : ''}
      px-4 py-3 text-sm font-medium
      bg-white dark:bg-zinc-900/60
      border rounded-xl
      text-gray-900 dark:text-white
      shadow-sm
      focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500
      transition-all duration-200
      ${
        error
          ? 'border-red-500 dark:border-red-500 focus:ring-red-500/50 focus:border-red-500'
          : 'border-gray-300/80 dark:border-zinc-700/60'
      }
      ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-zinc-800/50' : ''}
    `;

    return (
      <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
        {label && (
          <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
            {label}
            {required && <span className="text-purple-500 ml-1">*</span>}
          </label>
        )}
        <select ref={ref} disabled={disabled} className={baseClasses} {...props}>
          {children}
        </select>
        {(helperText || error) && (
          <div className="mt-1.5">
            {error ? (
              <p className="text-xs text-red-500">{error}</p>
            ) : helperText ? (
              <p className="text-xs text-gray-500 dark:text-zinc-500">{helperText}</p>
            ) : null}
          </div>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
