export const PRODUCT_STUDIO_SYNC_EVENT = 'threadly:studio-product-sync';

export const emitProductStudioSync = (detail?: {
  productId?: string;
  reason?: string;
}) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(PRODUCT_STUDIO_SYNC_EVENT, {
      detail: {
        ...detail,
        timestamp: Date.now(),
      },
    }),
  );
};
