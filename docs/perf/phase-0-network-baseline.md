# Phase 0 Network Baseline - Web

This is a measurement-only workflow. It does not change API behavior, caching policy, or route-level fetching.

## Dev Tracer

The web Axios clients register a development-only in-memory tracer.

- Enabled by default when `import.meta.env.DEV` is true.
- Disabled with `VITE_THREADLY_NETWORK_TRACE=0`.
- Disabled automatically when `import.meta.env.MODE` is `test`.
- Production builds do not record trace entries.
- Request bodies, auth headers, cookies, tokens, passwords, and raw signed URLs are not recorded.

Use the browser console:

```ts
window.__THREADLY_NETWORK_TRACE__?.clear();
window.__THREADLY_NETWORK_TRACE__?.printSummary();
window.__THREADLY_NETWORK_TRACE__?.entries();
```

Optional manual annotations are available during controlled testing:

```ts
window.__THREADLY_NETWORK_TRACE__?.markTrigger('navigation');
window.__THREADLY_NETWORK_TRACE__?.setRoute('/catalog');
```

## Required Web Reproduction Path

1. Start the web app in development mode.
2. Open DevTools Network.
3. Enable Preserve log.
4. Clear the Network panel.
5. Run `window.__THREADLY_NETWORK_TRACE__?.clear()` in the console.
6. Open catalog/profile.
7. Open a design detail.
8. Go back.
9. Open the inline collection viewer.
10. Go back.
11. Trigger one safe toast-producing action, such as saving/unsaving if a dev account is available.
12. Repeat the same path once.
13. Run `window.__THREADLY_NETWORK_TRACE__?.printSummary()`.
14. Export a HAR from DevTools Network.

## Metrics To Capture

- Total requests.
- Duplicate buckets.
- Repeated profile, collection, design/detail, signed URL, cache-busted, and no-store calls.
- Calls by route/pathname and `document.visibilityState`.
- Foreground/visibility-triggered calls when detected.
- Top 10 repeated endpoints.
- Top 10 largest response classes when response size can be estimated.
- Skeleton or loader flashes observed while following the path.

## Suggested Commands

```powershell
npm run dev
```

To disable tracing for a control run:

```powershell
$env:VITE_THREADLY_NETWORK_TRACE='0'
npm run dev
```
