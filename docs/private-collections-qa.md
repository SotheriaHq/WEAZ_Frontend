# Private Collections: Frontend QA Notes

Date: 2025-11-16

## Cooldown Narrative
- When `requestPrivateAccess` returns `{ cooldownActive: true, nextAllowedAt }`, show info toast: "Try again after <formatted time>".
- Formatting: for same-day, show local `h:mm AM/PM`; otherwise `Mon D, h:mm AM/PM`.
- Do not update the local `privateStates` entry when cooldown is returned.

## Settings > Collections
- Search by username or collection title; updates after 300ms debounce.
- Pagination: page selector (Prev/Next) with page size (10/20/50). Shows result count.
- Keyboard/ARIA:
  - Tabs: `role=tablist` + `role=tab` + `aria-selected`.
  - Search: `type=search` + `aria-label`.
  - List: `role=list` + `role=listitem`.

## Regression Checks
- Notifications dropdown still navigates to deep-links.
- Brand Profile > Collections still loads with `visibility=all` for visitors.
- Request Access is gated behind auth; unauth redirects to login with `returnTo` preserved.

## Edge Cases
- Missing/invalid `nextAllowedAt`: still show generic "Try again later" copy.
- Approved state: button should not appear; state shows approved in privateStates.
- Network errors: toasts show error; no state changes.
