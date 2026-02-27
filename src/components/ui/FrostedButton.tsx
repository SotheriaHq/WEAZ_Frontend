import React from 'react';
import { clsx } from 'clsx';

type Variant = 'primary' | 'ghost' | 'outline';
type Size = 'xs' | 'sm' | 'md' | 'lg';

interface FrostedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
}

export const FrostedButton: React.FC<FrostedButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  loading,
  disabled,
  ...props
}) => (
  <button
    className={clsx(
      variant === 'primary' && 'btn-frost-primary',
      variant === 'ghost' && 'btn-frost-ghost',
      variant === 'outline' && 'btn-frost-outline',
      size === 'xs' && 'btn-tight-xs',
      size === 'sm' && 'btn-tight-sm',
      size === 'md' && 'btn-tight-md',
      size === 'lg' && 'btn-tight-lg',
      className,
    )}
    disabled={disabled || loading}
    aria-busy={loading ? true : undefined}
    {...props}
  >
    {loading ? (
      <span
        className="inline-block h-4 w-4 rounded-full border-2 border-current/35 border-t-current animate-spin"
        aria-hidden
      />
    ) : (
      leftIcon
    )}
    {children}
    {loading ? (
      <span className="inline-flex items-center gap-0.5" aria-hidden>
        <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
        <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
        <span className="h-1 w-1 rounded-full bg-current animate-bounce" />
      </span>
    ) : (
      rightIcon
    )}
  </button>
);

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  tooltip?: string;
  icon: React.ReactNode;
}

export const IconButton: React.FC<IconButtonProps> = ({ variant = 'ghost', size = 'sm', icon, className, tooltip, ...props }) => (
  <button
    className={clsx(
      variant === 'primary' && 'btn-frost-primary',
      variant === 'ghost' && 'btn-frost-ghost',
      variant === 'outline' && 'btn-frost-outline',
      size === 'xs' && 'btn-tight-xs',
      size === 'sm' && 'btn-tight-sm',
      size === 'md' && 'btn-tight-md',
      size === 'lg' && 'btn-tight-lg',
      'aspect-square p-0 min-w-[2rem]',
      className,
    )}
    title={tooltip}
    {...props}
  >
    {icon}
  </button>
);

export default FrostedButton;
