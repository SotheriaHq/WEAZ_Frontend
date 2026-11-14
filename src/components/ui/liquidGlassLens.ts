import { buildLensMaps, LIQUID_GLASS_LENS, type LensShape } from './liquidGlassOptics';

/**
 * Strong Lens progressive enhancement for `.wiez-lg-surface`.
 *
 * Control-sized, rounded surfaces (island, circular controls, buttons, chips)
 * get an inline `backdrop-filter: url(#wiez-lens-…)` whose SVG displacement
 * map refracts the live page behind them, plus `--wiez-lg-material` (Fresnel,
 * specular, edge shade) and `data-lg-lens="on"` for the CSS lens rules. One
 * filter is shared by every surface of the same geometry.
 *
 * Left on the frosted material: panels and bars (larger than
 * `maxControlPx` or nearly square-cornered), surfaces nested inside another
 * glass surface (a backdrop-filter parent is a backdrop root, so a nested lens
 * could only see its parent), `data-lg-lens="off"`, browsers without SVG
 * backdrop filters (only Chromium renders them), and
 * `prefers-reduced-transparency`.
 */

const SURFACE_SELECTOR = '.wiez-lg-surface';
const LENS_ATTR = 'data-lg-lens';
const FILTER_PREFIX = 'wiez-lens-';
const SVG_NS = 'http://www.w3.org/2000/svg';

type Brands = { brands?: { brand: string }[] };

export function supportsLiquidGlassLens(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (typeof ResizeObserver === 'undefined' || typeof MutationObserver === 'undefined') return false;
  const brands = (navigator as Navigator & { userAgentData?: Brands }).userAgentData?.brands;
  if (brands?.some((b) => b.brand === 'Chromium')) return true;
  // Chromium on platforms without UA-CH. iOS browsers are WebKit and say CriOS/EdgiOS instead.
  return /\bChrome\/\d+/.test(navigator.userAgent);
}

interface Geometry extends LensShape {
  key: string;
}

/** The geometry a surface should refract with, or null if it stays frosted. */
export function lensGeometryFor(el: HTMLElement): Geometry | null {
  if (el.getAttribute(LENS_ATTR) === 'off') return null;
  if (el.parentElement?.closest(SURFACE_SELECTOR)) return null;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (w < 4 || h < 4) return null;
  const { maxControlPx, minRadiusPx } = LIQUID_GLASS_LENS.web;
  if (Math.min(w, h) > maxControlPx) return null;
  const radius = Math.min(Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, Math.min(w, h) / 2);
  if (radius < minRadiusPx) return null;
  const r = Math.round(radius);
  return { w, h, r, key: `${w}x${h}r${r}` };
}

function createFilter(id: string, geometry: Geometry, dpr: number): SVGFilterElement {
  const maps = buildLensMaps(geometry, dpr);
  const filter = document.createElementNS(SVG_NS, 'filter');
  const set = (node: Element, attrs: Record<string, string | number>) => {
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
    return node;
  };
  set(filter, {
    id,
    x: 0,
    y: 0,
    width: geometry.w,
    height: geometry.h,
    filterUnits: 'userSpaceOnUse',
    primitiveUnits: 'userSpaceOnUse',
    'color-interpolation-filters': 'sRGB',
  });
  const blur = LIQUID_GLASS_LENS.web.frostBlurPx / 2;
  filter.append(
    set(document.createElementNS(SVG_NS, 'feGaussianBlur'), {
      in: 'SourceGraphic',
      stdDeviation: blur,
      edgeMode: 'duplicate',
      result: 'frost',
    }),
    set(document.createElementNS(SVG_NS, 'feImage'), {
      href: maps.displacement,
      x: 0,
      y: 0,
      width: geometry.w,
      height: geometry.h,
      preserveAspectRatio: 'none',
      result: 'map',
    }),
    set(document.createElementNS(SVG_NS, 'feDisplacementMap'), {
      in: 'frost',
      in2: 'map',
      scale: maps.scale,
      xChannelSelector: 'R',
      yChannelSelector: 'G',
      result: 'refracted',
    }),
    set(document.createElementNS(SVG_NS, 'feColorMatrix'), {
      in: 'refracted',
      type: 'saturate',
      values: LIQUID_GLASS_LENS.lens.saturation,
    }),
  );
  return filter as SVGFilterElement;
}

