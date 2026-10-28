import React from 'react';
import { clsx } from 'clsx';

export type TextVariant =
  | 'display'
  | 'screenTitle'
  | 'sectionTitle'
  | 'cardTitle'
  | 'body'
  | 'bodyReadable'
  | 'caption'
  | 'money'
  | 'moneyLarge';

export type TextTone =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'brand'
  | 'danger'
  | 'success'
  | 'warning'
  | 'inverse';

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  variant?: TextVariant;
  tone?: TextTone;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div' | 'label';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  children: React.ReactNode;
}

const variantStyles: Record<TextVariant, string> = {
  // Editorial Display headline (Playfair Display serif)
  display: 'font-serif text-3xl sm:text-4xl font-bold tracking-tight leading-tight',
  // Top-level screen title (Plus Jakarta Sans)
  screenTitle: 'font-sans text-2xl sm:text-3xl font-bold tracking-tight leading-snug',
  // Section grouping title
  sectionTitle: 'font-sans text-lg sm:text-xl font-bold leading-normal',
  // Container / Card heading
  cardTitle: 'font-sans text-base font-semibold leading-normal',
  // Standard UI text
  body: 'font-sans text-sm font-medium leading-normal',
  // Long-form readable body copy
  bodyReadable: 'font-sans text-sm sm:text-base font-normal leading-relaxed',
  // Secondary metadata / timestamp / caption
  caption: 'font-sans text-xs font-normal leading-normal',
  // Standard price / numerical display with tabular figures
  money: 'font-sans text-sm font-semibold tabular-nums tracking-tight',
  // Hero price / major currency display
  moneyLarge: 'font-sans text-2xl sm:text-3xl font-bold tabular-nums tracking-tight',
};

const toneStyles: Record<TextTone, string> = {
  primary: 'text-[color:var(--wiez-text-primary)]',
  secondary: 'text-[color:var(--wiez-text-secondary)]',
  muted: 'text-[color:var(--wiez-text-muted)]',
  brand: 'text-[color:var(--wiez-brand-accent)]',
  danger: 'text-[color:var(--wiez-action-danger)]',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  inverse: 'text-white dark:text-black',
};

const defaultTagForVariant: Record<TextVariant, NonNullable<TextProps['as']>> = {
  display: 'h1',
  screenTitle: 'h1',
  sectionTitle: 'h2',
  cardTitle: 'h3',
  body: 'p',
  bodyReadable: 'p',
  caption: 'span',
  money: 'span',
  moneyLarge: 'span',
};

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  tone = 'primary',
  as,
  weight,
  className,
  children,
  ...props
}) => {
  const Component = as ?? defaultTagForVariant[variant];
  const weightClass =
    weight === 'bold' ? 'font-bold' :
    weight === 'semibold' ? 'font-semibold' :
    weight === 'medium' ? 'font-medium' :
    weight === 'normal' ? 'font-normal' :
    '';

  return (
    <Component
      className={clsx(variantStyles[variant], toneStyles[tone], weightClass, className)}
      {...props}
    >
      {children}
    </Component>
  );
};

export default Text;
