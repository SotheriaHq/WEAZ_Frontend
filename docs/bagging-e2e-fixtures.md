# Bagging E2E Fixtures

The bagging Playwright suite is wired for live Threadly seed data. Data-dependent tests call `test.skip` when the required environment variables are missing; they are not fake passes.

## Required Environment

- `PLAYWRIGHT_BASE_URL`: running web URL. Defaults to `http://localhost:5173`.
- `THREADLY_E2E_BUYER_EMAIL`: buyer account email.
- `THREADLY_E2E_BUYER_PASSWORD`: buyer account password.

## Required Seed Paths

- `THREADLY_E2E_STANDARD_PRODUCT_PATH`: product that can be standard-bagged without fittings.
- `THREADLY_E2E_VARIANT_PRODUCT_PATH`: product requiring size or color selection.
- `THREADLY_E2E_FITTING_PRODUCT_PATH`: product or source requiring fittings before bagging.
- `THREADLY_E2E_CUSTOM_DESIGN_PATH`: market/design route where DESIGN source bagging is eligible.
- `THREADLY_E2E_CUSTOM_PRODUCT_PATH`: product route where custom bagging is eligible.
- `THREADLY_E2E_STALE_FITTINGS_PATH`: source that returns stale fitting confirmation.
- `THREADLY_E2E_DUPLICATE_IN_BAG_PATH`: source already in the buyer bag.
- `THREADLY_E2E_DUPLICATE_PAID_ACTIVE_PATH`: source with a paid active duplicate.
- `THREADLY_E2E_MIXED_CHECKOUT_PATH`: checkout route with mixed standard and custom lines.
- `THREADLY_E2E_LOGGED_OUT_BAG_PATH`: baggable product or design path for auth prompt coverage.

## Selector Contract

The specs intentionally target buyer-visible copy and roles:

- Item-level CTAs: button names matching `Bag It`, `Bag this item`, `Custom Bag It`, or `Bag as custom request`.
- My Bag surface: dialog/body text matching `Your Bag` or `My Bag`.
- Fittings: copy matching `Fittings`, `Measurements`, or `My Fittings`.
- Stale fittings: copy matching `Continue with existing fittings` and `Update fittings`.

Seed data should keep these labels stable unless the product language changes across web and mobile together.
