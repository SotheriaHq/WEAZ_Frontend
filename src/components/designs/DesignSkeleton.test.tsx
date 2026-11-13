import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DesignSkeleton from './DesignSkeleton';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const ratios = (container: HTMLElement) => Array.from(container.querySelectorAll<HTMLElement>('article > div:first-child')).map(node => node.style.aspectRatio);
describe('Design loading placeholder stability', () => {
  it('retains every card height when its parent rerenders', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const view = render(<DesignSkeleton />);
    const initial = ratios(view.container);
    random.mockReturnValue(0.99);
    view.rerender(<DesignSkeleton />);
    expect(ratios(view.container)).toEqual(initial);
  });
  it('keeps varied shapes and retains existing slots when the count grows', () => {
    const view = render(<DesignSkeleton count={3} />);
    const initial = ratios(view.container);
    expect(new Set(initial).size).toBeGreaterThan(1);
    view.rerender(<DesignSkeleton count={9} />);
    expect(ratios(view.container).slice(0, 3)).toEqual(initial);
    expect(ratios(view.container)).toHaveLength(9);
  });
  it('retains the empty and default-count behavior', () => {
    const view = render(<DesignSkeleton count={0} />);
    expect(ratios(view.container)).toEqual([]);
    view.rerender(<DesignSkeleton />);
    expect(ratios(view.container)).toHaveLength(8);
  });
});
