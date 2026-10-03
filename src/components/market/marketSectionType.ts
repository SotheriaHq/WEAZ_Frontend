/**
 * One voice for every row on the Market.
 *
 * The page had four different section headings — `text-xl font-bold`,
 * `text-xl font-black`, `text-base font-black sm:text-xl`, `text-lg
 * font-semibold` — and two different "see all" treatments, one of them amber
 * on a page with no other amber. Read top to bottom it looked like four
 * sections borrowed from four places, which is exactly what it was.
 *
 * The trending hero introduced Playfair (`font-serif`) for the things a
 * shopper is here to look at. A section label names one of those things, so it
 * belongs to the same voice; a row of sans-serif weights competing for
 * attention above it does not.
 *
 * Imported rather than copied so the next row added to this page cannot
 * quietly become a fifth style.
 */

/** The small uppercase line above a title, where a section has one. */
export const MARKET_SECTION_EYEBROW_CLASS =
  'text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--brand-primary)]';

/** A section label: "Fresh Drops", "Featured", "Explore the Market". */
export const MARKET_SECTION_TITLE_CLASS =
  'font-serif text-xl leading-tight tracking-[-0.01em] text-[color:var(--text-primary)] sm:text-2xl';

/**
 * The way out of a section.
 *
 * A link, not a button: it goes somewhere, and dressing it as a control
 * competes with the things in the row that actually do something. The
 * underline appears on hover rather than sitting there, so a page of rows is
 * not a page of rules.
 */
export const MARKET_SECTION_LINK_CLASS =
  'shrink-0 rounded-full font-serif text-sm font-semibold text-[color:var(--brand-primary)] underline decoration-transparent underline-offset-4 transition hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)]';

/** Title on the left, way out on the right, sharing one baseline. */
export const MARKET_SECTION_HEADER_CLASS =
  'flex items-baseline justify-between gap-4';
