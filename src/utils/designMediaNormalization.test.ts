import { describe, expect, it } from 'vitest';
import { normalizeDesignMediaResponse } from './designMediaNormalization';

describe('normalizeDesignMediaResponse', () => {
  it('normalizes legacy medias with fileUploadId and file urls', () => {
    const result = normalizeDesignMediaResponse({
      medias: [
        {
          id: 'media-1',
          fileUploadId: 'file-1',
          type: 'IMAGE',
          file: { s3Url: 'https://cdn.test/front.jpg' },
        },
      ],
    });

    expect(result).toEqual([
      {
        id: 'media-1',
        remoteId: 'media-1',
        fileId: 'file-1',
        previewUrl: 'https://cdn.test/front.jpg',
        kind: 'image',
      },
    ]);
  });

  it('normalizes alternate media arrays with direct video urls', () => {
    const result = normalizeDesignMediaResponse({
      media: [
        {
          mediaId: 'media-2',
          fileId: 'file-2',
          url: 'https://cdn.test/look.mp4',
          kind: 'VIDEO',
        },
      ],
    });

    expect(result[0]).toMatchObject({
      id: 'media-2',
      remoteId: 'media-2',
      fileId: 'file-2',
      previewUrl: 'https://cdn.test/look.mp4',
      kind: 'video',
    });
  });

  it('keeps rows that need signed-url resolution by file id', () => {
    const result = normalizeDesignMediaResponse({
      images: [{ file: { id: 'file-3', fileType: 'image/jpeg' } }],
    });

    expect(result).toEqual([
      {
        id: 'file-3',
        remoteId: undefined,
        fileId: 'file-3',
        previewUrl: undefined,
        kind: 'image',
      },
    ]);
  });
});
