export const baggingSeed = {
  buyerEmail: process.env.THREADLY_E2E_BUYER_EMAIL ?? '',
  buyerPassword: process.env.THREADLY_E2E_BUYER_PASSWORD ?? '',
  standardProductPath: process.env.THREADLY_E2E_STANDARD_PRODUCT_PATH ?? '',
  variantProductPath: process.env.THREADLY_E2E_VARIANT_PRODUCT_PATH ?? '',
  fittingProductPath: process.env.THREADLY_E2E_FITTING_PRODUCT_PATH ?? '',
  customDesignPath: process.env.THREADLY_E2E_CUSTOM_DESIGN_PATH ?? '',
  customProductPath: process.env.THREADLY_E2E_CUSTOM_PRODUCT_PATH ?? '',
  staleFittingsPath: process.env.THREADLY_E2E_STALE_FITTINGS_PATH ?? '',
  duplicateInBagPath: process.env.THREADLY_E2E_DUPLICATE_IN_BAG_PATH ?? '',
  duplicatePaidActivePath: process.env.THREADLY_E2E_DUPLICATE_PAID_ACTIVE_PATH ?? '',
  mixedCheckoutPath: process.env.THREADLY_E2E_MIXED_CHECKOUT_PATH ?? '/checkout',
  loggedOutBagPath: process.env.THREADLY_E2E_LOGGED_OUT_BAG_PATH ?? '',
};

export const hasAuthSeed = () =>
  Boolean(baggingSeed.buyerEmail && baggingSeed.buyerPassword);

export const requiresSeed = (...values: string[]) =>
  values.every((value) => value.trim().length > 0);

export const seedMissingReason = (name: string) =>
  `${name} requires Threadly bagging E2E seed data. See docs/bagging-e2e-fixtures.md.`;
