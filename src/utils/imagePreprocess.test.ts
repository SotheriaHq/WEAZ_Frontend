import { Blob as NativeBlob, File as NativeFile } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preprocessImageFile } from './imagePreprocess';

const MB = 1024 * 1024;
let width = 2400;
let height = 3200;
let outputs: Array<{ type: string; size: number; lossless?: boolean }>;
let close: ReturnType<typeof vi.fn>;
let draw: ReturnType<typeof vi.fn>;
let fill: ReturnType<typeof vi.fn>;
let encode: ReturnType<typeof vi.fn>;
let canvas: HTMLCanvasElement;

beforeEach(() => {
  width = 2400; height = 3200;
  outputs = [{ type: 'image/webp', size: 20000, lossless: true }];
  vi.stubGlobal('Blob', NativeBlob); vi.stubGlobal('File', NativeFile);
  close = vi.fn(); draw = vi.fn(); fill = vi.fn();
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width, height, close })));
  encode = vi.fn((callback: BlobCallback, requested: string, quality?: number) => {
    const output = outputs.shift() ?? { type: 'image/webp', size: 10 * MB };
    const bytes = new Uint8Array(output.size);
    if (output.lossless) bytes.set([...Array(12).fill(0), 86, 80, 56, 76], 0);
    callback(new Blob([bytes], { type: output.type }));
    return { requested, quality };
  });
  canvas = { width: 0, height: 0, getContext: () => ({ clearRect: vi.fn(), drawImage: draw, fillRect: fill }), toBlob: encode } as unknown as HTMLCanvasElement;
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string, options?: ElementCreationOptions) =>
    tag === 'canvas' ? canvas : create(tag, options)) as typeof document.createElement);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const image = (name: string, type: string, bytes: number) => new File([new Uint8Array(bytes)], name, { type });

describe('quality-first image preprocessing', () => {
  it('retains an efficient JPEG despite a legacy 90% byte target', async () => {
    const file = image('master.jpg', 'image/jpeg', MB);
    const result = await preprocessImageFile(file, 'detail', { maxSizeBytes: 8 * MB, targetReductionRatio: .9 });
    expect(result.file).toBe(file); expect(result.skipped).toBe(true);
    expect(encode).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledOnce();
  });
  it('makes one lossless attempt at full resolution', async () => {
    const result = await preprocessImageFile(image('print.png', 'image/png', 200000), 'detail', { maxSizeBytes: 8 * MB, targetReductionRatio: .9 });
    expect(result.file.type).toBe('image/webp'); expect(result.file.name).toBe('print.pre.webp');
    expect(encode.mock.calls[0].slice(1)).toEqual(['image/webp', 1]);
    expect(draw.mock.calls[0].slice(1)).toEqual([0, 0, 2400, 3200]);
    expect(encode).toHaveBeenCalledOnce(); expect(fill).not.toHaveBeenCalled();
    expect(canvas.width).toBe(0); expect(canvas.height).toBe(0);
  });
  it('uses PNG rather than JPEG when a browser cannot encode lossless WebP', async () => {
    outputs = [{ type: 'image/png', size: 100000 }, { type: 'image/png', size: 100000 }];
    const result = await preprocessImageFile(image('alpha.png', 'image/png', 200000), 'detail', { maxSizeBytes: 8 * MB });
    expect(result.file.type).toBe('image/png'); expect(fill).not.toHaveBeenCalled();
    expect(encode.mock.calls.map((call) => call[1])).toEqual(['image/webp', 'image/png']);
  });
  it('keeps an existing valid master if a lossless re-encode is larger', async () => {
    outputs = [{ type: 'image/webp', size: 300000, lossless: true }];
    const file = image('alpha.png', 'image/png', 200000);
    expect((await preprocessImageFile(file, 'detail', { maxSizeBytes: 8 * MB })).file).toBe(file);
  });
  it('converts a small AVIF input to an accepted upload format', async () => {
    const result = await preprocessImageFile(image('tiny.avif', 'image/avif', 30000), 'detail', { maxSizeBytes: 8 * MB });
    expect(result.file.type).toBe('image/webp'); expect(result.skipped).toBe(false);
  });
  it('only lowers encoder quality to fit the actual upload ceiling', async () => {
    outputs = [{ type: 'image/webp', size: 10 * MB, lossless: true }, { type: 'image/webp', size: 7 * MB }];
    const result = await preprocessImageFile(image('large.png', 'image/png', 9 * MB), 'detail', { maxSizeBytes: 8 * MB });
    expect(result.file.size).toBe(7 * MB);
    expect(encode.mock.calls.map((call) => call[2])).toEqual([1, .97]);
    expect(draw.mock.calls.every((call) => call[3] === 2400 && call[4] === 3200)).toBe(true);
  });
  it('bounds work and rejects rather than silently destroying an over-budget image', async () => {
    outputs = Array.from({ length: 6 }, () => ({ type: 'image/webp', size: 10 * MB, lossless: true }));
    await expect(preprocessImageFile(image('large.png', 'image/png', 9 * MB), 'detail', { maxSizeBytes: 8 * MB })).rejects.toThrow('retaining detail');
    expect(encode).toHaveBeenCalledTimes(6); expect(close).toHaveBeenCalledOnce(); expect(canvas.width).toBe(0);
  });
  it('preserves GIFs and rejects oversized pixel dimensions', async () => {
    const gif = image('animation.gif', 'image/gif', 1000);
    expect((await preprocessImageFile(gif, 'detail')).file).toBe(gif);
    expect(createImageBitmap).not.toHaveBeenCalled();
    width = 8000; height = 8000;
    await expect(preprocessImageFile(image('huge.png', 'image/png', MB), 'detail')).rejects.toThrow('dimensions');
    expect(close).toHaveBeenCalledOnce();
  });
});
