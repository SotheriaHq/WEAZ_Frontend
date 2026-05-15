/**
 * Notification Type Registry - Single Source of Truth
 *
 * This registry drives all type-dependent logic:
 * - Action text
 * - Icons
 * - Route patterns
 * - ARIA labels
 * - Tracking categories
 */

// Compile-time type safety for notification types
export const NotificationTypes = {
  THREAD: 'THREAD',
  COMMENT: 'COMMENT',
  FOLLOW: 'FOLLOW',
  PATCH: 'PATCH',
  TAG_MENTION: 'TAG_MENTION',
  PRIVATE_ACCESS_REQUESTED: 'PRIVATE_ACCESS_REQUESTED',
  PRIVATE_ACCESS_APPROVED: 'PRIVATE_ACCESS_APPROVED',
  PRIVATE_ACCESS_REJECTED: 'PRIVATE_ACCESS_REJECTED',
  PRIVATE_ACCESS_REVOKED: 'PRIVATE_ACCESS_REVOKED',
  BRAND_PATCH_REQUEST: 'BRAND_PATCH_REQUEST',
  BRAND_PATCH_ACCEPTED: 'BRAND_PATCH_ACCEPTED',
  BRAND_PATCH_REJECTED: 'BRAND_PATCH_REJECTED',
  CONTRIBUTION_REQUEST: 'CONTRIBUTION_REQUEST',
  CONTRIBUTION_ACCEPTED: 'CONTRIBUTION_ACCEPTED',
  CONTRIBUTION_REJECTED: 'CONTRIBUTION_REJECTED',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  LOGOUT_ALL: 'LOGOUT_ALL',
  SIGNUP: 'SIGNUP',
  ORDER_PLACED: 'ORDER_PLACED',
  ORDER_STATUS_UPDATED: 'ORDER_STATUS_UPDATED',
  COLLECTION_UPLOAD: 'COLLECTION_UPLOAD',
  PRODUCT_UPLOAD: 'PRODUCT_UPLOAD',
  COLLECTION_DELETED: 'COLLECTION_DELETED',
  SIZE_FIT_UPDATE_REMINDER: 'SIZE_FIT_UPDATE_REMINDER',
  SIZE_FIT_SHARED: 'SIZE_FIT_SHARED',
  SIZE_FIT_SHARE_REQUEST: 'SIZE_FIT_SHARE_REQUEST',
  SIZE_FIT_SHARE_APPROVED: 'SIZE_FIT_SHARE_APPROVED',
  SIZE_FIT_SHARE_REJECTED: 'SIZE_FIT_SHARE_REJECTED',
  SIZE_FIT_RESHARED: 'SIZE_FIT_RESHARED',
  WISHLIST_PRODUCT_UNAVAILABLE: 'WISHLIST_PRODUCT_UNAVAILABLE',
  WISHLIST_PRODUCT_AVAILABLE: 'WISHLIST_PRODUCT_AVAILABLE',
  CUSTOM_ORDER_PAYMENT_RECEIVED: 'CUSTOM_ORDER_PAYMENT_RECEIVED',
  CUSTOM_ORDER_REVIEW_REQUIRED: 'CUSTOM_ORDER_REVIEW_REQUIRED',
  CUSTOM_ORDER_BRAND_ACCEPTED: 'CUSTOM_ORDER_BRAND_ACCEPTED',
  CUSTOM_ORDER_BRAND_REJECTED: 'CUSTOM_ORDER_BRAND_REJECTED',
  CUSTOM_ORDER_PROGRESS_UPDATED: 'CUSTOM_ORDER_PROGRESS_UPDATED',
  CUSTOM_ORDER_EXTENSION_REQUESTED: 'CUSTOM_ORDER_EXTENSION_REQUESTED',
  CUSTOM_ORDER_EXTENSION_RESOLVED: 'CUSTOM_ORDER_EXTENSION_RESOLVED',
  CUSTOM_ORDER_BUYER_COUNTERED: 'CUSTOM_ORDER_BUYER_COUNTERED',
  CUSTOM_ORDER_BUYER_REJECTED_EXTENSION: 'CUSTOM_ORDER_BUYER_REJECTED_EXTENSION',
  CUSTOM_ORDER_DELIVERED: 'CUSTOM_ORDER_DELIVERED',
  CUSTOM_ORDER_ACCEPTANCE_WINDOW_REMINDER: 'CUSTOM_ORDER_ACCEPTANCE_WINDOW_REMINDER',
  CUSTOM_ORDER_ISSUE_REPORTED: 'CUSTOM_ORDER_ISSUE_REPORTED',
  CUSTOM_ORDER_DISPUTE_CREATED: 'CUSTOM_ORDER_DISPUTE_CREATED',
  CUSTOM_ORDER_STALE_STAGE_WARNING: 'CUSTOM_ORDER_STALE_STAGE_WARNING',
  CUSTOM_ORDER_ADMIN_REVIEW_TRIGGERED: 'CUSTOM_ORDER_ADMIN_REVIEW_TRIGGERED',
  CUSTOM_ORDER_ACCEPTANCE_SLA_RISK: 'CUSTOM_ORDER_ACCEPTANCE_SLA_RISK',
  MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
  MESSAGE_UNREAD_REMINDER: 'MESSAGE_UNREAD_REMINDER',
  MESSAGE_THREAD_REOPENED: 'MESSAGE_THREAD_REOPENED',
  MESSAGE_MODERATED: 'MESSAGE_MODERATED',
} as const;

