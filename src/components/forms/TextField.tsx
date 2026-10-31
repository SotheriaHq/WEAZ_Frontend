import React, { forwardRef } from 'react';

type TextFieldVariant = 'default' | 'glass' | 'inverted';

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label?: string;
  labelClassName?: string;
  helperText?: string;
  error?: string | null;
  addon?: React.ReactNode;
  className?: string;
  inputClassName?: string;
  variant?: TextFieldVariant;
}

const variantClasses: Record<TextFieldVariant, string> = {
  default:
    'wiez-field-input px-3.5 py-2.5 text-sm',
  glass:
    'wiez-field-input px-4 py-3 text-sm backdrop-blur-xl',
  inverted:
    'wiez-field-input px-3.5 py-2.5 text-sm',
};

const TextField = forwardRef<HTMLInputElement, Props>(
  (
    {
      label,
      labelClassName,
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
      ? 'wiez-field-input-error'
      : '';

    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label className={labelClassName || "mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"}>
            {label}
            {rest.required ? <span className="ml-1 text-purple-500">*</span> : null}
          </label>
        )}
        <div className="flex items-center">
          <input
            ref={ref}
            className={`flex-1 block w-full outline-none transition ${variantStyle} ${errorStyles} ${inputClassName}`}
            {...rest}
          />
          {addon && <div className="ml-2">{addon}</div>}
        </div>
        {helperText && !error && (
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {helperText}
          </div>
        )}
        {error && <div className="mt-1 text-xs text-rose-500 dark:text-rose-400 font-medium">{error}</div>}
      </div>
    );
  },
);

export default TextField;
