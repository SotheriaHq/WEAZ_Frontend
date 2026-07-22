/**
 * Notification Routing - Centralized Navigation Logic
 * 
 * All notification-related routing decisions are made here.
 * This ensures consistent navigation behavior across the app.
 */

import { NotificationRegistry, NotificationTypes } from '@/types/notificationTypes';
import type { NormalizedNotification } from './notificationAdapter';
import { buildDesignRoute } from './catalogRoutes';

/**
 * Determine the route for navigating to an actor's profile
 */
export function determineActorRoute(actorId: string): string {
    return `/profile/${actorId}`;
}

/** Content-review lifecycle notifications (brand-owner facing). */
const CONTENT_REVIEW_TYPE_ROUTES = new Set([
    'CONTENT_SUBMITTED_FOR_REVIEW',
    'CONTENT_RESUBMITTED',
    'CONTENT_REVIEW_APPROVED',
    'CONTENT_PUBLISHED',
    'CONTENT_CHANGES_REQUESTED',
    'CONTENT_REVIEW_REJECTED',
    'CONTENT_REVIEW_FAILED',
    'CONTENT_PUBLISH_FAILED',
]);

/**
 * Route content-review notifications by what the user must DO:
 * - changes requested → the EDIT screen with the reviewer-feedback banner
 *   (fix-it flow; data pre-populated).
 * - submitted / approved / rejected → the status TAB where the card lives
 *   (status flow; no action implied).
 */
function determineContentReviewRoute(notification: NormalizedNotification): string | null {
    const { type, target, payload } = notification;
    if (!CONTENT_REVIEW_TYPE_ROUTES.has(type)) return null;
    const p = (payload ?? {}) as Record<string, unknown>;

    const productId =
        (typeof p.productId === 'string' && p.productId) ||
        (target?.type === 'PRODUCT' ? target.id : null) ||
        null;
    const designId =
        (typeof p.designId === 'string' && p.designId) ||
        (typeof p.legacyCollectionId === 'string' && p.legacyCollectionId) ||
        (typeof p.collectionId === 'string' && p.collectionId) ||
        ((target?.type === 'DESIGN' || target?.type === 'COLLECTION') ? target.id : null) ||
        null;
    const isProduct =
        Boolean(productId) ||
        String(p.entityType ?? '').toUpperCase().includes('PRODUCT');

    // Client-side go-live failure: the design is saved as a draft. Route to the
    // Drafts tab and highlight the exact card so the owner lands on the item
    // that needs finishing.
    if (type === 'CONTENT_PUBLISH_FAILED') {
        const params = new URLSearchParams({ tab: 'Content', visibility: 'Drafts' });
        if (designId) params.set('highlightDesign', designId);
        return `/profile?${params.toString()}`;
    }

    if (type === 'CONTENT_CHANGES_REQUESTED') {
        const note =
            typeof p.reasonNote === 'string' && p.reasonNote.trim()
                ? p.reasonNote.trim().slice(0, 500)
                : '';
        const query =
            `review=changes${note ? `&reviewNote=${encodeURIComponent(note)}` : ''}`;
        if (isProduct && productId) {
            return `/studio/store/products/${encodeURIComponent(productId)}/edit?${query}`;
        }
        if (designId) {
            return `${buildDesignRoute({ designId, mode: 'edit' })}?${query}`;
        }
        return isProduct
            ? '/studio/store?status=changes_requested'
            : `/profile?tab=Content&visibility=${encodeURIComponent('Changes Requested')}`;
    }

    if (type === 'CONTENT_REVIEW_REJECTED') {
        return isProduct
            ? '/studio/store?status=rejected'
            : '/profile?tab=Content&visibility=Rejected';
    }

    if (type === 'CONTENT_REVIEW_APPROVED' || type === 'CONTENT_PUBLISHED') {
        return isProduct
            ? '/studio/store?status=active'
            : '/profile?tab=Content&visibility=Public';
    }

    // Submitted / resubmitted / review failed → the In Review tab.
    return isProduct
        ? '/studio/store?status=in_review'
        : `/profile?tab=Content&visibility=${encodeURIComponent('In Review')}`;
}

/**
 * Determine the route for navigating to notification target content
 * Uses the registry pattern with fallback to legacy targetUrl
 */
/**
 * Allowlisted app-relative `target.preview` paths. Only known order/admin
 * surfaces become routes — an unrelated system notification with a
 * non-route relative preview must not navigate somewhere odd.
 */
