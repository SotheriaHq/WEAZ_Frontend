/**
 * WIEZ Strong Lens: the single optical spec and surface model for refracting
 * glass on the Web (owner-approved 14 Nov 2026 for the island, circular
 * controls, buttons and chips).
 *
 * The numbers are the same as `tokens.liquidGlass.optics` in the mobile app,
 * which drives the Android AGSL shader; keep the two identical.
 *
 * Model
 * - Geometry: a rounded-rect signed distance field gives exact normals for
 *   circles, capsules and rounded rects. Normals come from a corner radius at
 *   least as large as the bezel, so corners never crease.
 * - Refraction: inside a bezel up to the full short half-axis, the backdrop is
 *   sampled inward along the normal by S·(1 − t)^k, plus a slight pull toward
 *   the medial axis (magnification). S is hard-clamped so the sampling map can
 *   never fold (local derivative ≥ 0.15).
 * - Reflection: the normal is lifted to 3D with a rim tilt; Schlick Fresnel, a
 *   key-light specular lobe and a weaker exit caustic follow the real curvature.
 */
export const LIQUID_GLASS_LENS = {
  /** Fraction of the short half-axis that is curved (1 = full dome). */
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
  web: {
    /** Light frost under the displacement (CSS px). */
    frostBlurPx: 0.6,
    /** Surfaces whose short side is larger than this stay frosted panels. */
    maxControlPx: 64,
    /** Surfaces with smaller corner radii (bars, sheets) stay frosted. */
    minRadiusPx: 8,
  },
} as const;

/** Key light direction in screen space (y down): top-left. Same as the AGSL shader. */
const LIGHT_X = -0.616;
const LIGHT_Y = -0.788;
/** Neutral charcoal used for the inboard edge shade (same as the AGSL shader). */
const SHADE_RGB = [14, 14, 16] as const;

export interface LensShape {
  w: number;
  h: number;
  r: number;
}

