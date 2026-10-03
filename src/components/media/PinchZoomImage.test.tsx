import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import PinchZoomImage from './PinchZoomImage';

describe('PinchZoomImage', () => {
  afterEach(cleanup);

  it('renders an inline aspect-correct image (w-full h-auto object-contain, no forced height)', () => {
    render(<PinchZoomImage src="https://example.com/a.jpg" alt="Design" />);
    const img = screen.getByAltText('Design') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://example.com/a.jpg');
    expect(img.className).toContain('object-contain');
    expect(img.className).toContain('h-auto');
    expect(img.className).toContain('w-full');
  });
});
