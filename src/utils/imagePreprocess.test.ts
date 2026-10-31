import { Blob as NativeBlob, File as NativeFile } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preprocessImageFile } from './imagePreprocess';

const MB = 1024 * 1024;
const budget = { maxSizeBytes: 2 * MB, preferredSizeBytes: MB };
let width = 3000;
let height = 4000;
let outputs: Array<{ type: string; size: number; lossless?: boolean }>;
let close: ReturnType<typeof vi.fn>;
let draw: ReturnType<typeof vi.fn>;
let fill: ReturnType<typeof vi.fn>;
let encode: ReturnType<typeof vi.fn>;
let encodedSizes: string[];
let canvas: HTMLCanvasElement;

beforeEach(() => {
  width = 3000; height = 4000;
  outputs = [{ type: 'image/webp', size: 20000, lossless: true }];
  vi.stubGlobal('Blob', NativeBlob); vi.stubGlobal('File', NativeFile);
  close = vi.fn(); draw = vi.fn(); fill = vi.fn();
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width, height, close })));
  encodedSizes = [];
  encode = vi.fn((callback: BlobCallback, requested: string, quality?: number) => {
    encodedSizes.push(`${canvas.width}x${canvas.height}`);
    const output = outputs.shift() ?? { type: requested, size: 10 * MB };
    const bytes = new Uint8Array(output.size);
    if (output.lossless) bytes.set([...Array(12).fill(0), 86, 80, 56, 76], 0);
    callback(new Blob([bytes], { type: output.type }));
    return { requested, quality };
  });
  canvas = { width: 0, height: 0, getContext: () => ({ drawImage: draw, fillRect: fill }), toBlob: encode } as unknown as HTMLCanvasElement;
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string, options?: ElementCreationOptions) =>
    tag === 'canvas' ? canvas : create(tag, options)) as typeof document.createElement);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const image = (name: string, type: string, bytes: number) => new File([new Uint8Array(bytes)], name, { type });
const jpeg = (size: number) => ({ type: 'image/jpeg', size: Math.floor(size) });
const webp = (size: number) => ({ type: 'image/webp', size: Math.floor(size) });
const attempts = () => encode.mock.calls.map((call) => `${call[1].split('/')[1]} ${call[2]}`);

