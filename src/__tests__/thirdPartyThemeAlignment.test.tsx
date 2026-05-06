import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/context/ThemeContext';

const setSystemDark = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
};

describe('third-party theme alignment', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-preference');
    document.documentElement.style.colorScheme = '';
    setSystemDark(false);
  });

  it('loads PrimeReact base CSS before Threadly app CSS so token overrides win', () => {
    const mainTsx = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8');

    expect(mainTsx.indexOf("import 'primereact/resources/themes/lara-light-blue/theme.css'")).toBeLessThan(
      mainTsx.indexOf("import './index.css'"),
    );
    expect(mainTsx.indexOf("import 'primereact/resources/primereact.min.css'")).toBeLessThan(
      mainTsx.indexOf("import './index.css'"),
    );
  });

  it('binds PrimeReact and portal surface selectors to Threadly semantic tokens', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

    expect(css).toContain('PrimeReact and third-party portal theme alignment');
    expect(css).toContain('--surface-a: var(--surface-primary)');
    expect(css).toContain('--text-color: var(--text-primary)');
    expect(css).toContain('.p-dropdown-panel');
    expect(css).toContain('.p-dialog');
    expect(css).toContain('.p-calendar');
    expect(css).toContain('.p-component-overlay');
    expect(css).toContain('[data-sonner-toast]');
  });

  it('renders PrimeReact-compatible surfaces under ThemeProvider without breaking dark root state', () => {
    localStorage.setItem('vite-ui-theme', 'dark');

    render(
      <ThemeProvider>
        <div className="p-dropdown p-component" data-testid="prime-dropdown">
          <span className="p-dropdown-label">Atelier</span>
        </div>
        <div className="p-dropdown-panel p-component" data-testid="prime-portal-panel">
          <div className="p-dropdown-items">
            <div className="p-dropdown-item">Editorial</div>
          </div>
        </div>
      </ThemeProvider>,
    );

    expect(screen.getByTestId('prime-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('prime-portal-panel')).toBeInTheDocument();
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.themePreference).toBe('dark');
  });
});
