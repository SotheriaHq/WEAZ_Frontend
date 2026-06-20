# Phase 2B — Web Design-Creation Delivery Parity

Date: 2026-06-20
Scope: `fthreadly` (React web)

## 1. Phase 2A gate result

Phase 2A did not touch web. Web `main` HEAD was unrelated settings work and was left
untouched during the Phase 2A closure gate.

## 2. Delivery / production range — locked to 1–7 days

`CustomOrderConfigurationEditor.tsx` previously validated `productionLeadDays` 1–7 and
rush 1–3, but only checked **presence** of delivery min/max (no bounds). Phase 2B adds
client-side validation matching the backend contract:

- `deliveryMinDays` and `deliveryMaxDays` must each be an integer `1–7`.
- `deliveryMinDays <= deliveryMaxDays`.
- Errors are field-mapped (`deliveryMinDays` / `deliveryMaxDays`) and drive the existing
  first-invalid-field focus + inline error rendering.

Form defaults (`2` / `5`) remain valid within 1–7. Number inputs already use `3` / `7`
placeholders with no stale HTML min/max attributes.

## 3. Rush / rush-fee

No change. Web already validates rush `1–3` days and the 70% rush-fee cap with
field-mapped errors, consistent with the (retained) backend rule.

## 4. Price / base-price parity (reference)

The web design-creation flow is the parity **reference** for native: min price
auto-populates the custom-order base price, updates when min changes (unless manually
overridden), and clears when min is cleared. No web change required in Phase 2B; native
was brought into parity (see mobile doc).

## 5. Tests run

- `npx tsc --noEmit` — clean.

## 6. Manual QA checklist

- [ ] Set delivery max to `8` → inline "Delivery days must be between 1 and 7", focus
  jumps to the field, save blocked.
- [ ] Set delivery min `5`, max `3` → inline "Minimum delivery days cannot exceed
  maximum delivery days".
- [ ] Delivery `1`–`7` saves successfully.
