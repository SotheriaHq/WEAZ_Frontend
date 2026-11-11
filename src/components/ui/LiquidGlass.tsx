import React from 'react';
import { clsx } from 'clsx';

export type LiquidGlassIntensity = 'subtle' | 'regular' | 'prominent';
export type LiquidGlassTone = 'auto' | 'light' | 'dark' | 'stage';
export type LiquidGlassShape = 'pill' | 'card' | 'panel' | 'circle' | 'none';
export type LiquidGlassElement =
  | 'div'
  | 'section'
  | 'nav'
  | 'aside'
  | 'header'
  | 'footer'
  | 'span'
  | 'article';

export interface LiquidGlassClassOptions {
  intensity?: LiquidGlassIntensity;
  tone?: LiquidGlassTone;
  shape?: LiquidGlassShape;
  interactive?: boolean;
  active?: boolean;
  borderless?: boolean;
  className?: string;
}

/**
 * Web optical calibration parameters aligned with the approved WIEZ v4
 * Liquid Glass reference baseline: clear center transmission, high-saturation
 * backdrop sampling, directional specular rim lighting, zero chromatic
 * aberration, and graceful reduced-transparency fallback support.
 */
export const LIQUID_GLASS_OPTICAL_SPEC = {
  specularAngleDeg: 148,
  chromaticAberration: 0,
  blurPx: {
    subtle: 14,
    regular: 20,
    prominent: 26,
  },
  saturationPct: {
    subtle: 180,
    regular: 195,
    prominent: 210,
  },
} as const;

const INTENSITY_CLASS_MAP: Record<LiquidGlassIntensity, string> = {
  subtle: 'wiez-lg-subtle',
  regular: 'wiez-lg-regular',
  prominent: 'wiez-lg-prominent',
};

const TONE_CLASS_MAP: Record<LiquidGlassTone, string> = {
  auto: '',
  light: 'wiez-lg-light',
  dark: 'wiez-lg-dark',
  stage: 'wiez-lg-stage',
};

const SHAPE_CLASS_MAP: Record<LiquidGlassShape, string> = {
  pill: 'rounded-full',
  circle: 'rounded-full aspect-square',
  card: 'rounded-2xl',
  panel: 'rounded-3xl',
  none: '',
};

/**
 * Returns the canonical Liquid Glass CSS class composition for any eligible UI
 * container or control across Web themes and media stages.
 */
export function liquidGlassClasses({
  intensity = 'regular',
  tone = 'auto',
  shape = 'card',
  interactive = false,
  active = false,
  borderless = false,
  className,
}: LiquidGlassClassOptions = {}): string {
  return clsx(
    'wiez-lg-surface',
    INTENSITY_CLASS_MAP[intensity],
    TONE_CLASS_MAP[tone],
    SHAPE_CLASS_MAP[shape],
    interactive && 'wiez-lg-interactive',
    active && 'wiez-lg-active',
    borderless && 'wiez-lg-borderless',
    className,
  );
}

export interface LiquidGlassProps
  extends React.HTMLAttributes<HTMLElement>,
    LiquidGlassClassOptions {
  as?: LiquidGlassElement;
}

export const LiquidGlass = React.forwardRef<HTMLElement, LiquidGlassProps>(
  (
    {
      as: Component = 'div',
      intensity = 'regular',
      tone = 'auto',
      shape = 'card',
      interactive = false,
      active = false,
      borderless = false,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    const resolvedClassName = liquidGlassClasses({
      intensity,
      tone,
      shape,
      interactive,
      active,
      borderless,
      className,
    });

    return React.createElement(
      Component,
      {
        ref,
        className: resolvedClassName,
        ...rest,
      },
      children,
    );
  },
);

LiquidGlass.displayName = 'LiquidGlass';

export default LiquidGlass;
