import { describe, expect, it } from 'vitest';
import {
  sniffImageFormat,
  sniffImageFormatFromBytes,
  isBrowserDisplayableSniff,
  isUnreadableSniff,
} from '@/utils/imageByteSniff';

const ftypBytes = (brand: string) => {
  const bytes = new Uint8Array(16);
  bytes.set([0x00, 0x00, 0x00, 0x18], 0);
  bytes.set([0x66, 0x74, 0x79, 0x70], 4); // 'ftyp'
  bytes.set(Array.from(brand, (c) => c.charCodeAt(0)), 8);
  return bytes;
};

describe('sniffImageFormatFromBytes', () => {
  it('detects JPEG magic bytes', () => {
    const bytes = new Uint8Array(16);
    bytes.set([0xff, 0xd8, 0xff, 0xe0], 0);
    expect(sniffImageFormatFromBytes(bytes)).toBe('jpeg');
  });

  it('detects HEIC camera files regardless of file name or claimed mime', () => {
    expect(sniffImageFormatFromBytes(ftypBytes('heic'))).toBe('heic');
    expect(sniffImageFormatFromBytes(ftypBytes('mif1'))).toBe('heic');
    expect(sniffImageFormatFromBytes(ftypBytes('avif'))).toBe('avif');
  });

  it('flags empty byte payloads', () => {
    expect(sniffImageFormatFromBytes(new Uint8Array(0))).toBe('empty');
  });

  it('returns unknown for unrecognized containers', () => {
    const bytes = new Uint8Array(16).fill(0x41);
    expect(sniffImageFormatFromBytes(bytes)).toBe('unknown');
  });
});

describe('sniffImageFormat (File)', () => {
  it('sniffs a JPEG file even when its type claims otherwise', async () => {
    const bytes = new Uint8Array(16);
    bytes.set([0xff, 0xd8, 0xff, 0xe0], 0);
    const file = new File([bytes], 'photo.png', { type: 'image/png' });
    await expect(sniffImageFormat(file)).resolves.toBe('jpeg');
  });

  it('reports unreadable when the file bytes cannot be read', async () => {
    const file = new File([new Uint8Array(4)], 'broken.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'slice', {
      value: () => ({
        arrayBuffer: () => Promise.reject(new Error('read failed')),
      }),
    });
    await expect(sniffImageFormat(file)).resolves.toBe('unreadable');
  });
});

describe('sniff helpers', () => {
  it('classifies browser displayability', () => {
    expect(isBrowserDisplayableSniff('jpeg')).toBe(true);
    expect(isBrowserDisplayableSniff('avif')).toBe(true);
    expect(isBrowserDisplayableSniff('heic')).toBe(false);
    expect(isBrowserDisplayableSniff('unknown')).toBe(false);
  });

  it('classifies unreadable states', () => {
    expect(isUnreadableSniff('empty')).toBe(true);
    expect(isUnreadableSniff('unreadable')).toBe(true);
    expect(isUnreadableSniff('jpeg')).toBe(false);
  });
});
