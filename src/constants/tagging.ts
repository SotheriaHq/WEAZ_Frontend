/**
 * Tagging — what the product used to call "saving".
 *
 * A shopper who keeps a piece is TAGGING it, and the shopper's own tab is their
 * Tags. The backend contract is untouched (`/saved`, `targetType`, `isSaved`):
 * this is the vocabulary the reader sees, nothing more.
 *
 * Tag and Tagged are two states of one control, not two words for one thing.
 * `TAG_LABEL` is the invitation, `TAGGED_LABEL` is the confirmation, and the
 * control never needs a notice on top of them — a filled tag is the message.
 */

/** Outline tag: not tagged yet. */
export const TAG_EMOJI = String.fromCodePoint(0x1f3f7, 0xfe0f);
/** Filled bookmark: tagged. Deliberately a different silhouette, not a tint. */
export const TAGGED_EMOJI = String.fromCodePoint(0x1f516);

export const TAG_LABEL = 'Tag';
export const TAGGED_LABEL = 'Tagged';
export const UNTAG_LABEL = 'Untag';
/** The shopper's own tab. */
export const TAGS_TAB_LABEL = 'Tags';

export const TAG_ADDED_TOAST = 'Tagged.';
export const TAG_REMOVED_TOAST = 'Untagged.';
export const TAG_ERROR_TOAST = 'Unable to update your tags.';
export const TAG_SIGN_IN_TOAST = 'Please sign in to tag items.';
export const TAG_OWN_CONTENT_TOAST = 'Brands cannot tag their own content.';

/** State → the label the control shows. */
export const tagActionLabel = (tagged: boolean): string => (tagged ? TAGGED_LABEL : TAG_LABEL);
/** State → what pressing it will do. Titles and aria-labels want this one. */
export const tagActionHint = (tagged: boolean): string => (tagged ? UNTAG_LABEL : TAG_LABEL);
