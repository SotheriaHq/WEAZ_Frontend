# Studio startup recovery

Studio in the native app loads the same web application as the website. A successful native handoff request alone does not establish that the web application started or authenticated successfully.

The theme synchronizer reads the current route to detect the embedded surface. It belongs inside the root route, underneath `RouterProvider`. Mounting it above that provider throws before Studio can exchange the handoff or report readiness.

`appRouterStartup.test.tsx` mounts the actual application with the real router and embedded-surface hook. It reproduces the previous startup failure when the synchronizer is moved outside the router. The theme suite covers saved preferences and backend synchronization.

A terminal root startup error reports `BOOT_FAILED` through the existing native bridge, without including error details or credentials. Updated native clients stop the loader and present Retry/Close. Stale-bundle recovery and offline recovery retain their existing behavior. Older clients still use their bounded timeout.

The native startup watchdog runs only while Studio is focused and the application is active. Backgrounding or leaving Studio cancels it; resuming grants a fresh timeout. Readiness still requires the authenticated web application's `READY` event; a page load or heartbeat alone never grants readiness.

Release checks: open Studio from Catalogue, verify the dashboard appears, leave and reopen it, then background/resume during loading. Also verify that web theme preferences still apply while the native host theme takes precedence inside Studio. Do not clear application data or sign out to test this fix.
