import { afterEach, describe, expect, it } from 'vitest';
import { LIQUID_GLASS_LENS, resolveLensOptics, sampleLens, type LensShape } from '../liquidGlassOptics';
import { lensGeometryFor, supportsLiquidGlassLens } from '../liquidGlassLens';

const SHAPES: Record<string, LensShape> = {
  island: { w: 358, h: 56, r: 28 },
  circle40: { w: 40, h: 40, r: 20 },
  chip: { w: 88, h: 36, r: 18 },
  roundedButton: { w: 116, h: 44, r: 14 },
};

describe('Strong Lens spec', () => {
  it('matches the owner-approved Strong Lens (same numbers as the mobile tokens)', () => {
    expect(LIQUID_GLASS_LENS).toMatchObject({
      curvature: 1,
      opticalThickness: 0.75,
      chromaticAberration: 0,
      refractionStrength: 1.25,
      reflectionStrength: 0.6,
      lensTintAlpha: 0.14,
      lens: {
        falloffK: 1.7,
        depthFrac: 0.55,
        stretchLimit: 0.7,
        magnify: 0.1,
        maxTiltDeg: 70,
        fresnelGain: 0.7,
        specGain: 0.35,
        shininess: 30,
        rimDp: 1.1,
        shadeGain: 0.08,
        saturation: 1.15,
        bezelMaxDp: 36,
      },
    });
  });
});

describe('Strong Lens surface model', () => {
  it.each(Object.entries(SHAPES))('%s: sampling never folds and the rim really refracts', (_, shape) => {
    const o = resolveLensOptics(shape);
    expect(o.maxShift).toBeGreaterThan(2);
    // Walk inward from the top edge along the vertical centre line.
    const step = 0.25;
    let previous: number | null = null;
    for (let y = -o.hy + step / 2; y <= 0; y += step) {
      const s = sampleLens(0, y, o);
      expect(s).not.toBeNull();
      const sampledAt = y + (s?.oy ?? 0);
      if (previous !== null) {
        expect((sampledAt - previous) / step).toBeGreaterThanOrEqual(0.15 - 1e-6);
      }
      previous = sampledAt;
    }
    const rim = sampleLens(0, -o.hy + 0.5, o);
    expect(Math.abs(rim?.oy ?? 0)).toBeGreaterThan(2);
    expect(rim?.highlight ?? 0).toBeGreaterThan(0);
  });

  it('a capsule bends along its short axis everywhere, not like a stretched circle', () => {
    const o = resolveLensOptics(SHAPES.island);
    expect(o.bezel).toBeCloseTo(28, 5);
    const left = sampleLens(-120, -o.hy + 1, o);
    const middle = sampleLens(0, -o.hy + 1, o);
    expect(left?.ox).toBeCloseTo(0, 5);
    expect(left?.oy).toBeCloseTo(middle?.oy ?? Number.NaN, 5);
  });

  it('returns null outside the shape unless the edge is extended for the map', () => {
    const o = resolveLensOptics(SHAPES.chip);
    expect(sampleLens(0, -o.hy - 2, o)).toBeNull();
    expect(sampleLens(0, -o.hy - 2, o, true)?.oy).toBeGreaterThan(0);
  });
});

describe('Strong Lens candidates', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function surface(w: number, h: number, radius: number, parent: HTMLElement = document.body) {
    const el = document.createElement('div');
    el.className = 'wiez-lg-surface';
    Object.defineProperty(el, 'offsetWidth', { configurable: true, value: w });
    Object.defineProperty(el, 'offsetHeight', { configurable: true, value: h });
    el.style.borderTopLeftRadius = `${radius}px`;
    parent.appendChild(el);
    return el;
  }

  it('turns control-sized rounded surfaces into lenses', () => {
    expect(lensGeometryFor(surface(120, 36, 9999))).toMatchObject({ w: 120, h: 36, r: 18 });
    expect(lensGeometryFor(surface(358, 56, 28))).toMatchObject({ key: '358x56r28' });
    expect(lensGeometryFor(surface(116, 44, 14))).toMatchObject({ r: 14 });
  });

  it('keeps panels, square bars, nested glass and opted-out surfaces frosted', () => {
    expect(lensGeometryFor(surface(320, 220, 24))).toBeNull();
    expect(lensGeometryFor(surface(1200, 64, 0))).toBeNull();
    const parent = surface(358, 56, 28);
    expect(lensGeometryFor(surface(60, 44, 22, parent))).toBeNull();
    const optedOut = surface(40, 40, 20);
    optedOut.setAttribute('data-lg-lens', 'off');
    expect(lensGeometryFor(optedOut)).toBeNull();
  });

  it.runIf(typeof ResizeObserver === 'undefined')('does not start without ResizeObserver', () => {
    expect(supportsLiquidGlassLens()).toBe(false);
  });
});
