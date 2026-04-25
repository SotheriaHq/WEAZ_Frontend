import { describe, expect, it } from "vitest";

import {
  getRenderableProductMediaSources,
  toRenderableMediaSource,
} from "@/utils/renderableMedia";

describe("renderableMedia", () => {
  it("treats non-remote values as file ids", () => {
    expect(toRenderableMediaSource("file_123")).toEqual({
      src: null,
      fileId: "file_123",
    });
  });

  it("keeps primary product media first for collection covers", () => {
    const sources = getRenderableProductMediaSources({
      thumbnail: "https://cdn.example.com/thumb.jpg",
      media: [
        { id: "file-left", url: "https://cdn.example.com/left.jpg" },
        { id: "file-front", url: "file-front", isPrimary: true },
      ],
      mediaIds: ["file-front", "file-left", "file-back"],
      images: ["https://cdn.example.com/detail.jpg"],
    });

    expect(sources[0]).toEqual({
      src: null,
      fileId: "file-front",
    });
    expect(sources).toContainEqual({
      src: "https://cdn.example.com/thumb.jpg",
      fileId: null,
    });
    expect(sources).toContainEqual({
      src: null,
      fileId: "file-back",
    });
  });
});
