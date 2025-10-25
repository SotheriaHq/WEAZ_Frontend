import React, { forwardRef } from 'react';

type TextFieldVariant = 'default' | 'glass' | 'inverted';

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label?: string;
  helperText?: string;
  error?: string | null;
  addon?: React.ReactNode;
  className?: string;
  inputClassName?: string;
  variant?: TextFieldVariant;
}

const variantClasses: Record<TextFieldVariant, string> = {
  default:
    'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200 border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500',
  glass:
    'bg-white/30 dark:bg-white/10 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder-white/70 border-transparent focus:border-transparent focus:ring-0 backdrop-blur-xl shadow-[0_4px_24px_rgba(15,23,42,0.18)]',
  inverted:
    'bg-slate-900 text-white border-slate-700 focus:ring-2 focus:ring-purple-400 focus:border-purple-400',
};

const TextField = forwardRef<HTMLInputElement, Props>(
  (
    {
      label,
      helperText,
      error,
      addon,
      className = '',
      inputClassName = '',
      variant = 'default',
      ...rest
    },
    ref,
  ) => {
    const variantStyle = variantClasses[variant] ?? variantClasses.default;
    const errorStyles = error
      ? 'border-red-500 focus:border-red-400 focus:ring-red-400/60'
      : '';

    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
            {label}
          </label>
        )}
        <div className="flex items-center">
          <input
            ref={ref}
            className={`flex-1 block w-full rounded-md border px-3 py-2 outline-none transition focus:outline-none ${variantStyle} ${errorStyles} ${inputClassName}`}
            {...rest}
          />
          {addon && <div className="ml-2">{addon}</div>}
        </div>
        {helperText && !error && (
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {helperText}
          </div>
        )}
        {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
      </div>
    );
  },
);

export default TextField;
