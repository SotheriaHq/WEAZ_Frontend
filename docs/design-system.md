# WIEZ Web Design System & Token Architecture

## 1. Overview

The WIEZ design system provides a unified, production-grade visual language across Web and Native applications. The architecture establishes semantic consistency and design token parity while respecting platform-specific implementation patterns.

```
WIEZ DESIGN FOUNDATION
        │
        ├── Primitive Tokens (color ramps, spacing, radius, motion, elevation)
        │
        └── Semantic Tokens (brand, action, surface, text, border, status, focus)
                 │
                 ├── Web Adapter (CSS custom properties, Tailwind config)
                 │         ↓
                 │    Web Components & Screens
                 │
                 └── Native Adapter (tokens.ts, ThemeProvider)
                           ↓
                      Native Components & Screens
```

---

## 2. Brand Identity & Interactive Semantics

WIEZ explicitly separates canonical brand identity from interactive component accents:

| Token | Light Value | Dark Value | Purpose |
|---|---|---|---|
| `brand.mark` | `#6015e2` | `#6015e2` | Canonical brand identity mark on light backgrounds |
| `brand.markOnDark` | `#af87f4` | `#af87f4` | Contrast-safe brand identity mark on dark backgrounds |
| `brand.markStrong` | `#4e11b8` | `#4e11b8` | Deep brand mark variant for high-contrast presentation |
| `brand.accent` | `#9333ea` | `#9333ea` | Component-level interactive accent (buttons, chips, active tabs) |
| `brand.accentHover` | `#7e22ce` | `#a855f7` | Hover interaction state |
| `brand.accentPressed` | `#6b21a8` | `#9333ea` | Pressed / active interaction state |
| `brand.subtle` | `rgba(147, 51, 234, 0.08)` | `rgba(175, 135, 244, 0.12)` | Subtle tinted container backgrounds |
| `brand.border` | `rgba(147, 51, 234, 0.20)` | `rgba(175, 135, 244, 0.25)` | Brand-tinted container outlines |

> [!NOTE]
> **Brand Role Distinction**: `brand.markStrong` (`#4e11b8`) is reserved for deep canonical identity mark presentation with 9.8:1 contrast on white. `brand.accentPressed` (`#6b21a8`) is the interactive pressed state for component-level purple accents (buttons, chips). They represent intentionally different semantic roles and must not be merged.

---

## 3. Scale Foundations

### Standardized Radius
- `none`: `0px`
- `xs`: `2px`
- `sm`: `4px`
- `md`: `8px`
- `lg`: `12px`
- `xl`: `16px`
- `modal`: `28px` (Standardized across all dialogs, sheets, and modal containers)
- `full`: `9999px`

### Motion Durations & Easings
- `instant`: `0ms`
- `fast`: `150ms` (hover, chip toggle, micro-interactions)
- `normal`: `250ms` (expansions, page transitions, sheets)
- `slow`: `400ms` (stage transitions, modal presentation)

---

## 4. Semantic Domains

Every theme (Light and Dark) defines explicit values for seven core semantic domains:
1. `brand`: Identity and accent tokens.
2. `action`: Interactive roles (`primary`, `brand`, `secondary`, `outline`, `ghost`, `danger`, `disabled`).
3. `focus`: Focus rings (`ring: #9333ea`).
4. `surface`: Background layers (`page`, `card`, `elevated`, `recessed`, `overlay`, `modal`, `stage`).
   - *Invariant Exception*: `surface.stage` is locked to deep black `#080a0f` in both light and dark themes for the Runway stage matte.
5. `text`: Typography roles (`primary`, `secondary`, `muted`, `inverse`, `onBrand`).
6. `border`: Structural boundary dividers (`subtle`, `default`, `strong`, `focus`).
7. `status`: Semantic feedback (`success`, `warning`, `danger`, `info`).

---

## 5. Web Consumption Patterns

### CSS Custom Properties
Semantic tokens are exposed via CSS custom properties in `src/index.css`:
```css
/* Example usage in component styles */
.custom-card {
  background-color: var(--wiez-surface-card);
  border: 1px solid var(--wiez-border-subtle);
  border-radius: var(--wiez-radius-modal);
}
```

### Tailwind Utility Classes
Extended in `tailwind.config.js`:
- Backgrounds: `bg-surface-page`, `bg-surface-card`, `bg-action-primary`
- Text: `text-text-primary`, `text-text-secondary`, `text-brand-accent`
- Radius: `rounded-modal` (resolves to `28px`)
- Transitions: `duration-fast`, `duration-normal`, `duration-slow`

### TypeScript Design Foundation
Modules located at `src/design-system/`:
- `primitives.ts`: Raw primitive scales.
- `semantic.ts`: Semantic mappings for light and dark modes.
- `index.ts`: Unified export.

---

## 6. Cross-Platform Contract Verification

Run cross-repository token validation:
```bash
npm run test:design-tokens-contract
```
This test asserts semantic parity, radius scale alignment, motion consistency, and identity protection across Web and Native.
