// DefaultAvatar.tsx (FINAL FIX)

import React from 'react';

interface DefaultAvatarProps {
  name?: string;
  size?: number;         // pixel square (default 192)
  className?: string;
}

/**
 * DefaultAvatar
 * - Renders initials from `name` inside an SVG square with a gradient background.
 * - Relies on the parent component's `overflow-hidden` and `rounded-X` classes for corner shaping.
 */
const DefaultAvatar: React.FC<DefaultAvatarProps> = ({ name = 'User', size = 192, className }) => {
  const getInitials = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const initials = getInitials(name);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={`${name} avatar`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="avGrad" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#2d3748" stopOpacity={0.8} />
          <stop offset="100%" stopColor="#1a202c" stopOpacity={0.9} />
        </linearGradient>
      </defs>

      {/* background rect - rx="16" is removed and set to rx="0" */}
      <rect width="100" height="100" rx="0" fill="url(#avGrad)" />

      {/* initials */}
      <text
        x="50"
        y="54"
        textAnchor="middle"
        fontFamily="Inter, Roboto, system-ui, -apple-system"
        fontSize="34"
        fontWeight={700}
        fill="#fff"
        style={{ letterSpacing: '0.5px' }}
      >
        {initials}
      </text>
    </svg>
  );
};

export default DefaultAvatar;
