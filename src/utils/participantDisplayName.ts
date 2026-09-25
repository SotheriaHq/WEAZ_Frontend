/**
 * One way to name a messaging participant on the web.
 *
 * Four components used to derive this independently, each writing some variant
 * of `firstName || username || role`. Two consequences:
 *
 *  1. Shoppers rendered as a bare given name. In a conversation list a first
 *     name is not an identity — two Jaydes look like the same person.
 *  2. Brands rendered as the OWNER's given name, because a brand account's
 *     `firstName` is whoever registered it, not the storefront being messaged.
 *
 * The server now sends `displayName`, which already applies the real rule
 * (brand → brand name, person → full name). This prefers it and keeps the old
 * derivation as a fallback, so a stale cache or an older response still names
 * people sensibly instead of rendering blank.
 *
 * Frontend Rule 1: identity data has a single canonical source. Import this
 * rather than reaching for `sender.firstName` again.
 */

export type MessagingParticipantLike = {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
} | null | undefined;

const clean = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/**
 * @param participant the sender/participant object from the messaging API
 * @param fallback shown when the record carries no usable name (a role label
 *   such as "Brand" or "You" — never an id, which reads as corruption)
 */
export function resolveParticipantDisplayName(
  participant: MessagingParticipantLike,
  fallback = 'Participant',
): string {
  if (!participant) return fallback;

  const canonical = clean(participant.displayName);
  if (canonical) return canonical;

  const fullName = [clean(participant.firstName), clean(participant.lastName)]
    .filter(Boolean)
    .join(' ');

  return fullName || clean(participant.username) || fallback;
}
