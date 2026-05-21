# Phase 3 Media Cache Policy

Phase 3 standardizes web media resolution around direct payload URLs first, then query-owned public and private URL resolution.

## Resolution Order

1. Use a stable variant URL already present in the API payload.
2. Use a stable public original URL already present in the API payload.
3. Resolve `media.publicUrl(fileId)` through `/uploads/public-url/:id`.
4. Fall back to `media.signedUrl(fileId)` through `/uploads/signed-url/:id` only when public resolution is unavailable.
5. Keep the component fallback image if all resolution fails.

The web hooks and image fallback components no longer force public URL resolution when the API already provides a usable absolute URL.

## Query Keys

- `media.publicUrl(fileId)` resolves public media through the query cache.
- `media.signedUrl(fileId)` resolves private fallback URLs through the query cache but is not intended for long-lived persistence.

## TTL And Invalidation

- Public and private URL caches use signed URL expiry when the URL exposes an expiry parameter, otherwise the existing short client TTL.
- 400/404 public URL misses are cached briefly to avoid retry spam.
- 401/403 public URL misses can fall back to private signed resolution.
- Force refresh removes public and signed query entries for the same file ID.

## Known Limits

- Private signed media fallback still needs a real private-media fixture to validate end to end.
- The backend CDN/public base URL configuration determines whether payload URLs are fully stable CDN URLs or short-lived public signed URLs.