export interface LensOptics {
  hx: number;
  hy: number;
  minHalf: number;
  r: number;
  r2: number;
  bezel: number;
  maxShift: number;
  magnify: number;
  maxTilt: number;
  fresnel: number;
  spec: number;
  rimGain: number;
  shade: number;
  h1: readonly [number, number, number];
  h2: readonly [number, number, number];
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function normalize3(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

function halfVector(lx: number, ly: number): [number, number, number] {
  const l = normalize3(lx * 0.72, ly * 0.72, 0.7);
  return normalize3(l[0], l[1], l[2] + 1);
}

const H1 = halfVector(LIGHT_X, LIGHT_Y);
const H2 = halfVector(-LIGHT_X, -LIGHT_Y);

export function resolveLensOptics(shape: LensShape, spec = LIQUID_GLASS_LENS): LensOptics {
  const { lens } = spec;
  const hx = shape.w / 2;
  const hy = shape.h / 2;
  const minHalf = Math.min(hx, hy);
  const r = clamp(shape.r, 0, minHalf);
  const thickness = clamp(spec.opticalThickness, 0, 1);
  const bezel = clamp(minHalf * spec.curvature * mix(0.6, 1.2, thickness), 3, Math.min(minHalf, lens.bezelMaxDp));
  const magnify = spec.refractionStrength > 0.001 ? lens.magnify : 0;
  const designShift = Math.min(
    lens.depthFrac * bezel * mix(0.6, 1.25, thickness),
    (Math.max(0, lens.stretchLimit - magnify) * bezel) / lens.falloffK,
  );
  const foldLimit = (Math.max(0, 0.85 - magnify) * bezel) / lens.falloffK;
  return {
    hx,
    hy,
    minHalf,
    r,
    r2: clamp(Math.max(r, bezel), 0, minHalf),
    bezel,
    maxShift: clamp(spec.refractionStrength * designShift, 0, foldLimit),
    magnify,
    maxTilt: ((lens.maxTiltDeg * Math.PI) / 180) * mix(0.75, 1.1, thickness),
    fresnel: lens.fresnelGain * spec.reflectionStrength,
    spec: lens.specGain * spec.reflectionStrength,
    rimGain: (lens.fresnelGain * spec.reflectionStrength) / 0.9,
    shade: lens.shadeGain * mix(0.7, 1.3, thickness),
    h1: H1,
    h2: H2,
  };
}

export function sdRoundRect(px: number, py: number, hx: number, hy: number, r: number): number {
  const qx = Math.abs(px) - (hx - r);
  const qy = Math.abs(py) - (hy - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

export interface LensSample {
  /** Backdrop sample offset (CSS px) relative to this pixel. */
  ox: number;
  oy: number;
  /** White highlight alpha (Fresnel + specular + rim). */
  highlight: number;
  /** Neutral inboard edge shade alpha. */
  shade: number;
}

/**
 * Evaluates the lens at a point relative to the shape centre. With
 * `extendEdge`, points outside the shape return the rim displacement so the
 * filtered displacement map never blends a full rim shift with "no shift".
 */
export function sampleLens(px: number, py: number, o: LensOptics, extendEdge = false): LensSample | null {
  const sdReal = sdRoundRect(px, py, o.hx, o.hy, o.r);
  if (sdReal > 0 && !extendEdge) return null;
  const inwardReal = Math.max(0, -sdReal);

  const qx = Math.abs(px) - (o.hx - o.r2);
  const qy = Math.abs(py) - (o.hy - o.r2);
  const sx = px >= 0 ? 1 : -1;
  const sy = py >= 0 ? 1 : -1;
  let nx = 0;
  let ny = sy;
  if (qx > 0 && qy > 0) {
    const l = Math.hypot(qx, qy);
    nx = (qx / l) * sx;
    ny = (qy / l) * sy;
  } else if (qx > qy) {
    nx = sx;
    ny = 0;
  }
  const inwardOpt = Math.max(0, -sdRoundRect(px, py, o.hx, o.hy, o.r2));
  const t = clamp(inwardOpt / o.bezel, 0, 1);
  const shift = o.maxShift * Math.pow(1 - t, LIQUID_GLASS_LENS.lens.falloffK);
  const mxl = o.hx - o.minHalf;
  const myl = o.hy - o.minHalf;
  const ox = -nx * shift - (px - clamp(px, -mxl, mxl)) * o.magnify;
  const oy = -ny * shift - (py - clamp(py, -myl, myl)) * o.magnify;

  const tilt = o.maxTilt * Math.pow(1 - t, 1.35);
  const st = Math.sin(tilt);
  const ct = Math.cos(tilt);
  const n3x = nx * st;
  const n3y = ny * st;
  const fres = 0.04 + 0.96 * Math.pow(1 - ct, 5);
  const shininess = LIQUID_GLASS_LENS.lens.shininess;
  const d1 = Math.max(0, n3x * o.h1[0] + n3y * o.h1[1] + ct * o.h1[2]);
  const d2 = Math.max(0, n3x * o.h2[0] + n3y * o.h2[1] + ct * o.h2[2]);
  const spec = (Math.pow(d1, shininess) + Math.pow(d2, shininess * 1.3) * 0.38) * o.spec;
  const facing = nx * LIGHT_X + ny * LIGHT_Y;
  const rimT = clamp(1 - inwardReal / LIQUID_GLASS_LENS.lens.rimDp, 0, 1);
  const rim =
    Math.pow(rimT, 1.6) *
    (0.1 + 0.65 * Math.pow(Math.max(facing, 0), 2) + 0.3 * Math.pow(Math.max(-facing, 0), 3)) *
    o.rimGain;

  return {
    ox,
    oy,
    highlight: clamp(fres * o.fresnel * 0.9 + spec + rim, 0, 0.95),
    shade: clamp(Math.exp(-inwardReal / 2.4) * (0.45 + 0.55 * Math.max(-facing, 0)) * o.shade, 0, 0.3),
  };
}

export interface LensMaps {
  /** RG displacement map for <feDisplacementMap> (CSS px resolution). */
  displacement: string;
  /** feDisplacementMap `scale` matching the map encoding. */
  scale: number;
  /** RGBA highlight + shade overlay at device resolution. */
  material: string;
}

const MAX_CACHED_MAPS = 160;
const mapCache = new Map<string, LensMaps>();

/** Displacement + material maps for one geometry (cached; theme independent). */
export function buildLensMaps(shape: LensShape, devicePixelRatio = 1): LensMaps {
  const w = Math.max(1, Math.round(shape.w));
  const h = Math.max(1, Math.round(shape.h));
  const dpr = clamp(Math.ceil(devicePixelRatio), 1, 2);
  const key = `${w}x${h}r${Math.round(shape.r)}@${dpr}`;
  const cached = mapCache.get(key);
  if (cached) return cached;

  const o = resolveLensOptics({ w, h, r: shape.r });
  const scale = Math.max(1, 2 * (o.maxShift + o.magnify * o.minHalf + 1));

  const dispCanvas = document.createElement('canvas');
  dispCanvas.width = w;
  dispCanvas.height = h;
  const dispCtx = dispCanvas.getContext('2d');
  const matCanvas = document.createElement('canvas');
  matCanvas.width = w * dpr;
  matCanvas.height = h * dpr;
  const matCtx = matCanvas.getContext('2d');
  if (!dispCtx || !matCtx) throw new Error('Liquid glass lens: 2D canvas unavailable');

  const disp = dispCtx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sample = sampleLens(x + 0.5 - o.hx, y + 0.5 - o.hy, o, true);
      const i = (y * w + x) * 4;
      disp.data[i] = clamp(Math.round(128 + ((sample?.ox ?? 0) / scale) * 255), 0, 255);
      disp.data[i + 1] = clamp(Math.round(128 + ((sample?.oy ?? 0) / scale) * 255), 0, 255);
      disp.data[i + 2] = 128;
      disp.data[i + 3] = 255;
    }
  }
  dispCtx.putImageData(disp, 0, 0);

  const mat = matCtx.createImageData(w * dpr, h * dpr);
  for (let y = 0; y < h * dpr; y++) {
    for (let x = 0; x < w * dpr; x++) {
      const sample = sampleLens((x + 0.5) / dpr - o.hx, (y + 0.5) / dpr - o.hy, o);
      if (!sample) continue;
      // Neutral shade under a white highlight, non-premultiplied "over".
      const shadeA = sample.shade * (1 - sample.highlight);
      const a = sample.highlight + shadeA;
      if (a <= 0) continue;
      const i = (y * w * dpr + x) * 4;
      for (let c = 0; c < 3; c++) {
        mat.data[i + c] = (255 * sample.highlight + SHADE_RGB[c] * shadeA) / a;
      }
      mat.data[i + 3] = Math.round(clamp(a, 0, 1) * 255);
    }
  }
  matCtx.putImageData(mat, 0, 0);

  const maps: LensMaps = {
    displacement: dispCanvas.toDataURL('image/png'),
    scale,
    material: matCanvas.toDataURL('image/png'),
  };
  if (mapCache.size >= MAX_CACHED_MAPS) {
    const oldest = mapCache.keys().next().value;
    if (oldest !== undefined) mapCache.delete(oldest);
  }
  mapCache.set(key, maps);
  return maps;
}