const PREVIEW_ROUTE_PREFIXES = [
    '/admin/custom-orders/',
    '/admin/orders',
    '/custom-orders/',
    '/orders/',
    '/studio/custom-orders/',
    '/studio/orders/',
] as const;

/**
 * A `target.preview` that is an allowlisted app-relative path (e.g. system
 * notifications carry `/admin/custom-orders/:id` or `/custom-orders/:id`) is a
 * real route. Use it for navigation so order notifications land on the exact
 * screen instead of falling through to notification settings.
 */
export function relativePreviewRoute(preview?: string): string | null {
    if (!preview) return null;
    if (/^https?:\/\//i.test(preview)) return null;
    // Single leading slash only (guards against protocol-relative "//host").
    if (!preview.startsWith('/') || preview.startsWith('//')) return null;
    // Strip query/hash for prefix matching; preserve the full path as the route.
    const pathOnly = preview.split(/[?#]/)[0] || preview;
    const allowed = PREVIEW_ROUTE_PREFIXES.some(
        (prefix) => pathOnly === prefix.replace(/\/$/, '') || pathOnly.startsWith(prefix),
    );
    return allowed ? preview : null;
}

export function determineNotificationRoute(notification: NormalizedNotification): string {
    const { type, target, subTargetId, targetUrl, actor, payload } = notification;

    // Fallback chain: explicit legacy targetUrl → app-relative target preview →
    // notifications settings. The preview step is what routes system order
    // notifications (admin-review, buyer flags) to their exact screen.
    const fallbackUrl =
        targetUrl || relativePreviewRoute(target?.preview) || '/settings?tab=notifications';

    // Content-review lifecycle routes take priority — these previously fell
    // through to the notifications screen (client-reported).
    const contentReviewRoute = determineContentReviewRoute(notification);
    if (contentReviewRoute) return contentReviewRoute;

    // Patch (user↔brand) routing is action-aware and must beat the generic
    // USER-target routePattern below (which would send everyone to the brand
    // profile regardless of who the notification is for).
    if (type === NotificationTypes.PATCH) {
        const action = (payload as Record<string, unknown> | undefined)?.action;
        const brandId = target?.type === 'USER' ? target.id : null;
        if (action === 'USER_PATCH_CONFIRMED' && brandId) {
            // The buyer's own confirmation opens the patched brand's catalog.
            return `/profile/${brandId}`;
        }
        if (action === 'PROFILE_PATCHED' || action === 'PROFILE_UNPATCHED') {
            // Brand-facing patch notification opens the patcher's profile.
            return actor?.id
                ? determineActorRoute(actor.id)
                : brandId
                    ? `/profile/${brandId}`
                    : fallbackUrl;
        }
        // COLLECTION_COLLAB / legacy patch payloads fall through to the registry.
    }

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

    if (target?.type === 'DESIGN') {
        return buildDesignRoute({
            designId: target.id,
            query: subTargetId ? { commentId: subTargetId } : undefined,
        });
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
        case 'BAG_ITEM_ADDED':
        case 'BAG_CHECKOUT_REMINDER':
            return '/bag';

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
            return target?.id ? `/market?openDesign=${target.id}` : fallbackUrl;

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
            return orderId ? `/orders/${orderId}` : fallbackUrl;
        }

        case NotificationTypes.PRODUCT_UPLOAD:
            return target?.id ? `/products/${target.id}` : fallbackUrl;

        case NotificationTypes.MESSAGE_RECEIVED:
        case NotificationTypes.MESSAGE_UNREAD_REMINDER:
        case NotificationTypes.MESSAGE_THREAD_REOPENED:
        case NotificationTypes.MESSAGE_MODERATED:
        {
            if (typeof targetUrl === 'string' && targetUrl.trim().length > 0) {
                return targetUrl;
            }
            const msgPayload = (payload as Record<string, unknown> | undefined) ?? {};
            const msgOrderId = typeof msgPayload.orderId === 'string' ? msgPayload.orderId : null;
            const msgCustomOrderId = typeof msgPayload.customOrderId === 'string' ? msgPayload.customOrderId : null;
            const msgThreadId = typeof msgPayload.threadId === 'string' ? msgPayload.threadId : null;
            if (msgCustomOrderId) {
                return `/messages?customOrderId=${encodeURIComponent(msgCustomOrderId)}`;
            }
            if (msgOrderId) {
                return `/messages?orderId=${encodeURIComponent(msgOrderId)}`;
            }
            if (msgThreadId) {
                return `/messages?thread=${msgThreadId}`;
            }
            return '/messages';
        }

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
