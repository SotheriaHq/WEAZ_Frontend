import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PinchZoomImage from './PinchZoomImage';

describe('PinchZoomImage', () => {
  afterEach(cleanup);

  it('renders the image with object-contain to preserve aspect ratio', () => {
    render(
      <PinchZoomImage src="https://example.com/a.jpg" alt="Design" enabled />,
    );
    const img = screen.getByAltText('Design') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://example.com/a.jpg');
    expect(img.className).toContain('object-contain');
  });

  it('notifies the caller when zoom resets after being disabled', () => {
    const onZoomChange = vi.fn();
    const { rerender } = render(
      <PinchZoomImage
        src="https://example.com/a.jpg"
        alt="Design"
        enabled
        onZoomChange={onZoomChange}
      />,
    );
    // Disabling (drawer expands) must reset zoom and report not-zoomed.
    rerender(
      <PinchZoomImage
        src="https://example.com/a.jpg"
        alt="Design"
        enabled={false}
        onZoomChange={onZoomChange}
      />,
    );
    expect(onZoomChange).toHaveBeenCalledWith(false);
  });
});
