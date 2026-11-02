# Studio startup recovery

Studio in the native app loads the same web application as the website. A successful native handoff request alone does not establish that the web application started or authenticated successfully.

The theme synchronizer reads the current route to detect the embedded surface. It belongs inside the root route, underneath `RouterProvider`. Mounting it above that provider throws before Studio can exchange the handoff or report readiness.

`appRouterStartup.test.tsx` mounts the actual application with the real router and embedded-surface hook. It reproduces the previous startup failure when the synchronizer is moved outside the router. The theme suite covers saved preferences and backend synchronization.

A terminal root startup error reports `BOOT_FAILED` through the existing native bridge, without including error details or credentials. Updated native clients stop the loader and present Retry/Close. Stale-bundle recovery and offline recovery retain their existing behavior. Older clients still use their bounded timeout.

The native startup watchdog runs only while Studio is focused and the application is active. Backgrounding or leaving Studio cancels it; resuming grants a fresh timeout. Readiness still requires the authenticated web application's `READY` event; a page load or heartbeat alone never grants readiness.

Release checks: open Studio from Catalogue, verify the dashboard appears, leave and reopen it, then background/resume during loading. Also verify that web theme preferences still apply while the native host theme takes precedence inside Studio. Do not clear application data or sign out to test this fix.

## Native/web navigation feedback

A route report describes a change that has already happened. It is not a request to navigate. Native mirrors reported route/resource identifiers with a report signature; the loading/navigation effect must not inject those observations back into the WebView. Explicit island commands clear the signature. Reports for native-owned or blocked destinations do not change WebView route parameters.

The web bridge rejects route reports from a stale React effect when the browser address has already changed. It also treats a command for the current address as an acknowledgement, preserving query-order equivalence without another history change. Navigation remains restricted to the current origin.

Regression tests cover rapid destination changes, delayed reports, acknowledgement echoes, product/order resource identity and both foreground and native-stack island entries. Removing either fix makes the corresponding regression fail. Verify on a phone by changing sections several times, then leaving it untouched: the address, content and selected island item must settle and remain stable. Repeat after leaving/reopening Studio and background/resume.
