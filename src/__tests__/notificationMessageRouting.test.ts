import { describe, expect, it } from 'vitest';
import { resolveNotificationClickRoute } from '@/utils/notificationRouting';
import { normalizeNotification } from '@/utils/notificationAdapter';

/**
 * A notification about a message must open messaging. Every time.
 *
 * This has been reported as fixed and then reported again, which is the signal
 * that the reasoning was being done on the shape of the code rather than on the
 * shape of the data. So these cases are built from what the backend actually
 * writes: `messaging-side-effects.service.ts` puts `targetUrl`, `threadId` and
 * `conversationId` into the outbox payload, the registry schema validates that
 * payload with Joi `stripUnknown`, and the list endpoint hands back both the
 * sanitised `targetUrl` column and the raw payload.
 *
 * The case that matters most is the LEGACY one: rows written before the payload
 * carried a targetUrl are still sitting in people's inboxes, dated weeks back,
 * and they are exactly the ones a reader is most likely to still have unread.
 */

const notification = (type: string, payload: Record<string, unknown>) =>
  normalizeNotification({
    id: 'n1',
    type,
    message: 'You have unread order messages waiting',
    createdAt: '2026-08-24T10:00:00.000Z',
    isRead: false,
    payload,
  });

const shopper = { isBrand: false, isAdminConsoleUser: false };
const brand = { isBrand: true, isAdminConsoleUser: false };

describe('message notifications always land in messaging', () => {
  it('opens the thread when the payload carries a targetUrl', () => {
    const route = resolveNotificationClickRoute(
      notification('MESSAGE_RECEIVED', {
        threadId: 'thread-1',
        messageId: 'message-1',
        targetUrl: '/messages?thread=thread-1&customOrderId=co-1',
      }),
      shopper,
    );
    expect(route).toContain('/messages');
    expect(route).toContain('thread-1');
  });

  it('opens the thread from the payload when no targetUrl was stored', () => {
    const route = resolveNotificationClickRoute(
      notification('MESSAGE_RECEIVED', {
        threadId: 'thread-2',
        messageId: 'message-2',
      }),
      shopper,
    );
    expect(route).toContain('/messages');
    expect(route).toContain('thread-2');
  });

  /*
    The digest. It is about several threads at once, so it has no single thread
    to open - it must still land in the inbox rather than the settings screen
    the reader just tapped from.
  */
  it('opens the inbox for the unread digest even with an empty payload', () => {
    const route = resolveNotificationClickRoute(
      notification('MESSAGE_UNREAD_REMINDER', {}),
      shopper,
    );
    expect(route.startsWith('/messages')).toBe(true);
  });

  it('never lands on the notifications or settings screen', () => {
    const types = [
      'MESSAGE_RECEIVED',
      'MESSAGE_UNREAD_REMINDER',
      'MESSAGE_THREAD_REOPENED',
      'MESSAGE_MODERATED',
    ];
    const payloads: Array<Record<string, unknown>> = [
      {},
      { threadId: 'thread-3' },
      { conversationId: 'thread-4' },
      { orderId: 'order-1' },
      { customOrderId: 'co-1' },
      { targetUrl: '/settings?tab=notifications' },
      { targetUrl: '/notifications' },
    ];

    for (const type of types) {
      for (const payload of payloads) {
        for (const context of [shopper, brand]) {
          const route = resolveNotificationClickRoute(
            notification(type, payload),
            context,
          );
          expect(
            route.startsWith('/messages') ||
              route.startsWith('/studio/messages') ||
              route.startsWith('/studio?tab=orders'),
            `${type} with ${JSON.stringify(payload)} routed to ${route}`,
          ).toBe(true);
        }
      }
    }
  });

  it('keeps a brand inside studio messaging', () => {
    const route = resolveNotificationClickRoute(
      notification('MESSAGE_RECEIVED', {
        threadId: 'thread-5',
        messageId: 'message-5',
        brandId: 'brand-1',
        customOrderId: 'co-2',
      }),
      brand,
    );
    expect(route.startsWith('/studio/messages')).toBe(true);
  });
});
