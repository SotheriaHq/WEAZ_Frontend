/**
 * Notification Telemetry - Analytics Event Tracking
 * 
 * Tracks user interactions with notifications for analytics and optimization.
 * Includes concurrency safety to prevent duplicate events.
 */

import { getTrackingCategory } from '@/types/notificationTypes';

// Interaction types for notifications
export type NotificationInteraction =
    | 'avatar_click'
    | 'username_click'
    | 'body_click'
    | 'keyboard_activate'
    | 'deep_link_success'
    | 'deep_link_failed'
    | 'dropdown_open'
    | 'dropdown_close'
    | 'mark_read'
    | 'mark_all_read';

// Telemetry event structure
export interface NotificationTelemetryEvent {
    notificationId: string;
    notificationType: string;
    interaction: NotificationInteraction;
    isRead: boolean;
    timestamp: number;
    // Optional context
    actorId?: string;
    targetType?: string;
    targetId?: string;
    trackingCategory?: string;
}

// Concurrency safety - prevent duplicate events from rapid clicks
const telemetrySent = new Set<string>();

/**
 * Track a notification interaction, with deduplication
 * @param key Unique key for this event (e.g., `${notificationId}-${interaction}`)
 * @param event The telemetry event data
 */
export function trackOnce(key: string, event: NotificationTelemetryEvent): void {
    if (telemetrySent.has(key)) return;

    telemetrySent.add(key);
    trackNotificationInteraction(event);

    // Clear after 5 seconds to allow re-tracking if user returns
    setTimeout(() => telemetrySent.delete(key), 5000);
}

/**
 * Track a notification interaction
 * @param event The telemetry event data
 */
export function trackNotificationInteraction(event: NotificationTelemetryEvent): void {
    // Add tracking category from registry
    const enrichedEvent = {
        ...event,
        trackingCategory: event.trackingCategory || getTrackingCategory(event.notificationType),
    };

    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
        console.debug('[Notification Telemetry]', enrichedEvent);
    }

    // TODO: Send to analytics provider
    // Examples:
    // - Mixpanel: mixpanel.track('notification_interaction', enrichedEvent);
    // - Amplitude: amplitude.logEvent('notification_interaction', enrichedEvent);
    // - Custom backend: fetch('/api/analytics/notification', { method: 'POST', body: JSON.stringify(enrichedEvent) });

    // For now, we'll just dispatch a custom event that can be listened to
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notification:telemetry', {
            detail: enrichedEvent
        }));
    }
}

/**
 * Create a telemetry event for a notification interaction
 */
export function createTelemetryEvent(
    notification: {
        id: string;
        type: string;
        isRead: boolean;
        actor?: { id?: string | null } | null;
        target?: { type?: string; id?: string } | null;
    },
    interaction: NotificationInteraction
): NotificationTelemetryEvent {
    return {
        notificationId: notification.id,
        notificationType: notification.type,
        interaction,
        isRead: notification.isRead,
        timestamp: Date.now(),
        actorId: notification.actor?.id || undefined,
        targetType: notification.target?.type,
        targetId: notification.target?.id,
    };
}

/**
 * Track dropdown open event
 */
export function trackDropdownOpen(): void {
    trackNotificationInteraction({
        notificationId: 'dropdown',
        notificationType: 'SYSTEM',
        interaction: 'dropdown_open',
        isRead: true,
        timestamp: Date.now(),
    });
}

/**
 * Track dropdown close event
 */
export function trackDropdownClose(): void {
    trackNotificationInteraction({
        notificationId: 'dropdown',
        notificationType: 'SYSTEM',
        interaction: 'dropdown_close',
        isRead: true,
        timestamp: Date.now(),
    });
}

/**
 * Track mark all read event
 */
export function trackMarkAllRead(count: number): void {
    trackNotificationInteraction({
        notificationId: 'bulk',
        notificationType: 'SYSTEM',
        interaction: 'mark_all_read',
        isRead: true,
        timestamp: Date.now(),
        targetId: String(count), // Store count as targetId for analytics
    });
}