describe('compression-only image preprocessing', () => {
  it('leaves an image already inside the target untouched', async () => {
    const file = image('master.jpg', 'image/jpeg', MB);
    const result = await preprocessImageFile(file, budget);
    expect(result.file).toBe(file); expect(result.skipped).toBe(true);
    expect(encode).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledOnce();
  });
  it('compresses a 3 MB photo that would otherwise be refused, using the highest quality that fits', async () => {
    outputs = [jpeg(0.9 * MB), jpeg(1.6 * MB), jpeg(1.2 * MB)];
    const result = await preprocessImageFile(image('13068.jpg', 'image/jpeg', 3 * MB), budget);
    expect(result.skipped).toBe(false);
    expect(result.file.name).toBe('13068.pre.jpg');
    expect(result.file.size).toBe(Math.floor(0.9 * MB));
    expect(attempts()).toEqual(['jpeg 0.85', 'jpeg 0.95', 'jpeg 0.9']);
  });
  it('still aims for the target when the source is already under the ceiling', async () => {
    outputs = [jpeg(0.6 * MB), jpeg(0.8 * MB)];
    const result = await preprocessImageFile(image('photo.jpg', 'image/jpeg', 1.5 * MB), budget);
    expect(result.file.size).toBe(Math.floor(0.8 * MB));
  });
  it('never resizes: every attempt encodes the source at its original dimensions', async () => {
    width = 8000; height = 6000;
    outputs = [jpeg(6.9 * MB), jpeg(4.5 * MB), jpeg(3.7 * MB), webp(2.3 * MB), webp(1.8 * MB)];
    const result = await preprocessImageFile(image('48mp.jpg', 'image/jpeg', 12 * MB), budget);
    expect(result.file.size).toBe(Math.floor(1.8 * MB));
    expect(draw).toHaveBeenCalledOnce();
    expect(draw.mock.calls[0]).toHaveLength(3);
    expect(draw.mock.calls[0].slice(1)).toEqual([0, 0]);
    expect(encodedSizes).toHaveLength(5);
    expect(encodedSizes.every((size) => size === '8000x6000')).toBe(true);
  });
  it('keeps the original when the target is out of reach and the API would accept it', async () => {
    outputs = [jpeg(1.4 * MB), jpeg(1.3 * MB), jpeg(1.2 * MB)];
    const file = image('detailed.jpg', 'image/jpeg', 1.5 * MB);
    const result = await preprocessImageFile(file, budget);
    expect(result.file).toBe(file); expect(result.reason).toBe('original-within-upload-limit');
  });
  it('uploads the floor result between target and ceiling rather than spending more quality', async () => {
    outputs = [jpeg(2.2 * MB), jpeg(1.9 * MB), jpeg(1.6 * MB)];
    const result = await preprocessImageFile(image('busy.jpg', 'image/jpeg', 5 * MB), budget);
    expect(result.file.size).toBe(Math.floor(1.6 * MB));
    expect(attempts()).toEqual(['jpeg 0.85', 'jpeg 0.7', 'jpeg 0.6']);
  });
  it('stops a photo under 8 MP at the 80% floor, where the view hides less', async () => {
    width = 2000; height = 1500;
    outputs = [jpeg(1.5 * MB), jpeg(1.4 * MB), jpeg(1.3 * MB)];
    const result = await preprocessImageFile(image('small.jpg', 'image/jpeg', 3 * MB), budget);
    expect(result.file.size).toBe(Math.floor(1.3 * MB));
    expect(attempts()).toEqual(['jpeg 0.9', 'jpeg 0.85', 'jpeg 0.8']);
  });
  it('spends WebP last-resort quality only to get under the ceiling', async () => {
    outputs = [jpeg(5 * MB), jpeg(4 * MB), jpeg(3 * MB), webp(2.4 * MB), webp(1.8 * MB)];
    const result = await preprocessImageFile(image('huge.jpg', 'image/jpeg', 11 * MB), budget);
    expect(result.file.name).toBe('huge.pre.webp');
    expect(attempts()).toEqual(['jpeg 0.85', 'jpeg 0.7', 'jpeg 0.6', 'webp 0.6', 'webp 0.5']);
  });
  it('bounds work and reports a file that compression alone cannot fit', async () => {
    outputs = [];
    await expect(preprocessImageFile(image('noise.jpg', 'image/jpeg', 11 * MB), budget)).rejects.toThrow('too detailed');
    expect(encode).toHaveBeenCalledTimes(6); expect(close).toHaveBeenCalledOnce(); expect(canvas.width).toBe(0);
  });
  it('makes one lossless attempt on a graphic before spending any quality', async () => {
    const result = await preprocessImageFile(image('print.png', 'image/png', 200000), budget);
    expect(result.file.type).toBe('image/webp'); expect(result.file.name).toBe('print.pre.webp');
    expect(encode.mock.calls[0].slice(1)).toEqual(['image/webp', 1]);
    expect(encode).toHaveBeenCalledOnce(); expect(fill).not.toHaveBeenCalled();
    expect(canvas.width).toBe(0); expect(canvas.height).toBe(0);
  });
  it('uses PNG rather than JPEG when a browser cannot encode lossless WebP', async () => {
    outputs = [{ type: 'image/png', size: 100000 }, { type: 'image/png', size: 100000 }];
    const result = await preprocessImageFile(image('alpha.png', 'image/png', 200000), budget);
    expect(result.file.type).toBe('image/png'); expect(fill).not.toHaveBeenCalled();
    expect(encode.mock.calls.map((call) => call[1])).toEqual(['image/webp', 'image/png']);
  });
  it('keeps an existing valid master if a lossless re-encode is larger', async () => {
    outputs = [{ type: 'image/webp', size: 300000, lossless: true }];
    const file = image('alpha.png', 'image/png', 200000);
    expect((await preprocessImageFile(file, budget)).file).toBe(file);
  });
  it('converts a small AVIF input to an accepted upload format', async () => {
    const result = await preprocessImageFile(image('tiny.avif', 'image/avif', 30000), budget);
    expect(result.file.type).toBe('image/webp'); expect(result.skipped).toBe(false);
  });
  it('compresses a transparent image with WebP, which keeps the transparency', async () => {
    outputs = [webp(0.9 * MB), webp(1.5 * MB), webp(1.2 * MB)];
    const result = await preprocessImageFile(image('cutout.png', 'image/png', 3 * MB), budget);
    expect(result.file.type).toBe('image/webp'); expect(fill).not.toHaveBeenCalled();
    expect(encode.mock.calls.every((call) => call[1] === 'image/webp')).toBe(true);
  });
  it('flattens onto white only when Safari has no WebP and the file cannot go up as it is', async () => {
    outputs = [{ type: 'image/png', size: 6 * MB }, jpeg(0.9 * MB), { type: 'image/png', size: 6 * MB }, jpeg(1.5 * MB), { type: 'image/png', size: 6 * MB }, jpeg(1.2 * MB)];
    const result = await preprocessImageFile(image('safari.png', 'image/png', 4 * MB), budget);
    expect(result.file.name).toBe('safari.pre.jpg');
    expect(fill).toHaveBeenCalled();
  });
  it('keeps transparency rather than flattening a file the API would accept', async () => {
    outputs = Array.from({ length: 3 }, () => ({ type: 'image/png', size: 3 * MB }));
    const file = image('alpha.webp', 'image/webp', 1.9 * MB);
    const result = await preprocessImageFile(file, budget);
    expect(result.file).toBe(file); expect(result.reason).toBe('alpha-preserved');
    expect(fill).not.toHaveBeenCalled();
  });
  it('preserves GIFs and rejects oversized pixel dimensions', async () => {
    const gif = image('animation.gif', 'image/gif', 1000);
    expect((await preprocessImageFile(gif)).file).toBe(gif);
    expect(createImageBitmap).not.toHaveBeenCalled();
    width = 8000; height = 8000;
    await expect(preprocessImageFile(image('huge.png', 'image/png', MB))).rejects.toThrow('dimensions');
    expect(close).toHaveBeenCalledOnce();
  });
  it('runs at most two encodes at once, however many photos a design prepares', async () => {
    let active = 0;
    let peak = 0;
    vi.stubGlobal('createImageBitmap', vi.fn(async () => {
      active += 1; peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      return { width, height, close: () => { active -= 1; } };
    }));
    const photos = Array.from({ length: 6 }, (_, index) => image(`photo-${index}.jpg`, 'image/jpeg', 1000));
    await Promise.all(photos.map((photo) => preprocessImageFile(photo, budget)));
    expect(peak).toBe(2);
  });
  it('releases its encode slot when a file cannot be decoded', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('decode failed'); }));
    const failed = Array.from({ length: 4 }, () => preprocessImageFile(image('bad.jpg', 'image/jpeg', 1000), budget));
    await expect(Promise.allSettled(failed)).resolves.toHaveLength(4);
  });
});
