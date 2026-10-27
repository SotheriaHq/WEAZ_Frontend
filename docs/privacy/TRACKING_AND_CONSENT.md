# Tracking and consent

How WIEZ decides what may measure people, on every surface, and how to keep
it that way. The user-facing text lives in
`docs/legal/user-facing/03_COOKIE_AND_TRACKING_POLICY.md` (cookie policy) and
`02_PRIVACY_POLICY.md`; change them together with the code.

## Rule

Nothing optional runs until the person chooses, and withdrawing is as easy as
agreeing. Essential storage (sign-in, security, bag, theme, the consent record
itself) never needs consent.

## Inventory

| Integration | Surface | Starts when | What it receives | Code |
| --- | --- | --- | --- | --- |
| Google Analytics 4 | Web | Analytics allowed and `VITE_GA_MEASUREMENT_ID` set | Page views with cleaned addresses (no query, fragment, ids, tokens or emails). Ads storage, Google signals and ad personalization off. | `src/privacy/thirdPartyLoaders.ts`, `src/observability/analytics.ts` |
| Cloudflare Web Analytics | Web | Analytics allowed and `VITE_CF_WEB_ANALYTICS_TOKEN` set | Page-load timings | `src/privacy/thirdPartyLoaders.ts` |
| Sentry errors | Web, app, server | At launch (essential) | Stack traces, route, browser or device type. `sendDefaultPii: false`; web and app strip queries, ids, tokens and emails from request and breadcrumb addresses. The server SDK sends no request bodies or user IP with this setting and filters header, cookie and query keys containing "auth" or "token". | Web `src/observability/sentry.ts`; app `src/observability/sentry.ts`; server `src/common/observability/sentry.instrument.ts` |
| Sentry performance tracing | Web, app | Analytics allowed | Timings for routes and requests | Web `enableSentryTracing`; app `tracesSampler` |
| Discovery signals | Web, app | Analytics allowed (on the web also no DNT or GPC) | View, tap and dwell-band events, random browser or install id | Web `src/services/marketSignalQueue.ts`; app `src/services/marketSignals.ts` |
| Browser or install id (`x-wiez-device-id`) | Web, app | Analytics allowed | A random id used only to count a view once | Web `src/utils/deviceId.ts`; app `src/utils/deviceId.ts` |
| Google Identity Services | Web | The person chooses Continue with Google, or allowed "Faster Google sign-in" | What the browser sends to Google sign-in | `src/components/auth/GoogleSignInOverlayButton.tsx` |
| Paystack | Web, app | The person pays | Payment details, on Paystack's own pages | Checkout flows |

There are **no** advertising pixels, conversion APIs, session recorders or
server-side analytics events, and no purchase or conversion event is sent to
any provider. If one is ever added, send it only from the backend after the
payment is verified (webhook or verify call), use the payment reference as the
event id for deduplication, and send the amount and currency actually charged.

`src/utils/notificationTelemetry.ts` only dispatches a local browser event; it
sends nothing.

## Consent record

One record per browser or install, the same shape on web and app:

```json
{ "version": 1, "decidedAt": "<ISO time>", "analytics": false, "thirdPartySignIn": false }
```

- Key `wiez.consent` (web `localStorage`, app `AsyncStorage`). The app record
  has no `thirdPartySignIn`.
- Never sent to the server. It belongs to the device, so signing in, signing
  out or switching account does not change it.
- Expires after twelve months (`CONSENT_MAX_AGE_MS`); then the person is asked
  again.
- Raise `CONSENT_VERSION` when adding an optional purpose, so everyone is asked
  again instead of an old "yes" covering it.
- Web: `analyticsPermitted()` is false while Do Not Track or Global Privacy
  Control is on, whatever the record says.

## Withdrawal

- Web: sets the GA disable flag; deletes `_ga*`, `_gid`, `_gat` and `_gcl*`
  cookies on the host and its parent domains; clears the signal queue and
  browser id; and reloads once if anything optional had loaded on that page.
