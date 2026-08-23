/**
 * One line for a toast. Never the body of what someone wrote.
 *
 * Toasts used to render `payload.message` verbatim, and for comments and
 * replies the server builds that string around the comment text — so a
 * paragraph-long comment became a paragraph-long toast that covered the screen
 * and, worse, published the text to whoever was standing behind the shopper.
 *
 * A toast answers "something happened, by whom". The content belongs in the
 * notification list and in the thread itself, which is where the recipient is
 * going to act on it anyway.
 */

const ACTOR_FALLBACK = 'Someone';

type ToastNotificationLike = {
  type?: string | null;
  message?: string | null;
  title?: string | null;
  actor?: { name?: string | null; username?: string | null; brandName?: string | null } | null;
  payload?: Record<string, unknown> | null;
};

const resolveActorName = (payload: ToastNotificationLike): string => {
  const actor = payload.actor ?? null;
  const fromActor =
    actor?.brandName?.trim() || actor?.name?.trim() || actor?.username?.trim();
  if (fromActor) return fromActor;

  const raw = payload.payload ?? {};
  for (const key of ['actorName', 'brandName', 'senderName', 'authorName', 'username']) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return ACTOR_FALLBACK;
};

/** Longest a toast line may be before it is cut at a word boundary. */
const MAX_TOAST_LENGTH = 90;

export const truncateForToast = (value: string, max = MAX_TOAST_LENGTH): string => {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  // Cut on a word boundary where one is reasonably close, so the line does not
  // end mid-word; fall back to a hard cut for text with no spaces.
  const clipped = text.slice(0, max - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  const body = lastSpace > max * 0.6 ? clipped.slice(0, lastSpace) : clipped;
  return `${body}\u2026`;
};

const COMMENT_TYPES = new Set([
  'COMMENT_RECEIVED',
  'DESIGN_COMMENT',
  'POST_COMMENT',
  'COMMENT_ON_DESIGN',
]);
const REPLY_TYPES = new Set([
  'COMMENT_REPLY',
  'REPLY_RECEIVED',
  'COMMENT_REPLIED',
]);

export const summarizeNotificationForToast = (
  payload: ToastNotificationLike,
): string | null => {
  const type = String(payload.type ?? '').toUpperCase();
  const actor = resolveActorName(payload);

  if (COMMENT_TYPES.has(type)) return `${actor} commented on your design`;
  if (REPLY_TYPES.has(type)) return `${actor} replied to your comment`;

  // Everything else keeps the server's wording, but bounded. A title is already
  // a summary, so prefer it when one exists.
  const source = payload.title?.trim() || payload.message?.trim();
  return source ? truncateForToast(source) : null;
};
