import { buildCollectionRoute, buildDesignRoute, buildProductRoute } from '@/utils/catalogRoutes';

/**
 * The fields of a `/saved/me` row that decide where opening it should land.
 *
 * Kept structural rather than importing the tab's own `SavedItem`, so this
 * stays a pure function the router can be tested against without mounting the
 * profile.
 */
export type SavedItemRouteTarget = {
  targetType: string;
  targetId: string;
  designId?: string;
  productId?: string;
  collectionId?: string;
  legacyCollectionId?: string;
  /** COLLECTION_MEDIA rows: the exact frame that was clipped. */
  mediaId?: string;
  /** COLLECTION rows: the collection's own kind, sent by the API. */
  domain?: string;
  isAvailableInStore?: boolean;
};

/**
 * Where opening a clipped item should land.
 *
 * Every row here is a real destination, which was not true before: a
 * COLLECTION_MEDIA row is one FRAME of a design, so it has to carry
 * `openMedia` or the viewer opens the cover instead of the piece the shopper
 * actually clipped. Returns null only when the row has no id to open at all.
 */
export const routeForSavedItem = (item: SavedItemRouteTarget): string | null => {
  if (item.targetType === 'COLLECTION_MEDIA') {
    const designId = item.collectionId ?? item.designId;
    if (!designId) return null;
    return buildDesignRoute({
      designId,
      legacyCollectionId: item.legacyCollectionId ?? designId,
      query: { openMedia: item.mediaId ?? item.targetId },
    });
  }

  if (item.targetType === 'DESIGN') {
    return buildDesignRoute({
      designId: item.designId ?? item.targetId,
      legacyCollectionId: item.legacyCollectionId ?? item.collectionId,
    });
  }

  if (item.targetType === 'PRODUCT') {
    return buildProductRoute({ productId: item.productId ?? item.targetId });
  }

  if (!item.targetId) return null;

  /*
    A COLLECTION row is a design clip unless the collection says otherwise.

    Clipping a design stores it as a COLLECTION (see
    `mapCatalogTargetForLegacyApi`), so the great majority of rows here are
    designs. Sending them all to `/collections/:id` made `CollectionRouter`
    re-discover that on every open — two probe requests behind a skeleton — and
    then redirect design collections to `/market?openDesign=`, a parameter
    `/market` does not read. The shopper landed on the Market listing.

    `/designs/:id` is the content view, and it accepts the legacy collection id
    these rows carry.
  */
  const isStoreCollection = item.isAvailableInStore === true || item.domain === 'STORE';
  if (isStoreCollection) {
    return buildCollectionRoute({ collectionId: item.targetId });
  }

  return buildDesignRoute({
    designId: item.designId ?? item.targetId,
    legacyCollectionId: item.legacyCollectionId ?? item.collectionId ?? item.targetId,
  });
};

export default routeForSavedItem;