function boot(): () => void {
  const defs = document.createElementNS(SVG_NS, 'svg');
  defs.setAttribute('aria-hidden', 'true');
  defs.setAttribute('focusable', 'false');
  defs.setAttribute('width', '0');
  defs.setAttribute('height', '0');
  defs.setAttribute('data-wiez-lens-defs', '');
  defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  document.body.appendChild(defs);

  const reducedTransparency = window.matchMedia?.('(prefers-reduced-transparency: reduce)');
  const applied = new Map<HTMLElement, string | null>();
  const filters = new Map<string, { node: SVGFilterElement; users: number }>();
  const pending = new Set<HTMLElement>();
  let frame = 0;

  const acquire = (geometry: Geometry, dpr: number): string => {
    const key = `${geometry.key}@${dpr}`;
    const id = `${FILTER_PREFIX}${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const entry = filters.get(key);
    if (entry) {
      entry.users += 1;
    } else {
      const node = createFilter(id, geometry, dpr);
      defs.appendChild(node);
      filters.set(key, { node, users: 1 });
    }
    return id;
  };

  const release = (filterKey: string) => {
    const entry = filters.get(filterKey);
    if (!entry) return;
    entry.users -= 1;
    if (entry.users <= 0) {
      entry.node.remove();
      filters.delete(filterKey);
    }
  };

  const clearLens = (el: HTMLElement) => {
    el.style.removeProperty('backdrop-filter');
    el.style.removeProperty('-webkit-backdrop-filter');
    el.style.removeProperty('--wiez-lg-material');
    if (el.getAttribute(LENS_ATTR) === 'on') el.removeAttribute(LENS_ATTR);
  };

  /** Read phase: layout and computed style only, no writes. */
  const measure = (el: HTMLElement): Geometry | null =>
    el.isConnected && el.matches(SURFACE_SELECTOR) && !reducedTransparency?.matches
      ? lensGeometryFor(el)
      : null;

  /** Write phase: styles and attributes only, no layout reads. */
  const apply = (el: HTMLElement, geometry: Geometry | null, dpr: number) => {
    const previous = applied.get(el) ?? null;
    const next = geometry ? `${geometry.key}@${dpr}` : null;
    if (next === previous) return;
    if (previous) release(previous);
    if (!geometry || !next) {
      clearLens(el);
      applied.set(el, null);
      return;
    }
    try {
      const id = acquire(geometry, dpr);
      const maps = buildLensMaps(geometry, dpr);
      el.style.setProperty('backdrop-filter', `url(#${id})`);
      el.style.setProperty('-webkit-backdrop-filter', `url(#${id})`);
      el.style.setProperty('--wiez-lg-material', `url("${maps.material}")`);
      el.setAttribute(LENS_ATTR, 'on');
      applied.set(el, next);
    } catch {
      // Canvas unavailable (privacy mode, memory pressure): keep the frosted material.
      clearLens(el);
      applied.set(el, null);
    }
  };

  const flush = () => {
    frame = 0;
    const batch = [...pending];
    pending.clear();
    const dpr = Math.min(Math.max(Math.ceil(window.devicePixelRatio || 1), 1), 2);
    // Measure everything first, then write, so the batch costs one style/layout pass.
    const plans = batch.map((el) => [el, measure(el)] as const);
    for (const [el, geometry] of plans) apply(el, geometry, dpr);
  };

  const schedule = (el: HTMLElement) => {
    pending.add(el);
    if (!frame) frame = window.requestAnimationFrame(flush);
  };

  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) schedule(entry.target as HTMLElement);
  });

  const track = (el: HTMLElement) => {
    if (applied.has(el)) return;
    applied.set(el, null);
    resizeObserver.observe(el);
    schedule(el);
  };

  const forget = (el: HTMLElement) => {
    const previous = applied.get(el);
    if (previous) release(previous);
    resizeObserver.unobserve(el);
    applied.delete(el);
    pending.delete(el);
    clearLens(el);
  };

  const collect = (node: Node, visit: (el: HTMLElement) => void) => {
    if (!(node instanceof HTMLElement)) return;
    if (node.matches(SURFACE_SELECTOR)) visit(node);
    node.querySelectorAll<HTMLElement>(SURFACE_SELECTOR).forEach(visit);
  };

  const mutationObserver = new MutationObserver((records) => {
    let removed = false;
    for (const record of records) {
      if (record.type === 'attributes') {
        const el = record.target as HTMLElement;
        if (el.matches(SURFACE_SELECTOR)) {
          if (applied.has(el)) schedule(el);
          else track(el);
        } else if (applied.has(el)) {
          forget(el);
        }
        continue;
      }
      record.addedNodes.forEach((node) => collect(node, track));
      if (record.removedNodes.length) removed = true;
    }
    if (removed) {
      for (const el of applied.keys()) {
        if (!el.isConnected) forget(el);
      }
    }
  });

  document.querySelectorAll<HTMLElement>(SURFACE_SELECTOR).forEach(track);
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  const refreshAll = () => {
    for (const el of applied.keys()) schedule(el);
  };
  reducedTransparency?.addEventListener?.('change', refreshAll);
  window.addEventListener('resize', refreshAll, { passive: true });

  return () => {
    mutationObserver.disconnect();
    resizeObserver.disconnect();
    reducedTransparency?.removeEventListener?.('change', refreshAll);
    window.removeEventListener('resize', refreshAll);
    if (frame) window.cancelAnimationFrame(frame);
    for (const el of applied.keys()) clearLens(el);
    applied.clear();
    filters.clear();
    defs.remove();
  };
}

let activeUsers = 0;
let teardown: (() => void) | null = null;

/** Starts the lens layer (idempotent, ref-counted); returns a stop function. */
export function startLiquidGlassLens(): () => void {
  if (!supportsLiquidGlassLens() || typeof document === 'undefined' || !document.body) {
    return () => undefined;
  }
  activeUsers += 1;
  if (activeUsers === 1) teardown = boot();
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    activeUsers -= 1;
    if (activeUsers === 0 && teardown) {
      teardown();
      teardown = null;
    }
  };
}
