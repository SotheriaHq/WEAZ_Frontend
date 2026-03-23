import { describe, expect, it } from "vitest";

import {
  normalizePrimary,
  reorderItems,
  setPrimary,
  validateMedia,
} from "@/pages/studio/products/mediaUtils";

describe("validateMedia", () => {
  it("auto-selects first image as cover when none set", () => {
    const items = normalizePrimary([{ id: "a" }, { id: "b" }]);
    expect(items[0].isPrimary).toBe(true);
    expect(items[1].isPrimary).toBe(false);
  });

  it("allows empty media for in-progress drafts", () => {
    expect(validateMedia([], 6, 4)).toEqual({ ok: true });
  });

  it("requires four images when uploads exist", () => {
    expect(
      validateMedia(
        [
          { id: "front", isPrimary: true },
          { id: "left" },
          { id: "right" },
        ],
        6,
        4,
      ),
    ).toEqual({
      ok: false,
      error: "Upload at least 4 images: front, left, right, and back",
    });
  });

  it("still requires a chosen cover image", () => {
    expect(
      validateMedia(
        [
          { id: "front" },
          { id: "left" },
          { id: "right" },
          { id: "back" },
        ],
        6,
        4,
      ),
    ).toEqual({
      ok: false,
      error: "Please choose a cover image",
    });
  });

  it("accepts a complete four-view set with a primary image", () => {
    expect(
      validateMedia(
        [
          { id: "front", isPrimary: true },
          { id: "left" },
          { id: "right" },
          { id: "back" },
        ],
        6,
        4,
      ),
    ).toEqual({ ok: true });
  });

  it("enforces max image count", () => {
    expect(
      validateMedia(
        [
          { id: "1", isPrimary: true },
          { id: "2" },
          { id: "3" },
          { id: "4" },
          { id: "5" },
          { id: "6" },
          { id: "7" },
        ],
        6,
        4,
      ),
    ).toEqual({
      ok: false,
      error: "You can upload up to 6 images",
    });
  });

  it("keeps the chosen cover when items are reordered", () => {
    const items = setPrimary([{ id: "a" }, { id: "b" }, { id: "c" }], "b");
    const reordered = reorderItems(items, 1, 0);
    expect(reordered[0].id).toBe("b");
    expect(reordered[0].isPrimary).toBe(true);
  });
});
