# Session response ownership

Status: implemented in SIT (web, native and backend); real multi-tab, browser and phone acceptance pending.

Every API attempt retains the session generation that sent it. Changing account, session or security revision invalidates old successes, errors and retries. Normal token rotation preserves in-flight work. An invalidated GET cannot refill a cleared coalescing cache. Cancellation is recognized by the sign-in provider so an old request cannot clear a newer sign-in.

All mutating authentication requests share the refresh queue. Same-origin Web Locks extend serialization across tabs on supporting browsers; the local queue remains available without that API. This prevents overlapping cookie writes inside the coordinated clients, not arbitrary external applications or unsupported browsers from changing the cookie jar. A refresh returning another identity expires only this tab's state.

Storage events trigger private-state cleanup and server revalidation. Never merge another persisted person's contact data into a server profile. Receiving-tab failures preserve shared auth storage to avoid signing out the healthy sender. This is transport/state isolation, not authorization: the backend still verifies every credential and resource grant.

Profile restoration first restores the volatile, session-bound bearer from the refresh cookie. This gives a legitimate challenge a verified local cancellation binding before the MFA presenter opens. A transient restoration failure sends no unbound profile request; rejection before identity is established clears only this tab, preserving a healthy tab's shared snapshot.

Realtime connections wait for the current user's bound bearer. Token rotation within a session reconnects the same socket/listeners; a new account disposes its old rooms. Expiry renewal owns one capped-backoff retry timer, wakes on online/foreground, and cancels on identity change/disposal. Last-subscriber removal leaves the content room so revisits do not accumulate stale subscriptions. Run `npm run test:session-socket` and the mounted provider tests.

When Studio receives `PARENT_SESSION_VERIFICATION_REQUIRED`, it shows a phone-first screen instead of trying child MFA. The native host must verify its matching root session. Messages contain only correlation and session identifiers, never tokens or action proofs. An acknowledgement permits one retry; current server authority must still succeed, and a critical operation still needs its own exact-action approval. The screen provides failed/timeout/cancel/retry states and guidance when no native host is present.

Logout captures the outgoing token and waits behind older cookie operations. The matching backend accepts correctly signed expired access credentials for revoking only their own session and does not clear a newer tab's cookies. Deploy these changes together. Native account-bound push cleanup remains independent of the current visible account.

Run `npm run test:session-response-isolation`. Set `WIEZ_NATIVE_SECURITY_ROOT` to the sibling checkout to exercise both transports. A standalone checkout explicitly skips the missing sibling. The native repository carries the same decision matrix and runs the web source when `WIEZ_WEB_SECURITY_ROOT` is available. Mounted AuthContext and session-cleanup tests cover visible state and cross-tab receiver failures. Actual multi-tab/browser/phone acceptance remains required.
