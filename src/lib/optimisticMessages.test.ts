import { describe, expect, it } from 'vitest';
import type { ThreadMessage } from '@/api/MessagingApi';
import { withPendingLocalMessages } from '@/lib/optimisticMessages';

const message = (overrides: Partial<ThreadMessage> & { id: string }): ThreadMessage =>
  ({
    threadId: 't1',
    senderRole: 'BUYER',
    kind: 'USER',
    visibilityState: 'VISIBLE',
    createdAt: '2026-09-21T10:00:00.000Z',
    ...overrides,
  }) as ThreadMessage;

describe('withPendingLocalMessages', () => {
  it('keeps a message that is still sending, because the server cannot know about it yet', () => {
    const result = withPendingLocalMessages(
      [message({ id: 'server-1', bodyText: 'earlier' })],
      [message({ id: 'client-1', bodyText: 'in flight', _optimistic: 'sending' })],
    );

    expect(result.map((item) => item.id)).toEqual(['server-1', 'client-1']);
  });

  it('keeps a failed message so the writing is not lost with it', () => {
    const result = withPendingLocalMessages(
      [message({ id: 'server-1' })],
      [message({ id: 'client-1', _optimistic: 'failed' })],
    );

    expect(result.map((item) => item.id)).toEqual(['server-1', 'client-1']);
  });

  /*
    The duplicate: the refresh that follows a successful send brings the real
    row back while the placeholder is still held, so the thread showed the same
    message twice and snapped to one a beat later.
  */
  it('drops the placeholder in the SAME update that brings its real row in', () => {
    const result = withPendingLocalMessages(
      [
        message({ id: 'server-1', bodyText: 'earlier' }),
        message({ id: 'server-2', bodyText: 'hello', clientMessageId: 'client-1' }),
      ],
      [message({ id: 'client-1', bodyText: 'hello', _optimistic: 'sending' })],
    );

    expect(result.map((item) => item.id)).toEqual(['server-1', 'server-2']);
  });

  it('resolves only the placeholder the server echoed, not the others in flight', () => {
    const result = withPendingLocalMessages(
      [message({ id: 'server-2', clientMessageId: 'client-1' })],
      [
        message({ id: 'client-1', _optimistic: 'sending' }),
        message({ id: 'client-2', _optimistic: 'sending' }),
      ],
    );

    expect(result.map((item) => item.id)).toEqual(['server-2', 'client-2']);
  });

  it('ignores a blank clientMessageId rather than matching every placeholder to it', () => {
    const result = withPendingLocalMessages(
      [
        message({ id: 'server-1', clientMessageId: null }),
        message({ id: 'server-2', clientMessageId: '   ' }),
      ],
      [message({ id: 'client-1', _optimistic: 'sending' })],
    );

    expect(result.map((item) => item.id)).toEqual(['server-1', 'server-2', 'client-1']);
  });

  it('returns the server rows untouched when nothing is in flight', () => {
    const incoming = [message({ id: 'server-1' })];
    expect(withPendingLocalMessages(incoming, [])).toBe(incoming);
  });

  it('never keeps a settled message that is not optimistic', () => {
    const result = withPendingLocalMessages(
      [message({ id: 'server-1' })],
      [message({ id: 'server-1' }), message({ id: 'stale' })],
    );

    expect(result.map((item) => item.id)).toEqual(['server-1']);
  });
});
