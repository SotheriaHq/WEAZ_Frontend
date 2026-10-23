import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PinchZoomImage from './PinchZoomImage';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('keeps the shared image ref, drag suppression and double-tap zoom', () => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  const onZoomChange = vi.fn();
  const view = render(<PinchZoomImage src="/fabric.jpg" alt="Fabric" onZoomChange={onZoomChange} />);
  const image = view.getByAltText('Fabric');
  expect(image).toHaveAttribute('draggable', 'false');
  fireEvent.doubleClick(image);
  expect(onZoomChange).toHaveBeenLastCalledWith(true);
  const scale = Number((image as HTMLImageElement).style.transform.match(/scale\(([^)]+)\)/)?.[1]);
  expect(scale).toBeGreaterThan(1);
  fireEvent.doubleClick(image);
  expect(onZoomChange).toHaveBeenLastCalledWith(false);
});
