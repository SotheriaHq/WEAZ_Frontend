import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MediaRenderer from './MediaRenderer';
import { clearCachedMediaUrls } from '@/utils/mediaUrlCache';

const api = vi.hoisted(() => ({ getSignedMediaSourceUrl: vi.fn() }));
vi.mock('@/api/BrandApi', () => ({ brandApi: api }));
const now = Date.UTC(2026, 9, 22, 12);
const source = (expiry: number, signature: string) => `https://media.example.com/media/variant.webp?env=sit&method=GET&exp=${now / 1000 + expiry}&sig=${signature}`;

describe('URL-only shared media capability renewal', () => {
  beforeEach(() => {
    clearCachedMediaUrls();
    api.getSignedMediaSourceUrl.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterEach(() => { vi.useRealTimers(); });

  it('renews a raw URL after idle without requiring a query provider or file id', async () => {
    api.getSignedMediaSourceUrl.mockResolvedValue(source(600, 'fresh'));
    render(<MediaRenderer kind="image" src={source(300, 'old')} alt="Design" />);
    expect(screen.getByAltText('Design')).toHaveAttribute('src', source(300, 'old'));
    await act(async () => { await vi.advanceTimersByTimeAsync(270_000); });
    expect(screen.getByAltText('Design')).toHaveAttribute('src', source(600, 'fresh'));
    expect(api.getSignedMediaSourceUrl).toHaveBeenCalledTimes(1);
  });

  it('retries the exact variant once after an image error', async () => {
    api.getSignedMediaSourceUrl.mockResolvedValue(source(600, 'fresh'));
    const onError = vi.fn();
    render(<MediaRenderer kind="image" src={source(300, 'old')} alt="Design" onError={onError} />);
    await act(async () => { fireEvent.error(screen.getByAltText('Design')); });
    expect(screen.getByAltText('Design')).toHaveAttribute('src', source(600, 'fresh'));
    expect(onError).not.toHaveBeenCalled();
    await act(async () => { fireEvent.error(screen.getByAltText('Design')); });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(api.getSignedMediaSourceUrl).toHaveBeenCalledTimes(1);
  });

  it('never renders an unsigned private R2 origin after renewal denial', async () => {
    api.getSignedMediaSourceUrl.mockResolvedValue(null);
    const raw = 'https://account.r2.cloudflarestorage.com/private/variant.webp';
    const view = render(<MediaRenderer kind="image" src={raw} alt="Private" />);
    await act(async () => { await Promise.resolve(); });
    expect(view.container.querySelector('img')).toBeNull();
    expect(api.getSignedMediaSourceUrl).toHaveBeenCalledWith(raw, { forceRefresh: true });
  });

  it('drops private media immediately when the account session changes', async () => {
    api.getSignedMediaSourceUrl.mockResolvedValue(null);
    const view = render(<MediaRenderer kind="image" src={source(300, 'old')} alt="Private" />);
    expect(view.container.querySelector('img')).not.toBeNull();
    await act(async () => { clearCachedMediaUrls(); });
    expect(view.container.querySelector('img')).toBeNull();
  });

  it('retains video playback position when only the capability changes', async () => {
    api.getSignedMediaSourceUrl.mockResolvedValue(source(600, 'fresh'));
    const view = render(<MediaRenderer kind="video" src={source(300, 'old')} />);
    const video = view.container.querySelector('video')!;
    Object.defineProperty(video, 'paused', { configurable: true, value: false });
    Object.defineProperty(video, 'duration', { configurable: true, value: 100 });
    video.play = vi.fn().mockResolvedValue(undefined);
    video.currentTime = 20;
    fireEvent.timeUpdate(video);
    await act(async () => { await vi.advanceTimersByTimeAsync(270_000); });
    expect(video).toHaveAttribute('src', source(600, 'fresh'));
    video.currentTime = 0;
    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(20);
    expect(video.play).toHaveBeenCalledTimes(1);
  });
});