export type NotificationType =
  typeof NotificationTypes[keyof typeof NotificationTypes];

// Target types for routing
export type TargetType = 'DESIGN' | 'POST' | 'COLLECTION' | 'COLLECTION_MEDIA' | 'PRODUCT' | 'USER' | 'SYSTEM';

// Tracking categories for analytics
export type TrackingCategory =
  | 'engagement'
  | 'access'
  | 'security'
  | 'order'
  | 'content';

export type NotificationIconKey =
  | 'thread'
  | 'comment'
  | 'patch'
  | 'tag'
  | 'heart'
  | 'collab'
  | 'access'
  | 'approved'
  | 'rejected'
  | 'revoked'
  | 'mail'
  | 'celebrate'
  | 'contribution'
  | 'security'
  | 'logout'
  | 'order'
  | 'order_status'
  | 'upload'
  | 'delete'
  | 'fit'
  | 'bell';

// Registry configuration for each notification type
export interface NotificationTypeConfig {
  actionText: string;
  actionKey: string; // i18n key for future localization
  iconKey: NotificationIconKey;
  routePattern: (
    target?: { type: string; id: string },
    subTargetId?: string,
    actorId?: string,
  ) => string | null;
  defaultAriaAction: string;
  trackingCategory: TrackingCategory;
}

// Single source of truth registry
export const NotificationRegistry: Record<
  NotificationType,
  NotificationTypeConfig
