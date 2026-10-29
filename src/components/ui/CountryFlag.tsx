import React, { useState } from 'react';

export const getCountryFlagEmoji = (iso2: string): string => {
  if (!iso2 || iso2.trim().length !== 2) return '';
  const codePoints = iso2
    .trim()
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

export interface CountryFlagProps {
  iso2?: string;
  name?: string;
  flagImage?: string;
  className?: string;
}

export const CountryFlag: React.FC<CountryFlagProps> = ({
  iso2 = '',
  flagImage,
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);
  const normalizedIso = iso2.trim().toUpperCase();
  const emoji = getCountryFlagEmoji(normalizedIso);
  const src = flagImage || (normalizedIso ? `/flags/${normalizedIso.toLowerCase()}.svg` : '');

  if (imageError || !src) {
    if (emoji) {
      return (
        <span
          className={`inline-flex shrink-0 items-center justify-center text-base leading-none select-none ${className}`}
          aria-hidden="true"
        >
          {emoji}
        </span>
      );
    }
    if (normalizedIso) {
      return (
        <span
          className={`inline-flex shrink-0 items-center justify-center rounded px-1 py-0.5 text-[10px] font-bold text-theme-secondary surface-subtle ${className}`}
          aria-hidden="true"
        >
          {normalizedIso}
        </span>
      );
    }
    return null;
  }

  return (
    <span className={`inline-flex shrink-0 items-center ${className}`} aria-hidden="true">
      <img
        src={src}
        alt=""
        onError={() => setImageError(true)}
        className="h-3.5 w-5 rounded-[2px] object-cover shadow-xs select-none"
        loading="lazy"
        decoding="async"
      />
    </span>
  );
};

export default CountryFlag;
