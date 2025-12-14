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
    LIKE: 'LIKE',
    COMMENT: 'COMMENT',
    FOLLOW: 'FOLLOW',
    PATCH: 'PATCH',
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
    COLLECTION_DELETED: 'COLLECTION_DELETED',
} as const;

export type NotificationType = typeof NotificationTypes[keyof typeof NotificationTypes];

// Target types for routing
export type TargetType = 'POST' | 'COLLECTION' | 'COLLECTION_MEDIA' | 'USER' | 'SYSTEM';

// Tracking categories for analytics
export type TrackingCategory = 'engagement' | 'access' | 'security' | 'order' | 'content';

// Registry configuration for each notification type
export interface NotificationTypeConfig {
    actionText: string;
    actionKey: string; // i18n key for future localization
    targetIcon: string;
    routePattern: (target?: { type: string; id: string }, subTargetId?: string, actorId?: string) => string | null;
    defaultAriaAction: string;
    trackingCategory: TrackingCategory;
}

// Single source of truth registry
export const NotificationRegistry: Record<NotificationType, NotificationTypeConfig> = {
    [NotificationTypes.LIKE]: {
        actionText: 'liked your',
        actionKey: 'notification.action.like',
        targetIcon: '❤️',
        routePattern: (t) => t?.type === 'COLLECTION' ? `/collections/${t.id}` : null,
        defaultAriaAction: 'View liked content',
        trackingCategory: 'engagement',
    },
    [NotificationTypes.COMMENT]: {
        actionText: 'commented on your',
        actionKey: 'notification.action.comment',
        targetIcon: '💬',
        routePattern: (t, sub) => t?.type === 'COLLECTION'
            ? `/collections/${t.id}${sub ? `#comment-${sub}` : ''}`
            : null,
        defaultAriaAction: 'View comment',
        trackingCategory: 'engagement',
    },
    [NotificationTypes.FOLLOW]: {
        actionText: 'started following you',
        actionKey: 'notification.action.follow',
        targetIcon: '👤',
        routePattern: (_t, _sub, actorId) => actorId ? `/brands/${actorId}` : null,
        defaultAriaAction: 'View follower profile',
        trackingCategory: 'engagement',
    },
    [NotificationTypes.PATCH]: {
        actionText: 'patched your collection',
        actionKey: 'notification.action.patch',
        targetIcon: '🔧',
        routePattern: (t) => t?.type === 'COLLECTION' ? `/collections/${t.id}` : null,
        defaultAriaAction: 'View patched collection',
        trackingCategory: 'content',
    },
    [NotificationTypes.PRIVATE_ACCESS_REQUESTED]: {
        actionText: 'requested access to',
        actionKey: 'notification.action.access_requested',
        targetIcon: '🔒',
        routePattern: (t) => t?.type === 'COLLECTION' ? `/collections/${t.id}` : null,
        defaultAriaAction: 'View access request',
        trackingCategory: 'access',
    },
    [NotificationTypes.PRIVATE_ACCESS_APPROVED]: {
        actionText: 'approved your access to',
        actionKey: 'notification.action.access_approved',
        targetIcon: '✅',
        routePattern: (t) => t?.type === 'COLLECTION' ? `/collections/${t.id}` : null,
        defaultAriaAction: 'View approved collection',
        trackingCategory: 'access',
    },
    [NotificationTypes.PRIVATE_ACCESS_REJECTED]: {
        actionText: 'rejected your request for',
        actionKey: 'notification.action.access_rejected',
        targetIcon: '❌',
        routePattern: (_t, _sub, actorId) => actorId ? `/brands/${actorId}?tab=private` : null,
        defaultAriaAction: 'View rejection details',
        trackingCategory: 'access',
    },
    [NotificationTypes.PRIVATE_ACCESS_REVOKED]: {
        actionText: 'revoked your access to',
        actionKey: 'notification.action.access_revoked',
        targetIcon: '🚫',
        routePattern: (_t, _sub, actorId) => actorId ? `/brands/${actorId}?tab=private` : null,
        defaultAriaAction: 'View revocation details',
        trackingCategory: 'access',
    },
    [NotificationTypes.BRAND_PATCH_REQUEST]: {
        actionText: 'sent you a patch request',
        actionKey: 'notification.action.patch_request',
        targetIcon: '📬',
        routePattern: () => '/patches',
        defaultAriaAction: 'View patch requests',
        trackingCategory: 'content',
    },
    [NotificationTypes.BRAND_PATCH_ACCEPTED]: {
        actionText: 'accepted your patch request',
        actionKey: 'notification.action.patch_accepted',
        targetIcon: '🎉',
        routePattern: (t) => t?.type === 'COLLECTION' ? `/collections/${t.id}` : '/patches',
        defaultAriaAction: 'View accepted patch',
        trackingCategory: 'content',
    },
    [NotificationTypes.BRAND_PATCH_REJECTED]: {
        actionText: 'rejected your patch request',
        actionKey: 'notification.action.patch_rejected',
        targetIcon: '😞',
        routePattern: () => '/patches',
        defaultAriaAction: 'View rejected patch',
        trackingCategory: 'content',
    },
    [NotificationTypes.CONTRIBUTION_REQUEST]: {
        actionText: 'requested to contribute to',
        actionKey: 'notification.action.contribution_request',
        targetIcon: '🤝',
        routePattern: (t) => t?.type === 'COLLECTION' ? `/collections/${t.id}` : null,
        defaultAriaAction: 'View contribution request',
        trackingCategory: 'content',
    },
    [NotificationTypes.CONTRIBUTION_ACCEPTED]: {
        actionText: 'accepted your contribution',
        actionKey: 'notification.action.contribution_accepted',
        targetIcon: '🎊',
        routePattern: (t) => t?.type === 'COLLECTION' ? `/collections/${t.id}` : null,
        defaultAriaAction: 'View accepted contribution',
        trackingCategory: 'content',
    },
    [NotificationTypes.CONTRIBUTION_REJECTED]: {
        actionText: 'rejected your contribution',
        actionKey: 'notification.action.contribution_rejected',
        targetIcon: '😔',
        routePattern: (t) => t?.type === 'COLLECTION' ? `/collections/${t.id}` : null,
        defaultAriaAction: 'View rejected contribution',
        trackingCategory: 'content',
    },
    [NotificationTypes.LOGIN]: {
        actionText: 'signed in from',
        actionKey: 'notification.action.login',
        targetIcon: '🔐',
        routePattern: () => '/settings',
        defaultAriaAction: 'View security settings',
        trackingCategory: 'security',
    },
    [NotificationTypes.LOGOUT]: {
        actionText: 'signed out from',
        actionKey: 'notification.action.logout',
        targetIcon: '🚪',
        routePattern: () => '/settings',
        defaultAriaAction: 'View security settings',
        trackingCategory: 'security',
    },
    [NotificationTypes.LOGOUT_ALL]: {
        actionText: 'signed out from all devices',
        actionKey: 'notification.action.logout_all',
        targetIcon: '🔒',
        routePattern: () => '/settings',
        defaultAriaAction: 'View security settings',
        trackingCategory: 'security',
    },
    [NotificationTypes.SIGNUP]: {
        actionText: 'Welcome! Account created',
        actionKey: 'notification.action.signup',
        targetIcon: '🎉',
        routePattern: () => '/settings/profile',
        defaultAriaAction: 'View profile settings',
        trackingCategory: 'security',
    },
    [NotificationTypes.ORDER_PLACED]: {
        actionText: 'placed an order',
        actionKey: 'notification.action.order_placed',
        targetIcon: '🛒',
        routePattern: () => '/orders',
        defaultAriaAction: 'View orders',
        trackingCategory: 'order',
    },
    [NotificationTypes.ORDER_STATUS_UPDATED]: {
        actionText: 'order status updated',
        actionKey: 'notification.action.order_updated',
        targetIcon: '📦',
        routePattern: () => '/orders',
        defaultAriaAction: 'View order status',
        trackingCategory: 'order',
    },
    [NotificationTypes.COLLECTION_UPLOAD]: {
        actionText: 'uploaded to your collection',
        actionKey: 'notification.action.collection_upload',
        targetIcon: '📤',
        routePattern: (t) => t?.type === 'COLLECTION' ? `/collections/${t.id}` : null,
        defaultAriaAction: 'View collection',
        trackingCategory: 'content',
    },
    [NotificationTypes.COLLECTION_DELETED]: {
        actionText: 'deleted a collection',
        actionKey: 'notification.action.collection_deleted',
        targetIcon: '🗑️',
        routePattern: () => null,
        defaultAriaAction: 'Notification about deleted collection',
        trackingCategory: 'content',
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
 * Get notification icon for a type
 */
export function getNotificationIcon(type: string): string {
    return NotificationRegistry[type as NotificationType]?.targetIcon ?? '🔔';
}

/**
 * Get tracking category for analytics
 */
export function getTrackingCategory(type: string): TrackingCategory {
    return NotificationRegistry[type as NotificationType]?.trackingCategory ?? 'engagement';
}

/**
 * Get ARIA action description
 */
export function getAriaAction(type: string): string {
    return NotificationRegistry[type as NotificationType]?.defaultAriaAction ?? 'View notification';
}

/**
 * Check if a notification type is valid
 */
export function isValidNotificationType(type: string): type is NotificationType {
    return type in NotificationRegistry;
}
