import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MediaProvider, useMediaStore } from '../hooks/useMediaStore';

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MediaProvider>{children}</MediaProvider>
);

describe('useMediaStore', () => {
  it('throws if used outside of MediaProvider', () => {
    expect(() => renderHook(() => useMediaStore())).toThrow('useMediaStore must be used within MediaProvider');
  });

  it('adds, removes, and clears media items', () => {
    const { result } = renderHook(() => useMediaStore(), { wrapper });

    const fileA = new File(['file-a'], 'file-a.png', { type: 'image/png' });
    const fileB = new File(['file-b'], 'file-b.png', { type: 'image/png' });

    act(() => {
      result.current.addFiles([fileA, fileB]);
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items.map((item) => item.file)).toEqual([fileA, fileB]);
    const firstId = result.current.items[0].id;
    act(() => {
      result.current.remove(firstId);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].file).toBe(fileB);

    act(() => {
      result.current.clear();
    });

    expect(result.current.items).toHaveLength(0);
  });
});
