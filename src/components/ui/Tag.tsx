import React from 'react';
import { clsx } from 'clsx';

type Size = 'xs' | 'sm' | 'md';
type Color = 'purple' | 'blue' | 'green' | 'orange' | 'red' | 'gray';

interface TagProps {
  label?: string;
  size?: Size;
  color?: Color;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  iconOnly?: boolean;
  className?: string;
}

export const Tag: React.FC<TagProps> = ({ label, size = 'sm', color = 'purple', leftIcon, rightIcon, iconOnly, className }) => (
  <span
    className={clsx(
      'inline-flex items-center gap-1 glass-chip select-none whitespace-nowrap',
      size === 'xs' && 'chip-xs',
      size === 'sm' && 'chip-sm',
      size === 'md' && 'chip-md',
      color === 'purple' && 'chip-purple',
      color === 'blue' && 'chip-blue',
      color === 'green' && 'chip-green',
      color === 'orange' && 'chip-orange',
      color === 'red' && 'chip-red',
      color === 'gray' && 'chip-gray',
      iconOnly && 'px-2',
      className,
    )}
  >
    {leftIcon}
    {!iconOnly && label}
    {rightIcon}
  </span>
);

export default Tag;
