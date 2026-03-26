export type OrderNavigationContext = 'STANDARD_ORDER' | 'CUSTOM_ORDER' | 'INQUIRY';
export type OrderNavigationSurface = 'BUYER' | 'BRAND' | 'ADMIN';

interface BuildOrderRouteOptions {
  surface: OrderNavigationSurface;
  contextType: OrderNavigationContext;
  orderId?: string | null;
  customOrderId?: string | null;
  openChat?: boolean;
  messageId?: string | null;
}

export const buildOrderRoute = ({
  surface,
  contextType,
  orderId,
  customOrderId,
  openChat = false,
  messageId,
}: BuildOrderRouteOptions): string | null => {
  if (contextType === 'INQUIRY') {
    return null;
  }

  if (contextType === 'CUSTOM_ORDER') {
    if (!customOrderId) {
      return null;
    }

    if (surface === 'BRAND') {
      const params = new URLSearchParams({
        tab: 'orders',
        orderTab: 'custom',
        customOrderId,
      });

      if (openChat) {
        params.set('openChat', '1');
      }

      if (messageId) {
        params.set('messageId', messageId);
      }

      return `/studio?${params.toString()}`;
    }

    if (surface === 'ADMIN') {
      return `/admin/custom-orders/${encodeURIComponent(customOrderId)}`;
    }

    return `/custom-orders/${encodeURIComponent(customOrderId)}`;
  }

  if (!orderId) {
    return null;
  }

  if (surface === 'BRAND') {
    const params = new URLSearchParams({
      tab: 'orders',
      orderId,
    });

    if (openChat) {
      params.set('openChat', '1');
    }

    if (messageId) {
      params.set('messageId', messageId);
    }

    return `/studio?${params.toString()}`;
  }

  if (surface === 'ADMIN') {
    return null;
  }

  return `/orders/${encodeURIComponent(orderId)}`;
};
