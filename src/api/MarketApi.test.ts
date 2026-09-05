import { describe, expect, it } from 'vitest';
import { toMarketItem } from './MarketApi';

describe('toMarketItem', () => {
  it('uses primaryMedia preview and aspect metadata for masonry cards', () => {
    const item = toMarketItem({
      id: 'design-media-1',
      collectionId: 'collection-1',
      collectionTitle: 'Silhouette',
      brandId: 'brand-1',
      brandName: 'Hover Covers',
      primaryMedia: {
        fileId: 'file-1',
        displayUrl: 'https://cdn.wiez.test/file-1-detail.webp',
        previewUrl: 'https://cdn.wiez.test/file-1-card.webp',
        type: 'POST_IMAGE',
        width: 900,
        height: 1200,
        aspectRatio: 0.75,
      },
      mediaUrl: 'https://cdn.wiez.test/file-1-original.jpg',
    });

    expect(item.media.fileId).toBe('file-1');
    expect(item.media.url).toBe('https://cdn.wiez.test/file-1-detail.webp');
    expect(item.media.previewUrl).toBe('https://cdn.wiez.test/file-1-card.webp');
    expect(item.media.width).toBe(900);
    expect(item.media.height).toBe(1200);
    expect(item.media.aspectRatio).toBe(0.75);
  });
});
