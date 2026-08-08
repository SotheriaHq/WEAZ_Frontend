/**
 * The WIEZ verified-brand badge.
 *
 * THE badge — the scalloped seal a buyer recognises on a storefront, catalog
 * card or brand header. Not a status chip: an approved brand's own Studio
 * showed a sky-blue pill reading "✅ Seller verified", which is a label ABOUT
 * the badge rather than the badge itself, so the one place an owner most wants
 * to see what they earned was the one place it did not appear.
 *
 * Extracted from `ProfileHeader`, where the seal was inlined twice (gold for
 * subscribed, purple for verified) — two copies of a 700-character path that
 * any redesign would have had to find and edit by hand.
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

type Props = {
  /**
   * Rendered size in px. 23 matches the brand header seals; 20 suits dense
   * toolbars. Below ~18 the check stops reading as a check.
   */
  size?: number;
  /** Wrap in a link to the "what this means" page. */
  linkTo?: string | null;
  title?: string;
  className?: string;
};

export const VerifiedBrandBadge: React.FC<Props> = ({
  size = 23,
  linkTo = '/help/verified-badge',
  title = 'Verified brand',
  className,
}) => {
  const location = useLocation();

  const seal = (
    <svg
      className={`flex-shrink-0 ${className ?? ''}`}
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <path
        d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.99-3.818-3.99-.48 0-.941.1-1.356.278C14.774 2.525 13.5 1.5 12 1.5s-2.774 1.025-3.416 2.288C8.17 3.6 7.708 3.5 7.23 3.5 5.12 3.5 3.41 5.28 3.41 7.49c0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.21 1.71 3.99 3.818 3.99.48 0 .941-.1 1.356-.278C9.226 21.475 10.5 22.5 12 22.5s2.774-1.025 3.416-2.288c.415.178.876.278 1.356.278 2.108 0 3.818-1.78 3.818-3.99 0-.495-.084-.965-.238-1.4 1.273-.65 2.148-2.02 2.148-3.6z"
        fill="var(--brand-primary, #9333ea)"
      />
      <path
        d="M9.7 16.1l-3.2-3.2 1.4-1.4 1.8 1.8 5.8-5.8 1.4 1.4-7.2 7.2z"
        fill="white"
      />
    </svg>
  );

  if (!linkTo) return seal;

  return (
    <Link
      to={linkTo}
      state={{
        from: `${location.pathname}${location.search}${location.hash}` || '/studio/store',
      }}
      title={title}
      className="inline-flex items-center"
    >
      {seal}
    </Link>
  );
};

export default VerifiedBrandBadge;
