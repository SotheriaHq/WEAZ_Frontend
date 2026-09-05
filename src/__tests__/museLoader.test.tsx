import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MuseLoader, MuseProgress } from '@/components/loaders/MuseLoader';
import WiezOrb from '@/brand/WiezOrb';
import { BRAND_ASSETS, PRODUCT_NAME } from '@/brand/identity';
import { WIEZ_ORB_PATHS, WIEZ_ORB_TONES } from '@/brand/wiezOrbArtwork';

/**
 * The rules here are the ones the consolidation exists to hold.
 *
 * Before it, the loader drew a thread emoji, the chrome logo was a black "W"
 * PNG, the favicon was a gold figure, and each of the three was reached by a
 * different constant. Nothing tied them together, so nothing noticed.
 */

describe('the loading system', () => {
  it('never invents a percentage', () => {
    render(<MuseLoader size={48} />);
    // The old loader ran a timer that crawled toward 92% with no `progress`
    // prop and rendered it as "47% complete" over real uploads.
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAccessibleName('Loading');
  });

  it('shows a percentage only when given a real one', () => {
    render(<MuseProgress progress={42} size={64} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('clamps a progress value rather than drawing outside the ring', () => {
    const { rerender } = render(<MuseProgress progress={-20} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');

    rerender(<MuseProgress progress={180} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');

    // NaN reaches this from an upload that has not reported bytes yet.
    rerender(<MuseProgress progress={Number.NaN} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('thickens the ring as it shrinks, or a 16px spinner has no ring', () => {
    const { container: small } = render(<MuseLoader size={16} />);
    const { container: large } = render(<MuseLoader size={96} />);

    const width = (c: HTMLElement) =>
      Number(c.querySelector('circle')?.getAttribute('stroke-width'));

    expect(width(small)).toBeGreaterThan(width(large));
  });

  it('carries the brand mark, not an emoji', () => {
    const { container } = render(<MuseLoader size={48} />);
    // The orb is inlined, so its paths are in the DOM. The previous loader's
    // entire brand content was the character U+1F9F5.
    expect(container.querySelectorAll('path').length).toBe(WIEZ_ORB_PATHS.length);
    expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });
});

describe('the brand mark', () => {
  it('paints every path from a theme token, never a literal', () => {
    const { container } = render(<WiezOrb size={32} />);
    const fills = [...container.querySelectorAll('path')].map((p) => p.getAttribute('fill'));

    expect(fills).toHaveLength(WIEZ_ORB_TONES.length);
    // A literal here is how the mark stopped being able to follow the theme —
    // the old asset was flat black and had to be `invert(1)`-ed on dark.
    for (const fill of fills) {
      expect(fill).toMatch(/^var\(--wiez-t[0-7]\)$/);
    }
  });

  it('is decorative unless it is the only thing naming the brand', () => {
    const { container, rerender } = render(<WiezOrb size={32} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');

    rerender(<WiezOrb size={32} title={PRODUCT_NAME} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(PRODUCT_NAME);
  });
});

describe('brand asset paths', () => {
  it('pairs the mark by theme instead of shipping one file for both', () => {
    // Two different artworks once shipped as wiez-logo-mark.png and
    // wiez-logo-mark.svg, and which one you got depended on the surface.
    expect(BRAND_ASSETS.markLight).not.toBe(BRAND_ASSETS.markDark);
    for (const path of Object.values(BRAND_ASSETS)) {
      expect(path.startsWith('/brand/')).toBe(true);
    }
  });

  it('uses a raster for the share card', () => {
    // Several crawlers reject SVG for og:image outright.
    expect(BRAND_ASSETS.openGraph).toMatch(/\.png$/);
  });
});