> = {
  [NotificationTypes.THREAD]: {
    actionText: 'threaded',
    actionKey: 'notification.action.thread',
    iconKey: 'thread',
    routePattern: (t) =>
        t?.type === 'COLLECTION' ? `/market?openDesign=${t.id}` : null,
    defaultAriaAction: 'View threaded content',
    trackingCategory: 'engagement',
  },
  [NotificationTypes.COMMENT]: {
    actionText: 'commented on',
    actionKey: 'notification.action.comment',
    iconKey: 'comment',
    routePattern: (t, sub) =>
      t?.type === 'COLLECTION'
          ? `/market?openDesign=${t.id}${sub ? `&commentId=${sub}` : ''}`
        : null,
    defaultAriaAction: 'View comment',
    trackingCategory: 'engagement',
  },
  [NotificationTypes.FOLLOW]: {
    actionText: 'patched on your profile',
    actionKey: 'notification.action.patch_profile',
    iconKey: 'patch',
    routePattern: (_t, _sub, actorId) => (actorId ? `/profile/${actorId}` : null),
    defaultAriaAction: 'View patched profile',
    trackingCategory: 'engagement',
  },
  [NotificationTypes.PATCH]: {
    actionText: 'collabed your collection',
    actionKey: 'notification.action.patch',
    iconKey: 'collab',
    routePattern: (t) => {
      if (t?.type === 'COLLECTION') return `/collections/${t.id}`;
      if (t?.type === 'USER') return `/profile/${t.id}`;
      return null;
    },
    defaultAriaAction: 'View collab',
    trackingCategory: 'content',
  },
  [NotificationTypes.TAG_MENTION]: {
    actionText: 'matched your tags',
    actionKey: 'notification.action.tag_mention',
    iconKey: 'tag',
    routePattern: (t) => {
      if (t?.type === 'COLLECTION') return `/collections/${t.id}`;
      if (t?.type === 'PRODUCT') return `/products/${t.id}`;
      if (t?.type === 'USER') return `/profile/${t.id}`;
      return null;
    },
    defaultAriaAction: 'View tagged content',
    trackingCategory: 'engagement',
  },
  [NotificationTypes.PRIVATE_ACCESS_REQUESTED]: {
    actionText: 'requested access to',
    actionKey: 'notification.action.access_requested',
    iconKey: 'access',
    routePattern: (t) =>
      t?.type === 'COLLECTION' ? `/collections/${t.id}` : null,
    defaultAriaAction: 'View access request',
    trackingCategory: 'access',
  },
  [NotificationTypes.PRIVATE_ACCESS_APPROVED]: {
    actionText: 'approved your access to',
    actionKey: 'notification.action.access_approved',
    iconKey: 'approved',
    routePattern: (t) =>
      t?.type === 'COLLECTION' ? `/collections/${t.id}` : null,
    defaultAriaAction: 'View approved collection',
    trackingCategory: 'access',
  },
  [NotificationTypes.PRIVATE_ACCESS_REJECTED]: {
    actionText: 'rejected your request for',
    actionKey: 'notification.action.access_rejected',
    iconKey: 'rejected',
    routePattern: (_t, _sub, actorId) =>
      actorId ? `/profile/${actorId}?tab=private` : null,
    defaultAriaAction: 'View rejection details',
    trackingCategory: 'access',
  },
  [NotificationTypes.PRIVATE_ACCESS_REVOKED]: {
    actionText: 'revoked your access to',
    actionKey: 'notification.action.access_revoked',
    iconKey: 'revoked',
    routePattern: (_t, _sub, actorId) =>
      actorId ? `/profile/${actorId}?tab=private` : null,
    defaultAriaAction: 'View revocation details',
    trackingCategory: 'access',
  },
  [NotificationTypes.BRAND_PATCH_REQUEST]: {
    actionText: 'sent you a patch request',
    actionKey: 'notification.action.patch_request',
    iconKey: 'mail',
    routePattern: () => '/settings?tab=patches',
    defaultAriaAction: 'View patch requests',
    trackingCategory: 'content',
  },
  [NotificationTypes.BRAND_PATCH_ACCEPTED]: {
    actionText: 'accepted your patch request',
    actionKey: 'notification.action.patch_accepted',
    iconKey: 'celebrate',
    routePattern: (t) =>
      t?.type === 'COLLECTION' ? `/collections/${t.id}` : '/settings?tab=patches',
    defaultAriaAction: 'View accepted patch',
    trackingCategory: 'content',
  },
  [NotificationTypes.BRAND_PATCH_REJECTED]: {
    actionText: 'rejected your patch request',
    actionKey: 'notification.action.patch_rejected',
    iconKey: 'rejected',
    routePattern: () => '/settings?tab=patches',
    defaultAriaAction: 'View rejected patch',
    trackingCategory: 'content',
  },
  [NotificationTypes.CONTRIBUTION_REQUEST]: {
    actionText: 'requested to contribute to',
    actionKey: 'notification.action.contribution_request',
    iconKey: 'contribution',
    routePattern: (t) =>
      t?.type === 'COLLECTION' ? `/collections/${t.id}` : null,
    defaultAriaAction: 'View contribution request',
    trackingCategory: 'content',
  },
  [NotificationTypes.CONTRIBUTION_ACCEPTED]: {
    actionText: 'accepted your contribution',
    actionKey: 'notification.action.contribution_accepted',
    iconKey: 'celebrate',
    routePattern: (t) =>
      t?.type === 'COLLECTION' ? `/collections/${t.id}` : null,
    defaultAriaAction: 'View accepted contribution',
    trackingCategory: 'content',
  },
  [NotificationTypes.CONTRIBUTION_REJECTED]: {
    actionText: 'rejected your contribution',
    actionKey: 'notification.action.contribution_rejected',
    iconKey: 'rejected',
    routePattern: (t) =>
      t?.type === 'COLLECTION' ? `/collections/${t.id}` : null,
    defaultAriaAction: 'View rejected contribution',
    trackingCategory: 'content',
  },
  [NotificationTypes.LOGIN]: {
    actionText: 'signed in from',
    actionKey: 'notification.action.login',
    iconKey: 'security',
    routePattern: () => '/profile',
    defaultAriaAction: 'View security settings',
    trackingCategory: 'security',
  },
  [NotificationTypes.LOGOUT]: {
    actionText: 'signed out from',
    actionKey: 'notification.action.logout',
    iconKey: 'logout',
    routePattern: () => '/profile',
    defaultAriaAction: 'View security settings',
    trackingCategory: 'security',
  },
  [NotificationTypes.LOGOUT_ALL]: {
    actionText: 'signed out from all devices',
    actionKey: 'notification.action.logout_all',
    iconKey: 'security',
    routePattern: () => '/profile',
    defaultAriaAction: 'View security settings',
    trackingCategory: 'security',
  },
  [NotificationTypes.SIGNUP]: {
    actionText: 'Welcome! Account created',
    actionKey: 'notification.action.signup',
    iconKey: 'celebrate',
    routePattern: () => '/profile',
    defaultAriaAction: 'View profile settings',
    trackingCategory: 'security',
  },
  [NotificationTypes.ORDER_PLACED]: {
    actionText: 'placed an order',
    actionKey: 'notification.action.order_placed',
    iconKey: 'order',
    routePattern: () => '/orders',
    defaultAriaAction: 'View orders',
    trackingCategory: 'order',
  },
  [NotificationTypes.ORDER_STATUS_UPDATED]: {
    actionText: 'order status updated',
    actionKey: 'notification.action.order_updated',
    iconKey: 'order_status',
    routePattern: () => '/orders',
    defaultAriaAction: 'View order status',
    trackingCategory: 'order',
  },
  [NotificationTypes.COLLECTION_UPLOAD]: {
    actionText: 'uploaded to your collection',
    actionKey: 'notification.action.collection_upload',
    iconKey: 'upload',
    routePattern: (t) =>
      t?.type === 'COLLECTION' ? `/market?openDesign=${t.id}` : null,
    defaultAriaAction: 'View collection',
    trackingCategory: 'content',
  },
  [NotificationTypes.PRODUCT_UPLOAD]: {
    actionText: 'added a new product',
    actionKey: 'notification.action.product_upload',
    iconKey: 'upload',
    routePattern: (t) =>
      t?.type === 'PRODUCT' ? `/products/${t.id}` : null,
    defaultAriaAction: 'View product',
    trackingCategory: 'content',
  },
  [NotificationTypes.COLLECTION_DELETED]: {
    actionText: 'deleted a collection',
    actionKey: 'notification.action.collection_deleted',
    iconKey: 'delete',
    routePattern: () => null,
    defaultAriaAction: 'Notification about deleted collection',
    trackingCategory: 'content',
  },
  [NotificationTypes.SIZE_FIT_UPDATE_REMINDER]: {
    actionText: 'size fit update reminder',
    actionKey: 'notification.action.size_fit_reminder',
    iconKey: 'fit',
    routePattern: () => '/profile',
    defaultAriaAction: 'Update your size fitting profile',
    trackingCategory: 'order',
  },
  [NotificationTypes.SIZE_FIT_SHARED]: {
    actionText: 'shared size fittings with you',
    actionKey: 'notification.action.size_fit_shared',
    iconKey: 'fit',
    routePattern: (_t, _sub, actorId) => (actorId ? `/profile/${actorId}` : '/profile'),
    defaultAriaAction: 'View shared size fitting profile',
    trackingCategory: 'order',
  },
  [NotificationTypes.SIZE_FIT_SHARE_REQUEST]: {
    actionText: 'requested size-fit sharing permission',
    actionKey: 'notification.action.size_fit_share_request',
    iconKey: 'fit',
    routePattern: () => '/profile',
    defaultAriaAction: 'Review size-fit share request',
    trackingCategory: 'order',
  },
  [NotificationTypes.SIZE_FIT_SHARE_APPROVED]: {
    actionText: 'approved your size-fit share request',
    actionKey: 'notification.action.size_fit_share_approved',
    iconKey: 'approved',
    routePattern: () => '/profile',
    defaultAriaAction: 'Open size-fit profile',
    trackingCategory: 'order',
  },
  [NotificationTypes.SIZE_FIT_SHARE_REJECTED]: {
    actionText: 'rejected your size-fit share request',
    actionKey: 'notification.action.size_fit_share_rejected',
    iconKey: 'rejected',
    routePattern: () => '/profile',
    defaultAriaAction: 'View size-fit sharing status',
    trackingCategory: 'order',
  },
  [NotificationTypes.SIZE_FIT_RESHARED]: {
    actionText: 'reshared your size-fit profile',
    actionKey: 'notification.action.size_fit_reshared',
    iconKey: 'fit',
    routePattern: () => '/profile',
    defaultAriaAction: 'View reshare activity',
    trackingCategory: 'order',
  },
  [NotificationTypes.WISHLIST_PRODUCT_UNAVAILABLE]: {
    actionText: 'A product on your wishlist is currently unavailable',
    actionKey: 'notification.action.wishlist_product_unavailable',
    iconKey: 'heart',
    routePattern: () => '/profile?tab=Store',
    defaultAriaAction: 'View wishlist',
    trackingCategory: 'engagement',
  },
  [NotificationTypes.WISHLIST_PRODUCT_AVAILABLE]: {
    actionText: 'A product on your wishlist is available again',
    actionKey: 'notification.action.wishlist_product_available',
    iconKey: 'heart',
    routePattern: () => '/profile?tab=Store',
    defaultAriaAction: 'View wishlist',
    trackingCategory: 'engagement',
  },
  [NotificationTypes.CUSTOM_ORDER_PAYMENT_RECEIVED]: {
    actionText: 'payment received for your custom order',
    actionKey: 'notification.action.custom_order_payment_received',
    iconKey: 'order',
    routePattern: () => null,
    defaultAriaAction: 'Open custom order',
    trackingCategory: 'order',
  },
  [NotificationTypes.CUSTOM_ORDER_REVIEW_REQUIRED]: {
    actionText: 'has a new custom order awaiting review',
    actionKey: 'notification.action.custom_order_review_required',
    iconKey: 'order_status',
    routePattern: () => null,
    defaultAriaAction: 'Open custom order',
    trackingCategory: 'order',
  },
  [NotificationTypes.CUSTOM_ORDER_BRAND_ACCEPTED]: {
    actionText: 'accepted your custom order',
    actionKey: 'notification.action.custom_order_brand_accepted',
    iconKey: 'approved',
    routePattern: () => null,
    defaultAriaAction: 'Open custom order',
    trackingCategory: 'order',
  },
  [NotificationTypes.CUSTOM_ORDER_BRAND_REJECTED]: {
    actionText: 'rejected your custom order',
    actionKey: 'notification.action.custom_order_brand_rejected',
    iconKey: 'rejected',
    routePattern: () => null,
    defaultAriaAction: 'Open custom order',
    trackingCategory: 'order',
  },
  [NotificationTypes.CUSTOM_ORDER_PROGRESS_UPDATED]: {
    actionText: 'updated your custom order',
    actionKey: 'notification.action.custom_order_progress_updated',
    iconKey: 'order_status',
    routePattern: () => null,
    defaultAriaAction: 'Open custom order',
    trackingCategory: 'order',
  },
  [NotificationTypes.CUSTOM_ORDER_EXTENSION_REQUESTED]: {
    actionText: 'requested a custom-order extension',
    actionKey: 'notification.action.custom_order_extension_requested',
    iconKey: 'mail',
    routePattern: () => null,
    defaultAriaAction: 'Open custom order',
    trackingCategory: 'order',
  },
  [NotificationTypes.CUSTOM_ORDER_EXTENSION_RESOLVED]: {
    actionText: 'resolved a custom-order extension',
    actionKey: 'notification.action.custom_order_extension_resolved',
    iconKey: 'approved',
    routePattern: () => null,
    defaultAriaAction: 'Open custom order',
    trackingCategory: 'order',
  },
  [NotificationTypes.CUSTOM_ORDER_BUYER_COUNTERED]: {
    actionText: 'countered a custom-order extension',
    actionKey: 'notification.action.custom_order_buyer_countered',
    iconKey: 'mail',
    routePattern: () => null,
    defaultAriaAction: 'Open custom order',
    trackingCategory: 'order',
  },
  [NotificationTypes.CUSTOM_ORDER_BUYER_REJECTED_EXTENSION]: {
    actionText: 'rejected a custom-order extension',
    actionKey: 'notification.action.custom_order_buyer_rejected_extension',
    iconKey: 'rejected',
    routePattern: () => null,
    defaultAriaAction: 'Open custom order',
    trackingCategory: 'order',
  },
  [NotificationTypes.CUSTOM_ORDER_DELIVERED]: {
    actionText: 'marked a custom order as delivered',
    actionKey: 'notification.action.custom_order_delivered',
    iconKey: 'order_status',
    routePattern: () => null,
    defaultAriaAction: 'Open custom order',
    trackingCategory: 'order',
  },
  [NotificationTypes.CUSTOM_ORDER_ACCEPTANCE_WINDOW_REMINDER]: {
    actionText: 'sent a buyer-acceptance reminder',
    actionKey: 'notification.action.custom_order_acceptance_window_reminder',
    iconKey: 'order_status',
    routePattern: () => null,
    defaultAriaAction: 'Open custom order',
    trackingCategory: 'order',
  },
  [NotificationTypes.CUSTOM_ORDER_ISSUE_REPORTED]: {
    actionText: 'reported an issue on a custom order',
    actionKey: 'notification.action.custom_order_issue_reported',
    iconKey: 'security',
    routePattern: () => null,
    defaultAriaAction: 'Open custom order',
    trackingCategory: 'order',
  },
  [NotificationTypes.CUSTOM_ORDER_DISPUTE_CREATED]: {
    actionText: 'opened a custom-order dispute',
    actionKey: 'notification.action.custom_order_dispute_created',
    iconKey: 'security',
    routePattern: () => null,
    defaultAriaAction: 'Open custom order',
    trackingCategory: 'order',
  },
  [NotificationTypes.CUSTOM_ORDER_STALE_STAGE_WARNING]: {
    actionText: 'has a stale custom-order stage',
    actionKey: 'notification.action.custom_order_stale_stage_warning',
    iconKey: 'order_status',
    routePattern: () => null,
    defaultAriaAction: 'Open custom order',
    trackingCategory: 'order',
  },
  [NotificationTypes.CUSTOM_ORDER_ADMIN_REVIEW_TRIGGERED]: {
    actionText: 'triggered custom-order admin review',
    actionKey: 'notification.action.custom_order_admin_review_triggered',
    iconKey: 'security',
    routePattern: () => null,
    defaultAriaAction: 'Open custom order',
    trackingCategory: 'order',
  },
  [NotificationTypes.CUSTOM_ORDER_ACCEPTANCE_SLA_RISK]: {
    actionText: 'flagged a custom-order SLA risk',
    actionKey: 'notification.action.custom_order_acceptance_sla_risk',
    iconKey: 'order_status',
    routePattern: () => null,
    defaultAriaAction: 'Open custom order',
    trackingCategory: 'order',
  },
  [NotificationTypes.MESSAGE_RECEIVED]: {
    actionText: 'sent a new message',
    actionKey: 'notification.action.message_received',
    iconKey: 'mail',
    routePattern: () => null,
    defaultAriaAction: 'Open order message thread',
    trackingCategory: 'order',
  },
  [NotificationTypes.MESSAGE_UNREAD_REMINDER]: {
    actionText: 'you have unread order messages',
    actionKey: 'notification.action.message_unread_reminder',
    iconKey: 'mail',
    routePattern: () => null,
    defaultAriaAction: 'Open unread order message thread',
    trackingCategory: 'order',
  },
  [NotificationTypes.MESSAGE_THREAD_REOPENED]: {
    actionText: 'an order thread was reopened',
    actionKey: 'notification.action.message_thread_reopened',
    iconKey: 'order_status',
    routePattern: () => null,
    defaultAriaAction: 'Open reopened order thread',
    trackingCategory: 'order',
  },
  [NotificationTypes.MESSAGE_MODERATED]: {
    actionText: 'a message was moderated',
    actionKey: 'notification.action.message_moderated',
    iconKey: 'security',
    routePattern: () => null,
    defaultAriaAction: 'Review moderated message notice',
    trackingCategory: 'security',
  },
};

// Helper functions driven by registry

/**
 * Get action text for a notification type
 */
export function getActionText(type: string): string {
  return NotificationRegistry[type as NotificationType]?.actionText ?? '';
}

/**
 * Get notification icon key for a type
 */
export function getNotificationIcon(type: string): NotificationIconKey {
  return NotificationRegistry[type as NotificationType]?.iconKey ?? 'bell';
}

/**
 * Get tracking category for analytics
 */
export function getTrackingCategory(type: string): TrackingCategory {
  return (
    NotificationRegistry[type as NotificationType]?.trackingCategory ??
    'engagement'
  );
}

/**
 * Get ARIA action description
 */
export function getAriaAction(type: string): string {
  return (
    NotificationRegistry[type as NotificationType]?.defaultAriaAction ??
    'View notification'
  );
}

/**
 * Check if a notification type is valid
 */
export function isValidNotificationType(type: string): type is NotificationType {
  return type in NotificationRegistry;
}
