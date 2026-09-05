import { describe, expect, it } from 'vitest';
import reducer, {
  ingestRealtime,
  removeNotification,
  setUnreadCount,
} from '@/features/notificationsSlice';

describe('notifications realtime reducer', () => {
  it('ingests pushed unread notifications without double-counting duplicate delivery', () => {
    const first = reducer(
      undefined,
      ingestRealtime({
        id: 'notification-1',
        type: 'COMMENT',
        message: 'New comment',
        createdAt: '2026-07-09T10:00:00.000Z',
        isRead: false,
      }),
    );

    expect(first.items).toHaveLength(1);
    expect(first.unreadCount).toBe(1);

    const duplicate = reducer(
      first,
      ingestRealtime({
        id: 'notification-1',
        type: 'COMMENT',
        message: 'New comment',
        createdAt: '2026-07-09T10:00:00.000Z',
        isRead: false,
      }),
    );

    expect(duplicate.items).toHaveLength(1);
    expect(duplicate.unreadCount).toBe(1);
  });

  it('does not increment unread count for pushed read notifications', () => {
    const state = reducer(
      undefined,
      ingestRealtime({
        id: 'notification-2',
        type: 'SYSTEM',
        message: 'Already handled',
        createdAt: '2026-07-09T10:00:00.000Z',
        isRead: true,
      }),
    );

    expect(state.items).toHaveLength(1);
    expect(state.unreadCount).toBe(0);
  });

  it('uses realtime delete deltas instead of recomputing from the partial list', () => {
    const withServerCount = reducer(undefined, setUnreadCount(12));
    const withOneLoadedItem = reducer(
      withServerCount,
      ingestRealtime({
        id: 'notification-3',
        type: 'COMMENT',
        message: 'New comment',
        createdAt: '2026-07-09T10:00:00.000Z',
        isRead: false,
      }),
    );

    const deleted = reducer(
      withOneLoadedItem,
      removeNotification({ id: 'notification-3', unreadDelta: -1 }),
    );

    expect(deleted.items).toHaveLength(0);
    expect(deleted.unreadCount).toBe(12);
  });
});
