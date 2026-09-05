import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MuseLoader, MuseProgress } from '@/components/loaders/MuseLoader';
import WiezOrb from '@/brand/WiezOrb';
import { BRAND_ASSETS, PRODUCT_NAME } from '@/brand/identity';
import { WIEZ_ORB_TONES } from '@/brand/wiezOrbArtwork';

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

  it("keeps the mark's own proportions at every size", () => {
    const { container } = render(<MuseLoader size={48} />);
    const box = container.firstElementChild as HTMLElement;
    // A square box would squash a 461x430 lockup.
    expect(box.style.height).toBe('48px');
    expect(box.style.width).toBe(`${Math.round(48 * (461 / 430))}px`);
  });

  it('is the whole logo filling, not a ring around one piece of it', () => {
    const { container } = render(<MuseLoader size={48} />);

    // No ring. The previous shape orbited an arc around the orb, which read as
    // a loading widget that happened to contain part of the brand.
    expect(container.querySelector('circle')).toBeNull();

    // Two stacked copies of the mark: a dim track and a lit fill.
    const layers = [...container.querySelectorAll('img')];
    expect(layers).toHaveLength(2);
    for (const layer of layers) {
      expect(layer.getAttribute('src')).toMatch(/wiez-loader-mark-/);
    }
    expect(layers[1].className).toMatch(/animate-wiez-rise/);

    // The previous loader's entire brand content was the character U+1F9F5.
    expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it('fills the mark from the bottom in proportion to real progress', () => {
    const { container } = render(<MuseProgress progress={30} size={64} />);
    const fill = [...container.querySelectorAll('img')][1] as HTMLElement;
    // 30% full means 70% clipped off the top.
    expect(fill.style.clipPath).toBe('inset(70% 0 0 0)');
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
