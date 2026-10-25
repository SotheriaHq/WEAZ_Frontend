import React, { createRef } from 'react';
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFilePicker } from './useFilePicker';
import FileUploader from './FileUploader';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('../Button', () => ({ default: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button> }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
const files = (...items: File[]) => items as unknown as FileList;
describe('file picker lifecycle', () => {
  it('zero remaining slots rejects files instead of overwriting current selection', () => {
    const onFiles = vi.fn(); const { result } = renderHook(() => useFilePicker({ maxFiles: 0, onFiles }));
    act(() => result.current.handlers.onInputChange({ target: { files: files(file), value: 'selected' } } as never));
    expect(onFiles).not.toHaveBeenCalled(); expect(result.current.errors[0]).toContain('Remove');
  });
  it('cancelled selection leaves current selection and errors unchanged; same file can be chosen again', () => {
    const onFiles = vi.fn(); const { result } = renderHook(() => useFilePicker({ onFiles }));
    const target = { files: files(file), value: 'selected' };
    act(() => result.current.handlers.onInputChange({ target } as never));
    expect(target.value).toBe('');
    act(() => result.current.handlers.onInputChange({ target: { files: files(), value: '' } } as never));
    expect(onFiles).toHaveBeenCalledTimes(1);
    act(() => result.current.handlers.onInputChange({ target } as never));
    expect(onFiles).toHaveBeenCalledTimes(2);
  });
  it('cleans pending timer when unmounted', () => {
    vi.useFakeTimers(); const { result, unmount } = renderHook(() => useFilePicker({ onFiles: vi.fn() }));
    act(() => result.current.handlers.onInputChange({ target: { files: files(file), value: '' } } as never));
    expect(vi.getTimerCount()).toBe(1); unmount(); expect(vi.getTimerCount()).toBe(0);
  });
  it('exact MIME allowlist does not admit other subtypes', () => {
    const onFiles = vi.fn(); const { result } = renderHook(() => useFilePicker({ accept: ['image/png'], onFiles }));
    act(() => result.current.handlers.onInputChange({ target: { files: files(file), value: '' } } as never));
    expect(onFiles).not.toHaveBeenCalled();
  });
  it('imperative open uses current disabled state and current shared picker', () => {
    const ref = createRef<{ open: () => void }>(); const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    const view = render(<FileUploader ref={ref} onFilesUpload={vi.fn()} />);
    ref.current?.open(); expect(click).toHaveBeenCalledTimes(1);
    view.rerender(<FileUploader ref={ref} onFilesUpload={vi.fn()} disabled />);
    ref.current?.open(); expect(click).toHaveBeenCalledTimes(1);
  });
  it('standalone uploader respects zero slots and refreshed upload callback', () => {
    const old = vi.fn(); const next = vi.fn(); const view = render(<FileUploader maxFiles={0} onFilesUpload={old} />);
    const input = view.container.querySelector('input')!;
    fireEvent.change(input, { target: { files: files(file) } }); expect(old).not.toHaveBeenCalled();
    view.rerender(<FileUploader maxFiles={1} onFilesUpload={next} />);
    fireEvent.change(input, { target: { files: files(file) } }); expect(next).toHaveBeenCalledTimes(1); expect(old).not.toHaveBeenCalled();
  });
});
