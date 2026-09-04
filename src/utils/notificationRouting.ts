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

/**
 * The notification types whose destination is an order message thread.
 *
 * Every one of these declares `threadId` in its backend payload schema, so a
 * type added to this set without one routes nowhere and falls through the chain
 * exactly as before — safe by construction.
 */
const MESSAGE_NOTIFICATION_TYPES = new Set<string>([
    NotificationTypes.MESSAGE_RECEIVED,
    NotificationTypes.MESSAGE_UNREAD_REMINDER,
    NotificationTypes.MESSAGE_THREAD_REOPENED,
    NotificationTypes.MESSAGE_MODERATED,
]);

/**
 * Where a message notification goes. **Always somewhere in messaging.**
 *
 * This returns a route unconditionally, and that is the whole point. The
 * previous version returned null when it could not find a thread id, which
 * dropped the caller into the shared fallback chain and ended at
 * `/settings?tab=notifications` — the screen the reader had just tapped FROM.
 *
 * `MESSAGE_UNREAD_REMINDER` ("You have unread order messages waiting") is a
 * DIGEST. It is about several threads at once, so it carries no `threadId` and
 * never will, which made it hit that hole every single time. A notification
 * about unread messages must land in the inbox even when it cannot say which
 * message — the reader can take it from there, and the one place that is
 * certainly wrong is the settings page.
 */
/**
 * Every route that counts as "inside messaging".
 *
 * Used to decide whether a stored `targetUrl` on a message notification can be
 * trusted. `/admin/custom-orders/:id#messages` is here because that is the
 * admin-side messaging deep link — it opens the thread, on the screen an
 * operator reads threads from.
 */
const MESSAGING_ROUTE_PREFIXES = [
    '/messages',
    '/studio/messages',
    '/admin/messaging',
    '/admin/custom-orders',
];

const isMessagingRoute = (route: string): boolean => {
    /*
      The brand order chat is a messaging destination that does not look like
      one. `/studio?tab=orders&orderId=…&openChat=1` opens the order with its
      chat panel already open, which is where a brand reads an order thread —
      and `openChat=1` is exactly what distinguishes it from a plain link to the
      orders tab. Without this a brand's message notification would be sent to
      the generic studio inbox instead of the conversation it names. Found by
      the backend contract test, not by reading this function.
    */
    if (route.startsWith('/studio?tab=orders') && route.includes('openChat=1')) {
        return true;
    }
    return MESSAGING_ROUTE_PREFIXES.some(
        (prefix) =>
            route === prefix ||
            route.startsWith(`${prefix}?`) ||
            route.startsWith(`${prefix}/`) ||
            route.startsWith(`${prefix}#`),
    );
};

