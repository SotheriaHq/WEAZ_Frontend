/**
 * Notification Routing - Centralized Navigation Logic
 * 
 * All notification-related routing decisions are made here.
 * This ensures consistent navigation behavior across the app.
 */

import { NotificationRegistry, NotificationTypes } from '@/types/notificationTypes';
import type { NormalizedNotification } from './notificationAdapter';

/**
 * Determine the route for navigating to an actor's profile
 */
export function determineActorRoute(actorId: string): string {
    return `/profile/${actorId}`;
}

/**
 * Determine the route for navigating to notification target content
 * Uses the registry pattern with fallback to legacy targetUrl
 */
export function determineNotificationRoute(notification: NormalizedNotification): string {
    const { type, target, subTargetId, targetUrl, actor, payload } = notification;

    // Fallback URL if nothing else works
    const fallbackUrl = targetUrl || '/settings?tab=notifications';

    // Try registry-based routing first
    const config = NotificationRegistry[type as keyof typeof NotificationRegistry];
    if (config?.routePattern) {
        const targetObj = target ? { type: target.type, id: target.id } : undefined;
        const route = config.routePattern(targetObj, subTargetId || undefined, actor?.id || undefined);
        if (route) return route;
    }

    const payloadCollectionId = typeof payload?.collectionId === 'string' ? payload.collectionId : null;
    const payloadProductId = typeof payload?.productId === 'string' ? payload.productId : null;

    if (target?.type === 'COLLECTION_MEDIA') {
        const collectionId = payloadCollectionId || null;
        if (collectionId) {
            const commentParam = subTargetId ? `&commentId=${subTargetId}` : '';
            return `/market?openDesign=${collectionId}&openMedia=${target.id}${commentParam}`;
        }
        return `/market?openMedia=${target.id}${subTargetId ? `&commentId=${subTargetId}` : ''}`;
    }

    if (target?.type === 'COLLECTION' && (type === NotificationTypes.COMMENT || type === NotificationTypes.THREAD || type === NotificationTypes.COLLECTION_UPLOAD)) {
        const commentParam = subTargetId ? `&commentId=${subTargetId}` : '';
        return `/market?openDesign=${target.id}${commentParam}`;
    }

    if (target?.type === 'PRODUCT') {
        return `/products/${target.id}`;
    }

    if (!target && payloadProductId) {
        return `/products/${payloadProductId}`;
    }

    if (!target && payloadCollectionId && (type === NotificationTypes.COMMENT || type === NotificationTypes.THREAD || type === NotificationTypes.COLLECTION_UPLOAD)) {
        return `/market?openDesign=${payloadCollectionId}${subTargetId ? `&commentId=${subTargetId}` : ''}`;
    }

    // Fallback: type-specific routing for edge cases
    switch (type) {
        case NotificationTypes.THREAD:
            if (target?.type === 'COLLECTION') {
                return `/market?openDesign=${target.id}`;
            }
            if (target?.type === 'POST') {
                return '/market';
            }
            return fallbackUrl;

        case NotificationTypes.COMMENT:
            if (target?.type === 'COLLECTION' && subTargetId) {
                return `/market?openDesign=${target.id}&commentId=${subTargetId}`;
            }
            if (target?.type === 'COLLECTION') {
                return `/market?openDesign=${target.id}`;
            }
            if (target?.type === 'POST' && subTargetId) {
                return '/market';
            }
            return fallbackUrl;

        case NotificationTypes.FOLLOW:
            return actor?.id ? determineActorRoute(actor.id) : fallbackUrl;

        case NotificationTypes.LOGIN:
        case NotificationTypes.LOGOUT:
        case NotificationTypes.LOGOUT_ALL:
        case NotificationTypes.SIGNUP:
            return '/profile';

        case NotificationTypes.PRIVATE_ACCESS_APPROVED:
        case NotificationTypes.CONTRIBUTION_ACCEPTED:
            return target?.id ? `/collections/${target.id}` : fallbackUrl;

        case NotificationTypes.PRIVATE_ACCESS_REQUESTED:
        case NotificationTypes.PRIVATE_ACCESS_REJECTED:
        case NotificationTypes.PRIVATE_ACCESS_REVOKED:
            return actor?.id ? determineActorRoute(actor.id) : fallbackUrl;

        case NotificationTypes.BRAND_PATCH_REQUEST:
        case NotificationTypes.BRAND_PATCH_ACCEPTED:
        case NotificationTypes.BRAND_PATCH_REJECTED:
            return '/settings?tab=patches';

        case NotificationTypes.ORDER_PLACED:
        case NotificationTypes.ORDER_STATUS_UPDATED:
        {
            const orderId = (payload as Record<string, unknown>)?.orderId;
            return orderId ? `/orders/${orderId}` : '/orders';
        }

        case NotificationTypes.PRODUCT_UPLOAD:
            return target?.id ? `/products/${target.id}` : fallbackUrl;

        default:
            return fallbackUrl;
    }
}

/**
 * Check if a notification has a navigable target
 */
export function hasNavigableTarget(notification: NormalizedNotification): boolean {
    const route = determineNotificationRoute(notification);
    return route !== '/settings?tab=notifications';
}

/**
 * Check if clicking the notification should close the dropdown
 * (Most notifications should close, but some might show inline actions)
 */
export function shouldCloseOnClick(_notification: NormalizedNotification): boolean {
    // For now, all notifications close the dropdown
    // Future: access request notifications might have inline approve/reject
    return true;
}

/**
 * Build the hash fragment for deep-linking to comments
 */
export function buildCommentHash(subTargetId: string): string {
    return `#comment-${subTargetId}`;
}

/**
 * Parse a comment ID from a URL hash
 */
export function parseCommentHash(hash: string): string | null {
    const match = hash.match(/^#comment-(.+)$/);
    return match ? match[1] : null;
}
