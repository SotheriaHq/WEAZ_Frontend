import type { ThreadMessage } from '@/api/MessagingApi';

/**
 * Merge the server's messages with the ones this device is still sending.
 *
 * Two failures meet here, and fixing one used to cause the other.
 *
 * **The bubble that vanished.** Sending triggers a refresh, and a refresh
 * replaces the whole list — so sending a second message while the first was
 * still settling erased the second one's bubble mid-flight, and it reappeared
 * seconds later out of nowhere. A message that is still sending, or has failed
 * and is waiting to be retried, exists only on this device: nothing the server
 * returns can contain it, so it has to survive every replacement.
 *
 * **The message that appeared twice.** Keeping every in-flight bubble fixed
 * that, and created a duplicate. Once the send succeeds the refresh brings back
 * the REAL row while the placeholder is still held here, so the thread showed
 * the same message twice and then snapped to one as the placeholder was cleared
 * a beat later. The old code cleared it only after the refresh, deliberately,
 * to avoid a gap where the line briefly disappeared — trading a flicker for a
 * duplicate.
 *
 * Neither is necessary, because the two copies are identifiable: the server
 * stores the `clientMessageId` the sender minted (it is what makes a retry
 * idempotent) and returns it on the message. A placeholder whose id appears as
 * a `clientMessageId` in the incoming rows has already been replaced by the row
 * standing next to it, so it is dropped in the SAME update that brings the real
 * one in. No frame contains both, and none contains neither.
 *
 * Pending rows are appended after the server's because the list runs
 * oldest-first and they are, by definition, the newest thing in the thread.
 */
export const withPendingLocalMessages = (
  incoming: ThreadMessage[],
  current: ThreadMessage[],
): ThreadMessage[] => {
  const settled = new Set<string>();
  for (const message of incoming) {
    const clientMessageId = String(message.clientMessageId ?? '').trim();
    if (clientMessageId) settled.add(clientMessageId);
  }

  const pending = current.filter(
    (message) => message._optimistic && !settled.has(message.id),
  );

  return pending.length > 0 ? [...incoming, ...pending] : incoming;
};

export default withPendingLocalMessages;
