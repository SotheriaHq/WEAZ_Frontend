# Profile Avatar and Email Verification UX Fix Report

## Summary

Fixed the `/profile` avatar stability issue and changed the email verification prompt from a layout-pushing banner into a fixed overlay. The route and email verification flow remain compatible with the existing backend contract.

## Files Changed

- `src/components/ImageWithFallback.tsx`
- `src/components/catalog/OwnerCatalogMediaHeader.tsx`
- `src/components/catalog/ProfileHeader.tsx`
- `src/components/catalog/ProfileLayout.tsx`
- `src/components/profile/AvatarCard.tsx`
- `src/components/profile/AvatarCard.test.tsx`
- `src/pages/catalog/Catalog.tsx`
- `docs/profile-email-verification-ux-fix-report.md`

## Audit Findings

Profile avatar source:
- Owner profile media comes from the authenticated user snapshot in Redux.
- Visitor profile media comes from the public brand profile payload.
- Owner media had file IDs available through `profileImageId` / `profileImageFile.id` and `bannerImageId` / `bannerImageFile.id`.
- Visitor media had file IDs available through `logoImageMeta.fileId` and `bannerImageMeta.fileId`.

Image loading behavior:
- `ImageWithFallback` resolves signed URLs, caches them in session storage, retries once on failure, and uses `DefaultAvatar` for failed known-unavailable media.
- A cached image or retry path could leave the image at `opacity-0` if the browser did not fire a normal `load` event after React reset internal loading state.

Avatar sizing:
- `AvatarCard` passed a fallback `max-h-28` because no size map entry contained a `max-h-*` class.
- That was wrong for the large profile avatar because the avatar container is much larger than `7rem`.

Verification prompt:
- `ProfileLayout` rendered the email verification prompt inside `<main>` above the catalog/profile content.
- That normal-flow placement pushed the profile banner downward for unverified users.

Store setup prompt:
- Store setup already uses a fixed overlay card pattern in `Catalog.tsx`.
- The email verification prompt now follows the same overlay principle instead of occupying document flow.

Email verification page:
- `/verify-email` is registered in `App.tsx`.
- `EmailVerify.tsx` calls `GET /auth/verify-email?token=...`.
- The page sanitizes `next` to local paths only and redirects verified authenticated users back to profile.

## Root Causes

Avatar blanking:
- The large avatar used an unsafe fallback `max-h-28`.
- Avatar rendering did not pass available file IDs through the header stack, so it could rely on stale signed URLs.
- The image loader could remain transparent after signed URL retry/cache reuse.

Banner displacement:
- The email verification prompt was rendered above the profile content in normal layout flow.

Broken local verification URL:
- Backend local `.env` had `WEB_APP_URL=http://192.168.110.91:3000`, so email links correctly used that LAN IP. That address is only valid if the web dev server is reachable from that network address.

## Fixes Applied

Avatar:
- `AvatarCard` now accepts `fileId`.
- Large avatars use `max-h-full`, not `max-h-28`.
- `ProfileHeader` passes avatar and banner file IDs to image rendering.
- Owner and visitor catalog headers preserve canonical media file IDs.
- `ImageWithFallback` now checks the underlying image element after URL resolution. If the image is already complete, it marks it loaded and prevents a permanent transparent image state.
- Retry now resets loaded state before the fresh URL attempt.

Verification prompt:
- The email verification prompt is now a fixed overlay below the navbar.
- It no longer pushes the profile banner down.
- It keeps masked email text, resend behavior, sending state, contextual copy, and the `next` action when present.

## Validation

- `npm exec tsc -- --noEmit` passed.
- `npm exec vitest -- run src/components/profile/AvatarCard.test.tsx` passed.
- `npm run build` passed.
- `npm run lint` passed with 56 existing warnings and 0 errors.
- `git diff --check` passed with line-ending warnings only.

## Known Limitations

- Browser-level verification of the unverified overlay requires an authenticated unverified account.
- Existing lint warnings were not part of this bugfix and were not broadly cleaned up.

## Out of Scope Confirmation

Feed scoring, feed rendering, recommendations, interaction events, market/feed redesign, and taxonomy refactors were not changed.
