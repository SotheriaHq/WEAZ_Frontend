import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * BackLink — the single, stable "back" affordance used across checkout, orders,
 * and custom-order flows. Replaces the ad-hoc mix of pill buttons and emoji
 * pointers so every route reads the same "← Back to <destination>".
 *
 * Provide exactly one navigation intent:
 *  - `onClick` for custom handlers (e.g. step-back inside a wizard),
 *  - `to` for a route,
 *  - neither → falls back to browser history (`navigate(-1)`).
 */
export type BackLinkVariant = 'link' | 'pill';

export interface BackLinkProps {
  label: string;
  onClick?: () => void;
  to?: string;
  variant?: BackLinkVariant;
  className?: string;
}

const VARIANT_CLASSES: Record<BackLinkVariant, string> = {
  link:
    'text-sm font-semibold text-slate-700 underline decoration-slate-400/80 decoration-2 underline-offset-4 hover:text-slate-900 dark:text-slate-200 dark:decoration-slate-500 dark:hover:text-white',
  pill:
    'rounded-full border border-gray-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-fuchsia-300 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:text-white',
};

const BackLink: React.FC<BackLinkProps> = ({
  label,
  onClick,
  to,
  variant = 'link',
  className,
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    if (to) {
      navigate(to);
      return;
    }
    navigate(-1);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-2 transition-colors ${VARIANT_CLASSES[variant]} ${className ?? ''}`}
    >
      <span aria-hidden>←</span>
      <span>{label}</span>
    </button>
  );
};

export default BackLink;
