# Profile, Store, Email UX Stability Fix Report

Date: 2026-05-16
Repo: `PatrickOloye/Threadly-frotnend`
Branch: `main`

## Summary

This fix addresses the focused profile QA issues around the compact email verification overlay, store setup reminder weight, email verification action routing, avatar blanking, store-console locking, store brand positioning, and profile-menu theme rerender behavior.

No feed scoring, feed rendering, recommendations, interaction events, market/feed redesign, taxonomy refactors, backend schema changes, or mobile creator taxonomy changes were made.

## Files Changed

- `src/components/catalog/ProfileLayout.tsx`
- `src/components/catalog/Catalog.tsx`
- `src/components/ImageWithFallback.tsx`
- `src/components/profile/AvatarCard.tsx`
- `src/components/profile/AvatarCard.test.tsx`
- `src/components/Navbar.tsx`
- `src/components/store/RequireStoreSetup.tsx`
- `src/components/studio/StudioSidebar.tsx`
- `src/pages/EmailVerify.tsx`
- `src/pages/store/StoreEssentials.tsx`
- `src/components/settings/tabs/StoreGeneralSettings.tsx`
- `src/components/store/wizard/StoreBasicInfoStep.tsx`
- `src/components/store/wizard/StoreLivePreview.tsx`
- `src/components/store/wizard/StoreReviewStep.tsx`
- `src/__tests__/RequireStoreSetup.test.tsx`
- `docs/profile-store-email-ux-stability-fix-report.md`

## Root Causes

1. The email verification overlay was fixed-position, but still visually sized like a large modal and used corrupted encoded emoji text.
2. The store setup reminder used a large bottom card layout that dominated the profile.
3. Store setup email gating carried `next=/studio/store` into `/profile`, so verification actions could continue into setup automatically.
4. Avatar rendering cleared the visible image while signed URLs refreshed or new URLs were still loading.
5. Store console navigation marked most studio links as available before store setup was complete.
6. Store essentials and related store setup surfaces used garment taxonomy categories for brand identity.
7. The profile dropdown was declared as an inline nested React component, so parent theme rerenders could remount/reanimate it.

## Fixes Applied

- Shrunk the email verification prompt to a compact floating reminder with smaller copy, smaller controls, and safe Unicode mail icon rendering.
- Kept resend/check actions local to the prompt: resend uses button-local loading, and check status refreshes `/auth/profile`, updates Redux user state, and stays on `/profile`.
- Removed automatic `next` routing from the store setup email-verification redirect and sanitized `/verify-email?next=/studio/store...` back to `/profile`.
- Added `keepPreviousOnReload` to `ImageWithFallback` and enabled it for avatar rendering so the last successfully loaded avatar stays visible while a replacement URL loads.
- Preserved avatar fallback behavior for broken or unavailable images.
- Made the store setup profile reminder smaller and lower weight.
- Locked non-setup Studio links until store setup completion and blocked disabled mobile bottom-nav selection.
- Replaced garment category options in store essentials/settings/setup review surfaces with brand specialization terms such as Womenswear, Menswear, Bespoke / Made-to-measure, Couture, Ready-to-wear, Bridal, Traditional / Cultural wear, and Accessories.
- Converted the navbar profile menu from a nested component remount pattern to a render function to reduce visible dropdown re-expansion during theme changes.

## Email Verification URL Guidance

No backend code was changed in this pass. Backend local verification URL behavior had already been documented and tested in the existing email verification URL routing work:

- Desktop local testing should use `WEB_APP_URL=http://localhost:3000`.
- LAN IP URLs are still valid for mobile-device testing only when the frontend dev server is reachable from that device.
- Production/staging must set `WEB_APP_URL` or `FRONTEND_URL`.

## Commands Run

- `npm exec tsc -- --noEmit` - passed.
- `npm exec vitest -- run src/components/profile/AvatarCard.test.tsx src/__tests__/RequireStoreSetup.test.tsx` - passed, 2 files / 4 tests.
- `npm run build` - passed.
- `npm run lint` - passed with 56 existing warnings and 0 errors.
- `git diff --check` - passed with CRLF conversion warnings only.

## Manual QA Checklist

- Open `/profile` as an unverified brand user; banner should stay in place and the email prompt should be compact.
- Click `Resend email`; only the button should show `Sending...`.
- Click `Check status`; the page should stay on profile and hide the prompt only if verification is confirmed.
- Visit a profile URL that still contains `next=/studio/store`; it should clean the stale next path.
- Interact with the avatar; it should not blank while image URLs refresh.
- Try Studio links before setup is complete; non-store sections should be disabled.
- Open store essentials; brand focus options should be specialization terms, not garment categories.
- Change theme from the profile dropdown; the dropdown should not visibly remount/re-expand.

## Known Limitations

- Browser visual verification was not run through an automated browser tool in this pass.
- Existing repo lint warnings remain outside this focused scope.
- Store profile still persists selected brand focus terms through the existing `tags` payload for compatibility; no backend field rename or schema change was introduced.

## Commit SHA

Final pushed commit SHA is recorded in the delivery response after commit and push.
