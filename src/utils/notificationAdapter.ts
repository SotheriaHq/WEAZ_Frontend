/**
 * Notification Adapter - Backward Compatibility Layer
 * 
 * This adapter normalizes notification data from any version (legacy or structured)
 * into a consistent format for the frontend.
 */

import type { TargetType } from '@/types/notificationTypes';

// Version constants for schema evolution
export const NOTIFICATION_VERSION = {
    LEGACY: 1,
    STRUCTURED: 2,
} as const;

export type NotificationVersion = typeof NOTIFICATION_VERSION[keyof typeof NOTIFICATION_VERSION];

// Actor interface
export interface NotificationActor {
    id: string | null;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImage: string | null;
}

// Target interface
export interface NotificationTarget {
    type: TargetType;
    id: string;
    preview?: string;
}

// Normalized notification interface
export interface NormalizedNotification {
    id: string;
    type: string;
    version: NotificationVersion;
    message: string;
    createdAt: string;
    isRead: boolean;
    actor: NotificationActor | null;
    target: NotificationTarget | null;
    subTargetId: string | null;
    targetUrl: string | null;
    payload?: Record<string, unknown>;
}

/**
 * Normalizes notification data to ensure backward compatibility.
 * Safely derives target from legacy `message` or `targetUrl` when structured data is missing.
 */
export function normalizeNotification(raw: Record<string, unknown>): NormalizedNotification {
    // Explicit versioning - v1 = legacy, v2 = structured
    const version: NotificationVersion = (raw.version as NotificationVersion) ?? NOTIFICATION_VERSION.LEGACY;

    // Extract payload safely
    const payload = raw.payload as Record<string, unknown> | undefined;

    return {
        id: raw.id as string,
        type: (raw.type as string) || 'UNKNOWN',
        version,
        message: (raw.message as string) || 'You have a notification',
        createdAt: (raw.createdAt as string) || new Date().toISOString(),
        isRead: Boolean(raw.isRead),

        // Actor normalization - handle missing actor gracefully
        actor: normalizeActor(raw.actor as Record<string, unknown> | null | undefined),

        // Target normalization - derive from payload or legacy fields
        // For v2+, trust structured data; for v1, infer from legacy
        target: version >= 2
            ? extractTarget(raw.target as Record<string, unknown> | null, payload)
            : deriveTarget(raw, payload),

        subTargetId: extractSubTargetId(payload),

        // Preserve legacy fields for fallback routing
        targetUrl: extractTargetUrl(raw, payload),
        payload,
    };
}

/**
 * Normalize actor data
 */
function normalizeActor(actor: Record<string, unknown> | null | undefined): NotificationActor | null {
    if (!actor) return null;

    return {
        id: (actor.id as string) || null,
        username: (actor.username as string) || null,
        firstName: (actor.firstName as string) || null,
        lastName: (actor.lastName as string) || null,
        profileImage: (actor.profileImage as string) || null,
    };
}

/**
 * Extract target from structured data
 */
function extractTarget(
    target: Record<string, unknown> | null | undefined,
    payload: Record<string, unknown> | undefined
): NotificationTarget | null {
    // Try direct target first
    if (target?.type && target?.id) {
        return {
            type: target.type as TargetType,
            id: target.id as string,
            preview: target.preview as string | undefined,
        };
    }

    // Try from payload
    const payloadTarget = payload?.target as Record<string, unknown> | undefined;
    if (payloadTarget?.type && payloadTarget?.id) {
        return {
            type: payloadTarget.type as TargetType,
            id: payloadTarget.id as string,
            preview: payloadTarget.preview as string | undefined,
        };
    }

    return null;
}

/**
 * Derive target from legacy notification data
 */
function deriveTarget(
    raw: Record<string, unknown>,
    payload: Record<string, unknown> | undefined
): NotificationTarget | null {
    // Use structured target if available
    const target = extractTarget(raw.target as Record<string, unknown> | null, payload);
    if (target) return target;

    // Derive from legacy payload fields
    if (payload?.collectionId) {
        return { type: 'COLLECTION', id: payload.collectionId as string };
    }
    if (payload?.postId) {
        return { type: 'POST', id: payload.postId as string };
    }

    // Parse from targetUrl as last resort
    const url = (raw.targetUrl as string) || (payload?.targetUrl as string);
    if (url) {
        const collectionMatch = url.match(/\/collections\/([a-f0-9-]+)/);
        if (collectionMatch) {
            return { type: 'COLLECTION', id: collectionMatch[1] };
        }
        const brandsMatch = url.match(/\/brands\/([a-f0-9-]+)/);
        if (brandsMatch) {
            return { type: 'USER', id: brandsMatch[1] };
        }
    }

    return null;
}

/**
 * Extract sub-target ID for deep linking
 */
function extractSubTargetId(payload: Record<string, unknown> | undefined): string | null {
    if (!payload) return null;
    return (payload.subTargetId as string) || (payload.commentId as string) || null;
}

/**
 * Extract target URL for fallback routing
 */
function extractTargetUrl(
    raw: Record<string, unknown>,
    payload: Record<string, unknown> | undefined
): string | null {
    return (raw.targetUrl as string) || (payload?.targetUrl as string) || null;
}

/**
 * Checks if a notification has a valid actor for profile navigation.
 */
export function hasValidActor(notification: NormalizedNotification): boolean {
    return Boolean(notification.actor?.id);
}

/**
 * Checks if a notification has a valid target for content navigation.
 */
export function hasValidTarget(notification: NormalizedNotification): boolean {
    return Boolean(notification.target?.id || notification.targetUrl);
}

/**
 * Gets display name for actor with fallback to "System"
 */
export function getActorDisplayName(notification: NormalizedNotification): string {
    if (!notification.actor) return 'System';

    if (notification.actor.username) {
        return notification.actor.username;
    }

    const fullName = [notification.actor.firstName, notification.actor.lastName]
        .filter(Boolean)
        .join(' ');

    return fullName || 'Someone';
}

/**
 * Gets actor initials for avatar fallback
 */
export function getActorInitials(notification: NormalizedNotification): string {
    if (!notification.actor) return 'SY';

    if (notification.actor.username) {
        return notification.actor.username.slice(0, 2).toUpperCase();
    }

    const first = notification.actor.firstName?.charAt(0) || '';
    const last = notification.actor.lastName?.charAt(0) || '';

    return (first + last).toUpperCase() || 'UN';
}

/**
 * Check if notification is a system notification (no actor)
 */
export function isSystemNotification(notification: NormalizedNotification): boolean {
    return !notification.actor?.id;
}