- App: deletes the install id and signal queue at once; tracing stops from the
  next transaction. Launching without a choice also deletes any id or queue an
  older app version stored.

## Duplicate protection

- Each loader runs once per page; accepting twice does not load anything twice.
- `trackPageView` sends one page view per cleaned address in a row, so the
  analytics loader and the router do not both count the first page of a
  returning visit. Query-only changes clean to the same address.
- The app consent effects start once; a device-id read in flight during
  withdrawal cannot restore the id.

## Where people choose

- Web banner (`src/components/privacy/CookieConsent.tsx`): Accept all and
  Reject optional (same style), plus Choose what to allow. Hidden inside the
  app's embedded Studio, where optional web analytics stay off.
- Web settings: Settings > Privacy > Change cookie settings; the cookie policy
  page; the Cookie settings link on sign-in and sign-up.
- App prompt (`components/privacy/AnalyticsConsentSheet.tsx`): once, Allow or
  Don't allow, after the gender prompt and never over sign-in or policy
  screens.
- App settings: Settings > Privacy controls > Usage analytics, signed in or out.
- Notification permission is a separate system prompt and does not depend on
  this choice. The app does not show Apple's App Tracking Transparency prompt
  because it does not link app data with other companies' data for advertising
  or share it with data brokers, which is how Apple defines tracking.

## Content Security Policy

`scripts/generate-security-headers.cjs` adds Google Analytics origins only
when `VITE_GA_MEASUREMENT_ID` is set, and Cloudflare Web Analytics origins only
when `VITE_CF_WEB_ANALYTICS_TOKEN` is set. Without the token, a beacon that
Cloudflare injects at the edge is blocked.

## Verification

| Scenario | Evidence |
| --- | --- |
| First visit loads nothing optional | `src/__tests__/cookieConsent.test.tsx` |
| Accept loads GA once, even when accepted twice | same |
| Reject loads nothing | same |
| Partial choice (Analytics only) | same (choices view) |
| Withdrawal disables GA, deletes cookies, reloads | same |
| Reload remembers; a version change or twelve months asks again | same |
| Consent declared before config; GA sees no query, token or email | same |
| Returning visit counts the first page once; one view per route | same |
| Sentry scrubbing and tracing gate (web) | `src/__tests__/sentryConfiguration.test.ts` |
| Signals and browser id need consent | `src/services/marketSignalQueue.test.ts` |
| Google sign-in two-step without consent | `src/__tests__/LoginPage.googleAuth.test.tsx` |
| App: launch, allow, reject, withdraw, expiry, races, wiring | `threadly-mobile` `scripts/test-analytics-consent.cjs` |

Not covered by automated tests: real browsers and devices (light and dark,
phone and desktop), and the provider dashboards.

## Owner configuration

- Google Analytics: in the GA4 web data stream, turn off Enhanced
  measurement's "Page changes based on browser history events" (the app sends
  its own page views), and keep Google signals off.
- Cloudflare: turn off Web Analytics automatic setup for the Pages project. To
  use Cloudflare Web Analytics, set `VITE_CF_WEB_ANALYTICS_TOKEN` instead, so
  it loads only after consent.
- Sentry: enable "Prevent storing of IP addresses" and keep server-side data
  scrubbing on.
- App stores: the Google Play Data safety form should list App interactions
  (optional), Crash logs, Diagnostics (optional) and Device or other IDs
  (optional). Mirror this in Apple's App Privacy answers.
- Legal: the policy text was changed to match the code. Decide whether it
  needs a new policy version and notice period.

## Known gaps

- Country and region pickers call `restcountries.com` and `countriesnow.space`
  from the browser, flags load from `flagcdn.com`, and the store setup social
  step calls `unavatar.io`. These are not tracking, but they show the
  visitor's IP address to those services. Planned: serve location data from
  the WIEZ API.
