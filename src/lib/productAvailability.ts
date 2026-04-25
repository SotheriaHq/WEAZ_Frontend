export type ProductAvailabilityInput = {
  totalStock?: number | null;
  customAvailable?: boolean | null;
  customOrderEnabled?: boolean | null;
  isCustomOrderOnly?: boolean | null;
  canBagWhenOutOfStock?: boolean | null;
};

export type ProductStockState =
  | "IN_STOCK"
  | "LOW_STOCK"
  | "OUT_OF_STOCK"
  | "CUSTOM_ORDER_ONLY";

const resolveCustomOrderEnabled = (
  product: ProductAvailabilityInput | null | undefined,
): boolean => {
  if (!product) return false;
  if (product.isCustomOrderOnly === true) return true;
  if (product.canBagWhenOutOfStock === true) return true;
  return (
    product.customOrderEnabled === true || product.customAvailable === true
  );
};

export const isCustomOrderOnlyProduct = (
  product: ProductAvailabilityInput | null | undefined,
): boolean => {
  if (!product) return false;
  if (product.isCustomOrderOnly === true) return true;
  return resolveCustomOrderEnabled(product) && Number(product.totalStock ?? 0) <= 0;
};

export const canBagWhenOutOfStock = (
  product: ProductAvailabilityInput | null | undefined,
): boolean => {
  if (!product) return false;
  if (typeof product.canBagWhenOutOfStock === "boolean") {
    return product.canBagWhenOutOfStock;
  }
  return isCustomOrderOnlyProduct(product);
};

export const isStrictlyOutOfStockProduct = (
  product: ProductAvailabilityInput | null | undefined,
): boolean => {
  if (!product) return false;
  return Number(product.totalStock ?? 0) <= 0 && !canBagWhenOutOfStock(product);
};

export const getProductStockState = (
  product: ProductAvailabilityInput | null | undefined,
): ProductStockState => {
  if (!product) return "OUT_OF_STOCK";
  if (isCustomOrderOnlyProduct(product)) return "CUSTOM_ORDER_ONLY";
  const totalStock = Number(product.totalStock ?? 0);
  if (totalStock <= 0) return "OUT_OF_STOCK";
  if (totalStock <= 5) return "LOW_STOCK";
  return "IN_STOCK";
};
