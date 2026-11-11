import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  LiquidGlass,
  LIQUID_GLASS_OPTICAL_SPEC,
  liquidGlassClasses,
} from '@/components/ui/LiquidGlass';
import Card from '@/components/ui/Card';

const SRC_DIR = path.resolve(process.cwd(), 'src');

describe('Web Liquid Glass system', () => {
  it('exposes the calibrated optical parameters with zero chromatic aberration', () => {
    expect(LIQUID_GLASS_OPTICAL_SPEC.specularAngleDeg).toBe(148);
    expect(LIQUID_GLASS_OPTICAL_SPEC.chromaticAberration).toBe(0);
    expect(LIQUID_GLASS_OPTICAL_SPEC.blurPx).toEqual({
      subtle: 14,
      regular: 20,
      prominent: 26,
    });
    expect(LIQUID_GLASS_OPTICAL_SPEC.saturationPct).toEqual({
      subtle: 180,
      regular: 195,
      prominent: 210,
    });
  });

  it('builds canonical CSS class compositions across intensities, tones, shapes, and states', () => {
    expect(liquidGlassClasses()).toBe('wiez-lg-surface wiez-lg-regular rounded-2xl');

    expect(
      liquidGlassClasses({
        intensity: 'subtle',
        tone: 'stage',
        shape: 'pill',
        interactive: true,
        active: true,
        borderless: true,
        className: 'custom-hook',
      }),
    ).toBe(
      'wiez-lg-surface wiez-lg-subtle wiez-lg-stage rounded-full wiez-lg-interactive wiez-lg-active wiez-lg-borderless custom-hook',
    );

    expect(
      liquidGlassClasses({
        intensity: 'prominent',
        tone: 'light',
        shape: 'panel',
      }),
    ).toBe('wiez-lg-surface wiez-lg-prominent wiez-lg-light rounded-3xl');

    expect(
      liquidGlassClasses({
        tone: 'dark',
        shape: 'circle',
      }),
    ).toBe('wiez-lg-surface wiez-lg-regular wiez-lg-dark rounded-full aspect-square');
  });

  it('renders LiquidGlass polymorphically and forwards refs', () => {
    const ref = React.createRef<HTMLElement>();
    render(
      <LiquidGlass
        ref={ref}
        as="section"
        intensity="prominent"
        tone="stage"
        shape="panel"
        interactive
        aria-label="Floating curation bar"
      >
        Curated surface
      </LiquidGlass>,
    );

    const surface = screen.getByRole('region', { name: 'Floating curation bar' });
    expect(surface.tagName).toBe('SECTION');
    expect(surface).toHaveClass(
      'wiez-lg-surface',
      'wiez-lg-prominent',
      'wiez-lg-stage',
      'rounded-3xl',
      'wiez-lg-interactive',
    );
    expect(ref.current).toBe(surface);
  });

  it('upgrades glass cards while preserving default recessed cards', () => {
    const { rerender } = render(
      <Card data-testid="glass-card" glass>
        Glass content
      </Card>,
    );
    expect(screen.getByTestId('glass-card')).toHaveClass('wiez-lg-surface', 'wiez-lg-prominent');

    rerender(<Card data-testid="default-card">Default content</Card>);
    expect(screen.getByTestId('default-card')).toHaveClass('neu-recessed-card');
    expect(screen.getByTestId('default-card')).not.toHaveClass('wiez-lg-surface');
  });

  it('declares Liquid Glass tokens in both light and dark blocks and includes fallbacks in index.css', () => {
    const css = fs.readFileSync(path.join(SRC_DIR, 'index.css'), 'utf8');
    const darkIndex = css.indexOf('.dark {');
    expect(darkIndex).toBeGreaterThan(0);

    const lightBlock = css.slice(0, darkIndex);
    const darkBlock = css.slice(darkIndex);

    const themeScopedVars = [
      '--wiez-lg-tint-subtle',
      '--wiez-lg-tint-regular',
      '--wiez-lg-tint-prominent',
      '--wiez-lg-menu-bg',
      '--wiez-lg-nav-bg',
      '--wiez-lg-nav-scrolled-bg',
      '--wiez-lg-hover-tint',
      '--wiez-lg-pressed-overlay',
      '--wiez-lg-sheen',
      '--wiez-lg-border',
      '--wiez-lg-border-hover',
      '--wiez-lg-specular-top',
      '--wiez-lg-specular-bottom',
      '--wiez-lg-shadow',
      '--wiez-lg-shadow-hover',
      '--wiez-lg-shadow-elevated',
      '--wiez-lg-active-bg',
      '--wiez-lg-active-border',
      '--wiez-lg-active-text',
      '--wiez-lg-active-shadow',
      '--wiez-lg-focus-ring',
      '--wiez-lg-fallback-bg',
      '--wiez-lg-reduced-bg',
    ];

    for (const token of themeScopedVars) {
      expect(lightBlock).toContain(`${token}:`);
      expect(darkBlock).toContain(`${token}:`);
    }

    expect(css).toContain(
      '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))',
    );
    expect(css).toContain('@media (prefers-reduced-transparency: reduce)');
    expect(css).toContain('backdrop-filter: none !important');
    expect(css).toContain('.wiez-lg-backdrop');
    expect(css).toContain('.wiez-lg-surface.wiez-lg-stage');
  });

  it('removes inline backdropFilter overrides from Navbar so CSS glass fallbacks stay authoritative', () => {
    const navbarSource = fs.readFileSync(
      path.join(SRC_DIR, 'components', 'Navbar.tsx'),
      'utf8',
    );
    expect(navbarSource).not.toMatch(/backdropFilter\s*:\s*['"]blur\(/);
    expect(navbarSource).not.toContain('surface-menu w-[min');
  });
});