function buildMessageRoute(payload: Record<string, unknown> | undefined): string {
    // `MessagingManagementPage` reads exactly one param, `threadId`, so these
    // are the only two keys worth looking for. The other identifiers native
    // resolves from (messageId, orderId, customOrderId) have no web resolver
    // to hand them to, and inventing one to open a thread we may not have
    // matched correctly is worse than opening the inbox.
    const threadId =
        typeof payload?.threadId === 'string' && payload.threadId.trim()
            ? payload.threadId.trim()
            : typeof payload?.conversationId === 'string' && payload.conversationId.trim()
                ? payload.conversationId.trim()
                : null;

    /*
      A brand reads the same threads inside Studio, and sending them to the
      shopper inbox would drop them out of the console they were working in.
      `brandId` is only set on the brand-facing copy of the notification.
    */
    const isBrandSide = typeof payload?.brandId === 'string' && payload.brandId.trim().length > 0;
    const base = isBrandSide ? '/studio/messages' : '/messages';
    return threadId ? `${base}?threadId=${encodeURIComponent(threadId)}` : base;
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

    /*
      Message notifications open the THREAD.

      All five message types carry `threadId` in their payload — the backend
      registry makes it a required field — and all five had
      `routePattern: () => null` in `NotificationRegistry`, so every one of them
      fell through the chain to `/settings?tab=notifications`. Tapping "You have
      unread order messages waiting" landed on the notifications screen, which is
      the screen the reader just came FROM.

      It has to be handled here rather than in the registry because
      `routePattern` is only handed `(target, subTargetId, actorId)` — it never
      sees the payload, and the thread id lives nowhere else. `MessagingManagementPage`
      already reads `?threadId=`, so the deep link has always worked; nothing
      ever produced it.
    */
    // Returns unconditionally — a message notification never falls through to
    // the generic chain, because the end of that chain is the settings page.
    if (MESSAGE_NOTIFICATION_TYPES.has(type)) {
        return buildMessageRoute(payload as Record<string, unknown> | undefined);
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
                return '/runway';
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
                return '/runway';
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

/**
 * Where a click on a notification body should land, including the brand-aware
 * overrides (studio order/message deep links) and the admin-console rewrite.
 *
 * Extracted from `NotificationsDropdown` so the dropdown and the full-page
 * /notifications list cannot drift apart. Tapping the same notification has to
 * go to the same place whether the user is on a phone or a desktop — and the
 * brand overrides below are exactly the ones that route a content-review
 * change-request to the screen where the brand can act on it.
 */
export function resolveNotificationClickRoute(
    notification: NormalizedNotification,
    context: { isBrand: boolean; isAdminConsoleUser: boolean },
): string {
    const payload = (notification.payload as Record<string, unknown> | undefined) ?? {};
    const payloadTargetUrl = typeof payload.targetUrl === 'string' ? payload.targetUrl : null;
    const explicitTargetUrl =
        typeof notification.targetUrl === 'string' ? notification.targetUrl : null;
    const exactTargetUrl = payloadTargetUrl || explicitTargetUrl;
    const payloadOrderId = typeof payload.orderId === 'string' ? payload.orderId : null;
    const payloadCustomOrderId =
        typeof payload.customOrderId === 'string' ? payload.customOrderId : null;

    const isOrderNotification =
        notification.type === NotificationTypes.ORDER_PLACED ||
        notification.type === NotificationTypes.ORDER_STATUS_UPDATED;
    const isMessageNotification =
        notification.type === NotificationTypes.MESSAGE_RECEIVED ||
        notification.type === NotificationTypes.MESSAGE_UNREAD_REMINDER ||
        notification.type === NotificationTypes.MESSAGE_THREAD_REOPENED ||
        notification.type === NotificationTypes.MESSAGE_MODERATED;

    /*
      A stored targetUrl does NOT get to take a message notification out of
      messaging.

      This is the half that was missing, and it is why this bug was reported
      fixed and then reported again. `determineNotificationRoute` below handles
      the message types correctly — but it is only reached when there is no
      targetUrl, and the server writes one into the payload of every message
      notification. When the thread had no order, custom order or thread id to
      point at, `resolveThreadTargetUrl` returned the literal string
      '/settings?tab=notifications', which was stored and then obeyed here. The
      reader tapped "You have unread order messages waiting" and arrived at the
      notifications settings screen — the screen they had just tapped from.

      The server no longer writes that, but rows written before the fix are
      still sitting unread in people's inboxes, dated weeks back. This check is
      what makes those rows work: for a message notification, a targetUrl that
      does not lead into messaging is discarded and the type-based routing
      decides instead. Anything already inside messaging is honoured exactly,
      because that is where the thread id lives.
    */
    const usableTargetUrl =
        exactTargetUrl && (!isMessageNotification || isMessagingRoute(exactTargetUrl))
            ? exactTargetUrl
            : null;

    let route: string;
    if (usableTargetUrl) {
        route = usableTargetUrl;
    } else if (context.isBrand && isOrderNotification && payloadOrderId) {
        route = `/studio?tab=orders&orderId=${encodeURIComponent(payloadOrderId)}`;
    } else if (context.isBrand && isMessageNotification && payloadCustomOrderId) {
        route = `/studio/messages?customOrderId=${encodeURIComponent(payloadCustomOrderId)}`;
    } else if (context.isBrand && isMessageNotification && payloadOrderId) {
        route = `/studio/messages?orderId=${encodeURIComponent(payloadOrderId)}`;
    } else {
        route = determineNotificationRoute(notification);
    }

    return context.isAdminConsoleUser && route.startsWith('/profile') ? '/admin' : route;
}
