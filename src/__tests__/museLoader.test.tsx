import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MuseLoader, MuseProgress } from '@/components/loaders/MuseLoader';
import WiezMark from '@/brand/WiezMark';
import WiezWordmark from '@/brand/WiezWordmark';
import { BRAND_ASPECT, BRAND_ASSET_SIZES } from '@/brand/assetSizes';
import { BRAND_ASSETS, PRODUCT_NAME } from '@/brand/identity';

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

  it("matches the loader mark file's own box, not the artwork's", () => {
    const { container } = render(<MuseLoader size={48} />);
    const box = container.firstElementChild as HTMLElement;
    /*
      The file is square — `fit()` writes the artwork onto a square canvas so
      one raster serves the loader, the favicon and the app icon.

      This asserted `538 / 498`, the ARTWORK's ratio, which made the element 8%
      wider than the image inside it. With a `contain` mask that surplus is an
      empty gutter down each side, so a spinner in a button sat away from its
      label for no reason any stylesheet could explain.
    */
    expect(box.style.height).toBe('48px');
    expect(box.style.width).toBe(`${Math.round(48 * BRAND_ASPECT.loaderMark)}px`);
  });

  it('is an empty vessel filling with the system colour', () => {
    const { container } = render(<MuseLoader size={48} />);

    // No ring. The previous shape orbited an arc around the orb, which read as
    // a loading widget that happened to contain part of the brand.
    expect(container.querySelector('circle')).toBeNull();

    /*
      No <img> either, and that is the whole point of the change.

      Painting the ARTWORK and uncovering it bottom-up reads as a picture
      downloading over a slow connection — a grey logo is what a half-loaded
      image looks like. The mark is a MASK now, cut out of a flat fill, so the
      empty state is a silhouette holding nothing rather than a broken logo.
    */
    expect(container.querySelector('img')).toBeNull();

    const layers = [...container.querySelectorAll('span > span')] as HTMLElement[];
    expect(layers).toHaveLength(2);
    for (const layer of layers) {
      // jsdom keeps the prefixed property; either is proof of the mask.
      const mask =
        layer.style.getPropertyValue('mask-image') ||
        layer.style.getPropertyValue('-webkit-mask-image');
      expect(mask).toMatch(/wiez-loader-mark-/);
    }

    /*
      Empty and full are the SAME ink at two strengths, not two colours.

      That is what makes a part-filled mark legible: the eye compares one
      colour against itself across a hard edge, so "some filled, some empty" is
      obvious without reading a number. A track in a different hue reads as a
      shadow behind a logo instead of as an empty vessel.
    */
    expect(layers[0].style.background).toContain('--wiez-ring');
    expect(layers[1].style.background).toContain('--wiez-ring');
    expect(Number(layers[0].style.opacity)).toBeLessThan(0.5);
    expect(layers[1].style.opacity).toBe('');
    expect(layers[1].className).toMatch(/animate-wiez-rise/);

    // The previous loader's entire brand content was the character U+1F9F5.
    expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it('fills the mark from the bottom in proportion to real progress', () => {
    const { container } = render(<MuseProgress progress={30} size={64} />);
    const layers = [...container.querySelectorAll('span > span > span')] as HTMLElement[];
    const fill = layers[1];
    // 30% full means 70% clipped off the top.
    expect(fill.style.clipPath).toBe('inset(70% 0 0 0)');
  });
});

/**
 * The PNG header: 8 signature bytes, a 4-byte chunk length, "IHDR", then the
 * dimensions. Enough to read a size without a decoder.
 */
const pngSize = (publicPath: string) => {
  const bytes = readFileSync(resolve(process.cwd(), 'public', publicPath.replace(/^\//, '')));
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

describe('the brand lockup', () => {
  /*
    The bug this describes: every one of these components sets BOTH a width and
    a height on an <img>, so the ratio it computes is not a hint — the browser
    stretches the file to that box. Three of them carried a hand-typed ratio
    left over from artwork that had since been replaced, and the wordmark's was
    792/531 against a file that is 720/461. The name rendered 4.5% narrow,
    which reads as the letters having lost their spacing.

    So the geometry is generated from the files themselves, and these assert
    that the generated numbers still describe the files on disk.
  */
  it('describes the artwork that is actually on disk', () => {
    expect(pngSize(BRAND_ASSETS.wordmarkLight)).toEqual(BRAND_ASSET_SIZES.wordmark);
    expect(pngSize(BRAND_ASSETS.markLight)).toEqual(BRAND_ASSET_SIZES.mark);
    expect(pngSize(BRAND_ASSETS.loaderMarkLight)).toEqual(BRAND_ASSET_SIZES.loaderMark);
  });

  it('lays the name out at the file’s own ratio', () => {
    const { container } = render(<WiezWordmark height={28} />);
    const image = container.querySelector('img') as HTMLImageElement;

    expect(image.getAttribute('height')).toBe('28');
    expect(image.getAttribute('width')).toBe(`${Math.round(28 * BRAND_ASPECT.wordmark)}`);
    expect(image).toHaveAttribute('alt', PRODUCT_NAME);
  });

  it('lays the mark out at the file’s own ratio', () => {
    const { container } = render(<WiezMark height={64} />);
    const image = container.querySelector('img') as HTMLImageElement;

    expect(image.getAttribute('height')).toBe('64');
    expect(image.getAttribute('width')).toBe(`${Math.round(64 * BRAND_ASPECT.mark)}`);
  });

  it('is decorative unless it is the only thing naming the brand', () => {
    const { container, rerender } = render(<WiezMark height={32} />);
    expect(container.querySelector('img')).toHaveAttribute('aria-hidden', 'true');

    rerender(<WiezMark height={32} title={PRODUCT_NAME} />);
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
