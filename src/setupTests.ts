import '@testing-library/jest-dom';
import { afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeAll(() => {
  if (!('createObjectURL' in window.URL)) {
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:mock-url'),
    });
  } else {
    vi.spyOn(window.URL, 'createObjectURL').mockImplementation(() => 'blob:mock-url');
  }

  if (!('revokeObjectURL' in window.URL)) {
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  } else {
    vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
  }
});
