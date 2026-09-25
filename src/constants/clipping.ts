/**
 * Clipping — what the product used to call "saving".
 *
 * A shopper who keeps a piece CLIPS it, and their own tab is their Clips. The
 * word is the one stylists and editors have always used: a clipping is what you
 * cut out of a magazine and put on a board, which is exactly what this feature
 * is for. It sits with Runway and Market rather than against them.
 *
 * WHY NOT "tag": `tags` already means hashtags here — `TagsApi`, the hashtag
 * picker, `AdminTagsPage`, `item.tags`, and the tag button on a card that opens
 * a design's hashtags. A second meaning for that word would cost every engineer
 * a moment of doubt on every read, forever.
 *
 * The other names are taken too, which is what makes `clip` the free slot:
 * `patch` is following a brand, `thread` is reacting, `bag` is the cart.
 *
 * The backend contract is untouched (`/saved`, `targetType`, `isSaved`): this is
 * the vocabulary the reader sees, nothing more.
 *
 * Clip and Clipped are two states of one control, not two words for one thing.
 * `CLIP_LABEL` is the invitation, `CLIPPED_LABEL` is the confirmation, and the
 * control never needs a notice on top of them — a filled mark is the message.
 */

/** Paperclip: the invitation. */
export const CLIP_EMOJI = String.fromCodePoint(0x1f4ce);
/**
 * Bookmark ribbon: kept.
 *
 * A different SILHOUETTE, not the same shape in another tint — a tint alone is
 * swallowed over a photograph and says nothing to anyone who cannot separate
 * the two colours. (Scissors would have been the obvious partner to a clip, but
 * ✂️ is already the custom-order mark in `constants/bagging.ts`.)
 */
export const CLIPPED_EMOJI = String.fromCodePoint(0x1f516);

export const CLIP_LABEL = 'Clip';
export const CLIPPED_LABEL = 'Clipped';
export const UNCLIP_LABEL = 'Unclip';
/** The shopper's own tab. */
export const CLIPS_TAB_LABEL = 'Clips';

export const CLIP_ADDED_TOAST = 'Clipped.';
export const CLIP_REMOVED_TOAST = 'Unclipped.';
export const CLIP_ERROR_TOAST = 'Unable to update your clips.';
export const CLIP_SIGN_IN_TOAST = 'Please sign in to clip items.';
export const CLIP_OWN_CONTENT_TOAST = 'Brands cannot clip their own content.';

/** State → the label the control shows. */
export const clipActionLabel = (clipped: boolean): string =>
  clipped ? CLIPPED_LABEL : CLIP_LABEL;
/** State → what pressing it will do. Titles and aria-labels want this one. */
export const clipActionHint = (clipped: boolean): string =>
  clipped ? UNCLIP_LABEL : CLIP_LABEL;
