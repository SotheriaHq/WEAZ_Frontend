/**
 * An unread count. A number, not a plate.
 *
 * These were red or fuchsia pills — `rounded-full bg-red-500 px-1 text-white`,
 * reimplemented at four call sites. Two problems, and the second is the one
 * that made them worth changing:
 *
 * 1. On the immersive navbar (transparent bar floating over full-bleed Runway
 *    media) a solid red disc is the highest-contrast object on the screen,
 *    louder than the photograph the page exists to show. On the island dock the
 *    fuchsia disc sat over an icon and clipped its own digits at two figures.
 * 2. A filled 18px circle has room for one digit. "12" already crowded it and
 *    anything past that fell back to "99+", so the badge stopped being a count
 *    and became a warning light.
 *
 * Bare numerals solve both: they take exactly the width their digits need, they
 * carry weight instead of area, and they read over anything. Contrast comes
 * from a text shadow rather than a fill, which is the same technique the
 * Runway's chrome uses over arbitrary media.
 *
 * The colour is the brand purple in every context. It is legible on the light
 * bar, the dark bar and over a photograph, and it means the badge does not have
 * to know which of those it is on — the immersive navbar rewrites `.text-theme`
 * to white, and a badge that inherited would have vanished on the light bar.
 */
import React from 'react';

/** Past this the digits are wider than the icon they sit beside. */
const MAX_RENDERED = 99;

export const CountBadge: React.FC<{
  count: number;
  /**
   * `overlay` pins it to the top-right of a positioned parent (an icon button).
   * `inline` lets it sit in normal flow (a menu row's meta slot).
   */
  placement?: 'overlay' | 'inline';
  className?: string;
}> = ({ count, placement = 'overlay', className }) => {
  if (!count || count <= 0) return null;

  return (
    <span
      aria-hidden="true"
      className={[
        'pointer-events-none select-none font-extrabold leading-none tabular-nums',
        'text-[11px] text-[color:var(--brand-primary,#9333ea)]',
        // The halo is what replaces the plate. Two stacked shadows so the digits
        // survive both a pale bar and a dark photograph without a fill.
        '[text-shadow:0_1px_2px_rgba(0,0,0,0.45),0_0_2px_rgba(255,255,255,0.65)]',
        placement === 'overlay' ? 'absolute -right-1.5 -top-1' : 'inline-block',
        className ?? '',
      ].join(' ')}
    >
      {count > MAX_RENDERED ? `${MAX_RENDERED}+` : count}
    </span>
  );
};

export default CountBadge;
