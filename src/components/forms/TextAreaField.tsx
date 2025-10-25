import React, { forwardRef } from 'react';

type TextAreaVariant = 'default' | 'glass' | 'inverted';

interface Props extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string | null;
  addon?: React.ReactNode;
  variant?: TextAreaVariant;
}

const variantClasses: Record<TextAreaVariant, string> = {
  default: 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200 border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500',
  glass: 'bg-white/30 dark:bg-white/10 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder-white/70 border-transparent focus:border-transparent focus:ring-0 backdrop-blur-xl shadow-[0_4px_24px_rgba(15,23,42,0.18)]',
  inverted: 'bg-slate-900 text-white border-slate-700 focus:ring-2 focus:ring-purple-400 focus:border-purple-400',
};

const TextAreaField = forwardRef<HTMLTextAreaElement, Props>(({ label, helperText, error, addon, className = '', variant = 'default', ...rest }, ref) => {
  const variantStyle = variantClasses[variant] ?? variantClasses.default;
  return (
    <div className={`w-full ${className}`}>
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{label}</label>}
      <div className="flex items-start">
        <textarea
          ref={ref}
          className={`flex-1 block w-full rounded-md border px-3 py-2 focus:outline-none ${variantStyle} ${error ? 'border-red-500' : ''}`}
          {...rest}
        />
        {addon && <div className="ml-2">{addon}</div>}
      </div>
      {helperText && !error && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helperText}</div>}
      {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
    </div>
  );
});

export default TextAreaField;
