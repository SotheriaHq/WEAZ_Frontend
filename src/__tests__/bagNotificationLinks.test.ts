import { describe, expect, it } from 'vitest';
import { resolveBagNotificationLinks } from '@/utils/notificationRouting';
import { normalizeNotification } from '@/utils/notificationAdapter';

/**
 * The two nouns in a bag notification are destinations, and the payloads they
 * are derived from are written by THREE different backend emitters with three
 * different shapes:
 *
 *  - `store.service.notifyBuyerBagItemAdded`      → productId + productName
 *  - `collection-bagging.notifyCollectionBagged`  → collectionId + collectionName
 *                                                   (plus productIds/productNames)
 *  - `custom-orders.notifyBuyerCustomOrderBagged` → sourceType/sourceId + productName
 *
 * These cases are built from those payloads, because the failure mode is silent:
 * `brandId` is stripped by the registry's `stripUnknown` if it is ever removed
 * from the Joi schema, and the brand link would simply stop rendering with
 * nothing to indicate why.
 */
const bagNotification = (payload: Record<string, unknown>) =>
  normalizeNotification({
    id: 'n1',
    type: 'BAG_ITEM_ADDED',
    message: "You've successfully bagged something.",
    createdAt: '2026-09-12T02:19:24.000Z',
    isRead: false,
    payload,
  });

describe('resolveBagNotificationLinks', () => {
  it('links a standard bagged product to the product and its brand', () => {
    const links = resolveBagNotificationLinks(
      bagNotification({
        productId: 'product-1',
        productName: 'Linen Wrap Dress',
        brandId: 'brand-1',
        brandName: 'Aso Studio',
      }),
    );

    expect(links.content).toEqual({ to: '/products/product-1', label: 'Linen Wrap Dress' });
    expect(links.brand).toEqual({ to: '/profile/brand-1', label: 'Aso Studio' });
  });

  /*
    The regression this file exists for. The collection payload carries BOTH a
    collection name and a product id array; a title picked independently of the
    link named the collection while opening the first product.
  */
  it('keeps label and destination describing the same thing for a collection', () => {
    const links = resolveBagNotificationLinks(
      bagNotification({
        collectionId: 'collection-1',
        collectionName: 'Harmattan Capsule',
        productIds: ['product-9', 'product-10'],
        productNames: ['Aso Oke Jacket', 'Adire Wrap'],
        brandId: 'brand-2',
        brandName: "Nuel's Cotour",
      }),
    );

    expect(links.content).toEqual({
      to: '/collections/collection-1',
      label: 'Harmattan Capsule',
    });
    expect(links.brand).toEqual({ to: '/profile/brand-2', label: "Nuel's Cotour" });
  });

  it('links a custom order to its source design', () => {
    const links = resolveBagNotificationLinks(
      bagNotification({
        configurationId: 'config-1',
        sourceType: 'DESIGN',
        sourceId: 'design-1',
        productName: 'Grace yel',
        brandId: 'brand-3',
        brandName: 'Danny’s Anime Stuff',
      }),
    );

    expect(links.content?.label).toBe('Grace yel');
    expect(links.content?.to).toContain('design-1');
    expect(links.brand?.to).toBe('/profile/brand-3');
  });

  it('still renders the item when the brand cannot be named', () => {
    // Rows written before `brandId` was carried in the payload.
    const links = resolveBagNotificationLinks(
      bagNotification({
        productId: 'product-2',
        productName: 'Silk Scarf',
        brandName: 'Aso Studio',
      }),
    );

    expect(links.content).toEqual({ to: '/products/product-2', label: 'Silk Scarf' });
    expect(links.brand).toBeNull();
  });

  it('offers nothing to open for a checkout reminder with no ids', () => {
    const reminder = normalizeNotification({
      id: 'n2',
      type: 'BAG_CHECKOUT_REMINDER',
      message: 'You still have 2 items in your bag.',
      createdAt: '2026-09-12T02:19:24.000Z',
      isRead: false,
      payload: { itemCount: 2, topItemTitle: 'Linen Wrap Dress' },
    });

    expect(resolveBagNotificationLinks(reminder)).toEqual({ content: null, brand: null });
  });

  it('ignores notifications that are not about the bag', () => {
    const comment = normalizeNotification({
      id: 'n3',
      type: 'COMMENT',
      message: 'someone commented on your design',
      createdAt: '2026-09-12T02:19:24.000Z',
      isRead: false,
      payload: { productId: 'product-3', productName: 'Not a bag row', brandId: 'brand-4', brandName: 'Brand' },
    });

    expect(resolveBagNotificationLinks(comment)).toEqual({ content: null, brand: null });
  });
});
