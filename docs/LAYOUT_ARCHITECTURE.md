# Threadly UI layout architecture (frontend)

## Why this exists
The app previously mixed many different `z-*` values (`z-20`, `z-50`, `z-[1000]`, etc.) and rendered many overlays inline (inside headers, cards, or page containers). That combination is the root cause of:

- overlays “climbing” above/under the wrong UI
- stacking conflicts across screens/breakpoints
- dropdowns getting clipped by scroll containers
- unpredictable click-outside behavior (especially once portals are introduced)

This document defines a global layout model and a named z-layer system so overlays behave consistently without “random z-index bumps.”

## Global layout model
Treat the UI as a small number of layers:

1. **Base layout**: page background + app shell
2. **Navigation**: header and persistent side navigation
3. **Page content**: route content, cards, sticky sections inside pages
4. **Overlays**: dropdowns, popovers, floating panels
5. **Drawers**: side panels that slide over content (cart, wishlist, sidebar overlay)
6. **Modals / dialogs**: blocking dialogs that trap focus
7. **Tooltips / toasts**: highest priority ephemeral UI

Overlays/drawers/modals should render in a portal so they do not depend on local stacking contexts.

## Portal strategy
- `index.html` includes `#overlay-root`.
- Use `src/components/ui/OverlayPortal.tsx` to render overlay UI into `#overlay-root`.

This prevents overlays from being clipped or reordered by page containers that create stacking contexts.

## Named z-layer system
Defined in `src/index.css` as CSS variables and exposed as utility classes:

- `z-layer-nav`
- `z-layer-sidebar`
- `z-layer-overlay` (scrims/backdrops)
- `z-layer-dropdown`
- `z-layer-drawer`
- `z-layer-modal`
- `z-layer-tooltip`
- `z-layer-toast`

Rationale:
- **Nav** is above content.
- **Sidebar rail** is above content; **sidebar overlay** uses the drawer layer.
- **Overlay scrims** sit above nav/content and below drawers/modals.
- **Dropdowns** sit above scrims but below drawers/modals.
- **Drawers** sit above dropdowns.
- **Modals** sit above drawers.
- **Tooltips/toasts** sit above everything.

## Rules (enforced by convention)
- Don’t add new `z-[…]` arbitrary values.
- Don’t “fix” overlap issues by incrementing z-index.
- Prefer portal overlays (`OverlayPortal`) for dropdowns/popovers/menus.
- Overlays must have:
  - viewport-relative max height
  - internal scrolling
  - no page reflow
- Only one scroll container should own the page scroll (`body`/main route). Overlays get their own internal scroll.

## Recent refactors
- Notifications dropdown moved to a portal overlay and uses the dropdown z-layer.
- Shared `Modal` and `ConfirmDialog` now render via portal and trap focus.
- Shared `DropdownMenu` now renders via portal and uses anchored positioning.
- Sidebar uses named layers (`z-layer-sidebar` for rail, `z-layer-drawer` for overlay).

## Known remaining work
There are still many hard-coded `z-*` usages in individual screens/components (especially older one-off modals). Those should be migrated to the shared primitives (`Modal`, `ConfirmDialog`, `Dropdown`, `OverlayPortal`) and the named z-layer utilities over time.
