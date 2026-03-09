import React, { useRef, useState, useCallback, useMemo } from 'react';
import { 
  X, 
  ShoppingCart, 
  AlertCircle, 
  CheckCircle, 
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import VLoader from '@/components/loaders/VLoader';
import { Select } from '@/components/ui/Select';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import ImageWithFallback from '@/components/ImageWithFallback';

/**
 * Collection Cart Preview Modal (Item #3 Frontend)
 * 
 * Shows which items from a collection can/cannot be added to cart.
 * Allows users to review availability before bulk-adding to cart.
 * 
 * USAGE:
 * const { data } = useQuery(['cart-preview', collectionId], () => 
 *   collectionsApi.getCartPreview(collectionId)
 * );
 * <CollectionCartPreviewModal
 *   isOpen={showPreview}
 *   collection={{ id: '...', title: '...' }}
 *   previewData={data}
 *   onAddToCart={(selectedProducts) => handleAddToCart(selectedProducts)}
 *   onClose={() => setShowPreview(false)}
 * />
 */

interface ProductVariant {
  size?: string;
  color?: string;
  stock: number;
  price?: number;
}

interface CartPreviewProduct {
  id: string;
  name: string;
  price: number;
  salePrice?: number | null;
  currency: string;
  thumbnail?: string | null;
  images?: string[];
  isAvailable: boolean;
  unavailableReason?: string;
  variants?: ProductVariant[];
  sizes?: string[];
  colors?: string[];
  defaultSize?: string;
  defaultColor?: string;
  variantAvailability?: {
    available: number;
    total: number;
  };
}

interface ProductSelection {
  size?: string;
  color?: string;
}

interface ProductSelectionError {
  size?: string;
  color?: string;
  combination?: string;
}

interface ProductOptionModel {
  sizeOptions: string[];
  colorOptions: string[];
  sizeByColor: Map<string, Set<string>>;
  colorBySize: Map<string, Set<string>>;
}

interface CollectionCartPreviewData {
  collectionId: string;
  collectionTitle: string;
  totalProducts: number;
  availableCount: number;
  unavailableCount: number;
  totalPrice: number;
  currency: string;
  products: CartPreviewProduct[];
}

interface SelectedProduct {
  productId: string;
  quantity: number;
  variantSize?: string;
  variantColor?: string;
}

interface CollectionCartPreviewModalProps {
  isOpen: boolean;
  collection: { id: string; title: string };
  previewData: CollectionCartPreviewData | null;
  isLoading?: boolean;
  onAddToCart: (products: SelectedProduct[]) => void | Promise<void>;
  onClose: () => void;
}

const formatCurrency = (amount: number, currency: string = 'NGN') => {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'NGN' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
};

const isRemoteMediaValue = (value?: string | null): boolean => {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  return (
    normalized.startsWith('http') ||
    normalized.startsWith('/') ||
    normalized.startsWith('data:') ||
    normalized.includes('://') ||
    normalized.includes('?')
  );
};

const toRenderableMedia = (
  value?: string | null,
): { src: string | null; fileId: string | null } => {
  const normalized = String(value || '').trim();
  if (!normalized) return { src: null, fileId: null };
  return isRemoteMediaValue(normalized)
    ? { src: normalized, fileId: null }
    : { src: null, fileId: normalized };
};

const toUniqueValues = (values: Array<string | null | undefined>): string[] => {
  const normalized = values
    .map((value) => String(value || '').trim())
    .filter((value) => value.length > 0);
  return [...new Set(normalized)];
};

const buildProductOptionModel = (product: CartPreviewProduct): ProductOptionModel => {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const inStockVariants = variants.filter((variant) => Number(variant.stock) > 0);
  const fallbackVariants = inStockVariants.length > 0 ? inStockVariants : variants;

  const sizeOptions = toUniqueValues([
    ...fallbackVariants.map((variant) => variant.size),
    ...(Array.isArray(product.sizes) ? product.sizes : []),
  ]);
  const colorOptions = toUniqueValues([
    ...fallbackVariants.map((variant) => variant.color),
    ...(Array.isArray(product.colors) ? product.colors : []),
  ]);

  const sizeByColor = new Map<string, Set<string>>();
  const colorBySize = new Map<string, Set<string>>();
  for (const variant of fallbackVariants) {
    const size = String(variant.size || '').trim();
    const color = String(variant.color || '').trim();
    if (!size || !color) continue;
    if (!sizeByColor.has(color)) sizeByColor.set(color, new Set<string>());
    if (!colorBySize.has(size)) colorBySize.set(size, new Set<string>());
    sizeByColor.get(color)?.add(size);
    colorBySize.get(size)?.add(color);
  }

  return {
    sizeOptions,
    colorOptions,
    sizeByColor,
    colorBySize,
  };
};

const isCombinationAllowed = (
  optionModel: ProductOptionModel,
  size?: string,
  color?: string,
): boolean => {
  if (!size || !color) return true;
  const hasPairConstraints =
    optionModel.colorBySize.size > 0 || optionModel.sizeByColor.size > 0;
  if (!hasPairConstraints) return true;
  const colorsForSize = optionModel.colorBySize.get(size);
  return colorsForSize ? colorsForSize.has(color) : false;
};

const getInitialSelection = (
  product: CartPreviewProduct,
  optionModel: ProductOptionModel,
): ProductSelection => {
  const initial: ProductSelection = {};
  if (optionModel.sizeOptions.length === 1) {
    initial.size = optionModel.sizeOptions[0];
  } else if (
    product.defaultSize &&
    optionModel.sizeOptions.includes(product.defaultSize)
  ) {
    initial.size = product.defaultSize;
  }

  if (optionModel.colorOptions.length === 1) {
    initial.color = optionModel.colorOptions[0];
  } else if (
    product.defaultColor &&
    optionModel.colorOptions.includes(product.defaultColor)
  ) {
    initial.color = product.defaultColor;
  }

  if (!isCombinationAllowed(optionModel, initial.size, initial.color)) {
    initial.color = undefined;
  }

  return initial;
};

const ProductCard: React.FC<{
  product: CartPreviewProduct;
  isSelected: boolean;
  onToggle: () => void;
  optionModel: ProductOptionModel;
  selection?: ProductSelection;
  selectionError?: ProductSelectionError;
  onSelectionChange: (selection: ProductSelection) => void;
}> = ({
  product,
  isSelected,
  onToggle,
  optionModel,
  selection,
  selectionError,
  onSelectionChange,
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasVariants = product.variants && product.variants.length > 0;
  const availableVariants = hasVariants
    ? product.variants!.filter((v) => v.stock > 0).length
    : 0;

  const displayPrice = product.salePrice || product.price;
  const isOnSale = product.salePrice && product.salePrice < product.price;
  const primaryMedia = toRenderableMedia(
    product.thumbnail || product.images?.[0] || null,
  );
  const requiresSize = optionModel.sizeOptions.length > 0;
  const requiresColor = optionModel.colorOptions.length > 0;
  const availableSizeOptions = useMemo(() => {
    if (!selection?.color) return optionModel.sizeOptions;
    const sizesForColor = optionModel.sizeByColor.get(selection.color);
    if (!sizesForColor || sizesForColor.size === 0) return optionModel.sizeOptions;
    return optionModel.sizeOptions.filter((size) => sizesForColor.has(size));
  }, [optionModel, selection?.color]);
  const availableColorOptions = useMemo(() => {
    if (!selection?.size) return optionModel.colorOptions;
    const colorsForSize = optionModel.colorBySize.get(selection.size);
    if (!colorsForSize || colorsForSize.size === 0) return optionModel.colorOptions;
    return optionModel.colorOptions.filter((color) => colorsForSize.has(color));
  }, [optionModel, selection?.size]);

  return (
    <div
      className={`overflow-hidden rounded-2xl border transition-all ${
        !product.isAvailable
          ? 'border-[color:var(--border-strong)] bg-[color:var(--surface-muted)]/80 opacity-80'
          : isSelected
          ? 'border-[color:rgba(var(--brand-primary-rgb),0.35)] bg-[color:rgba(var(--brand-primary-rgb),0.08)] shadow-sm shadow-[rgba(var(--brand-primary-rgb),0.16)]'
          : 'border-[color:var(--border-strong)] bg-[color:var(--surface-primary)] hover:border-[color:rgba(var(--brand-primary-rgb),0.3)]'
      }`}
    >
      <div className="flex items-start gap-2.5 p-2.5">
        {/* Checkbox / Status */}
        <div className="flex-shrink-0 pt-0.5">
          {product.isAvailable ? (
            <button
              onClick={onToggle}
              className={`flex h-4 w-4 items-center justify-center rounded border-2 transition-all ${
                isSelected
                  ? 'border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)]'
                  : 'border-[color:var(--border-strong)] hover:border-[color:var(--brand-primary)]'
              }`}
            >
              {isSelected && <CheckCircle className="h-3 w-3 text-white" />}
            </button>
          ) : (
            <div className="flex h-4 w-4 items-center justify-center rounded border-2 border-[color:var(--border-strong)]">
              <AlertCircle className="h-3 w-3 text-[color:var(--text-secondary)]" />
            </div>
          )}
        </div>

        {/* Thumbnail */}
        <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-secondary)]">
          <ImageWithFallback
            src={primaryMedia.src}
            fileId={primaryMedia.fileId}
            alt={product.name}
            fit="cover"
            className="h-full w-full object-cover"
            containerClassName="h-full w-full"
            rounded="none"
            fallbackName={product.name}
          />
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <h4 className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
            {product.name}
          </h4>

          <div className="mt-0.5 flex items-baseline gap-2">
            <span
              className={`text-sm font-bold ${isOnSale ? 'text-rose-600 dark:text-rose-300' : 'text-[color:var(--text-primary)]'}`}
            >
              {formatCurrency(displayPrice, product.currency)}
            </span>
            {isOnSale && (
              <span className="text-xs text-[color:var(--text-secondary)] line-through">
                {formatCurrency(product.price, product.currency)}
              </span>
            )}
          </div>

          <div className="mt-1">
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                product.isAvailable
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
              }`}
            >
              {product.isAvailable ? 'Ready' : 'Unavailable'}
            </span>
          </div>

          {/* Availability status */}
          {!product.isAvailable && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-[color:var(--text-secondary)]">
              <AlertTriangle className="h-3 w-3" />
              <span>{product.unavailableReason || 'Unavailable'}</span>
            </div>
          )}

          {/* Variant summary */}
          {hasVariants && product.isAvailable && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 flex items-center gap-1 text-xs font-medium text-[color:var(--text-secondary)] hover:text-[color:var(--brand-primary)]"
            >
              <span>{availableVariants} of {product.variants!.length} variants in stock</span>
              {expanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expanded variants */}
      {expanded && hasVariants && (
        <div className="border-t border-[color:var(--border-strong)] bg-[color:var(--surface-secondary)] px-2.5 py-2">
          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
            {product.variants!.map((v, idx) => (
              <div
                key={idx}
                className={`text-xs px-2 py-1.5 rounded ${
                  v.stock > 0
                    ? 'bg-[color:var(--surface-primary)] text-[color:var(--text-primary)]'
                    : 'bg-[color:var(--surface-muted)] text-[color:var(--text-secondary)] line-through'
                }`}
              >
                {[v.size, v.color].filter(Boolean).join(' / ') || 'Default'}
                <span className="ml-1 opacity-70">({v.stock})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {product.isAvailable && isSelected && (requiresSize || requiresColor) && (
        <div className="border-t border-[color:var(--border-strong)] bg-[color:rgba(var(--brand-primary-rgb),0.04)] px-2.5 py-2">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {requiresSize && (
              <label className="text-[11px] text-[color:var(--text-secondary)]">
                <span className="mb-0.5 block">Size</span>
                <Select
                  variant="compact"
                  value={selection?.size || ''}
                  onChange={(event) => {
                    const nextSize = String(event.target.value || '').trim() || undefined;
                    const nextSelection: ProductSelection = {
                      size: nextSize,
                      color: selection?.color,
                    };
                    if (
                      nextSelection.color &&
                      !isCombinationAllowed(
                        optionModel,
                        nextSelection.size,
                        nextSelection.color,
                      )
                    ) {
                      nextSelection.color = undefined;
                    }
                    onSelectionChange(nextSelection);
                  }}
                >
                  <option value="">Select size</option>
                  {availableSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </Select>
                {selectionError?.size && (
                  <span className="mt-1 block text-[11px] text-rose-600 dark:text-rose-300">
                    {selectionError.size}
                  </span>
                )}
              </label>
            )}
            {requiresColor && (
              <label className="text-[11px] text-[color:var(--text-secondary)]">
                <span className="mb-0.5 block">Color</span>
                <Select
                  variant="compact"
                  value={selection?.color || ''}
                  onChange={(event) => {
                    const nextColor =
                      String(event.target.value || '').trim() || undefined;
                    const nextSelection: ProductSelection = {
                      size: selection?.size,
                      color: nextColor,
                    };
                    if (
                      nextSelection.size &&
                      !isCombinationAllowed(
                        optionModel,
                        nextSelection.size,
                        nextSelection.color,
                      )
                    ) {
                      nextSelection.size = undefined;
                    }
                    onSelectionChange(nextSelection);
                  }}
                >
                  <option value="">Select color</option>
                  {availableColorOptions.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </Select>
                {selectionError?.color && (
                  <span className="mt-1 block text-[11px] text-rose-600 dark:text-rose-300">
                    {selectionError.color}
                  </span>
                )}
              </label>
            )}
          </div>
          {selectionError?.combination && (
            <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-300">
              {selectionError.combination}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export const CollectionCartPreviewModal: React.FC<CollectionCartPreviewModalProps> = ({
  isOpen,
  collection,
  previewData,
  isLoading,
  onAddToCart,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [productSelections, setProductSelections] = useState<
    Record<string, ProductSelection>
  >({});
  const [selectionErrors, setSelectionErrors] = useState<
    Record<string, ProductSelectionError>
  >({});
  const [isAdding, setIsAdding] = useState(false);

  useFocusTrap({
    active: isOpen,
    containerRef: dialogRef,
    onEscape: onClose,
  });

  const previewProducts = useMemo(
    () =>
      Array.isArray(previewData?.products) ? previewData.products : [],
    [previewData?.products],
  );

  const productOptionModels = useMemo(() => {
    const models = new Map<string, ProductOptionModel>();
    for (const product of previewProducts) {
      models.set(product.id, buildProductOptionModel(product));
    }
    return models;
  }, [previewProducts]);

  // Initialize selection with all available products
  React.useEffect(() => {
    if (previewData) {
      const availableProducts = previewProducts
        .filter(p => p.isAvailable)
      const availableIds = availableProducts.map(p => p.id);
      setSelectedIds(new Set(availableIds));
      const initialSelections: Record<string, ProductSelection> = {};
      for (const product of availableProducts) {
        const optionModel =
          productOptionModels.get(product.id) || buildProductOptionModel(product);
        initialSelections[product.id] = getInitialSelection(product, optionModel);
      }
      setProductSelections(initialSelections);
      setSelectionErrors({});
    } else {
      setSelectedIds(new Set());
      setProductSelections({});
      setSelectionErrors({});
    }
  }, [previewData, previewProducts, productOptionModels]);

  const toggleProduct = useCallback((productId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
    setSelectionErrors((prev) => {
      if (!prev[productId]) return prev;
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (previewData) {
      const availableProducts = previewProducts
        .filter(p => p.isAvailable)
      const availableIds = availableProducts.map(p => p.id);
      setSelectedIds(new Set(availableIds));
      setProductSelections((prev) => {
        const next = { ...prev };
        for (const product of availableProducts) {
          if (next[product.id]) continue;
          const optionModel =
            productOptionModels.get(product.id) || buildProductOptionModel(product);
          next[product.id] = getInitialSelection(product, optionModel);
        }
        return next;
      });
      setSelectionErrors({});
    }
  }, [previewData, previewProducts, productOptionModels]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionErrors({});
  }, []);

  const selectedProducts = useMemo(() => {
    if (!previewData) return [];
    return previewProducts.filter((product) => selectedIds.has(product.id));
  }, [previewData, previewProducts, selectedIds]);

  const selectedTotal = useMemo(() => {
    return selectedProducts.reduce((sum, p) => sum + (p.salePrice || p.price), 0);
  }, [selectedProducts]);

  const missingSelectionCount = useMemo(() => {
    let missingCount = 0;
    for (const product of selectedProducts) {
      const optionModel =
        productOptionModels.get(product.id) || buildProductOptionModel(product);
      const selection = productSelections[product.id] || {};
      if (optionModel.sizeOptions.length > 0 && !selection.size) {
        missingCount += 1;
        continue;
      }
      if (optionModel.colorOptions.length > 0 && !selection.color) {
        missingCount += 1;
      }
    }
    return missingCount;
  }, [selectedProducts, productSelections, productOptionModels]);

  const handleAddToCart = useCallback(async () => {
    if (selectedProducts.length === 0) return;

    const nextErrors: Record<string, ProductSelectionError> = {};
    for (const product of selectedProducts) {
      const optionModel =
        productOptionModels.get(product.id) || buildProductOptionModel(product);
      const selection = productSelections[product.id] || {};
      const requiresSize = optionModel.sizeOptions.length > 0;
      const requiresColor = optionModel.colorOptions.length > 0;

      if (requiresSize && !selection.size) {
        nextErrors[product.id] = {
          ...(nextErrors[product.id] || {}),
          size: 'Select a size',
        };
      }
      if (requiresColor && !selection.color) {
        nextErrors[product.id] = {
          ...(nextErrors[product.id] || {}),
          color: 'Select a color',
        };
      }
      if (
        selection.size &&
        selection.color &&
        !isCombinationAllowed(optionModel, selection.size, selection.color)
      ) {
        nextErrors[product.id] = {
          ...(nextErrors[product.id] || {}),
          combination: 'This size/color combination is not available',
        };
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setSelectionErrors(nextErrors);
      return;
    }

    setSelectionErrors({});
    setIsAdding(true);
    try {
      const toAdd: SelectedProduct[] = selectedProducts.map(p => ({
        productId: p.id,
        quantity: 1,
        variantSize: productSelections[p.id]?.size,
        variantColor: productSelections[p.id]?.color,
      }));
      await onAddToCart(toAdd);
      onClose();
    } finally {
      setIsAdding(false);
    }
  }, [selectedProducts, productSelections, productOptionModels, onAddToCart, onClose]);

  if (!isOpen) return null;

  const availableProducts = previewProducts.filter(p => p.isAvailable);
  const unavailableProducts = previewProducts.filter(p => !p.isAvailable);
  const allSelected = availableProducts.length > 0 && selectedIds.size === availableProducts.length;

  return (
    <OverlayPortal>
      <div 
        className="fixed inset-0 z-layer-modal flex items-center justify-center p-4" 
        role="dialog" 
        aria-modal="true"
        aria-labelledby="cart-preview-title"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />

        {/* Modal */}
        <div
          ref={dialogRef}
          tabIndex={-1}
          className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-primary)] shadow-2xl outline-none"
        >
          {/* Header */}
          <div className="flex-shrink-0 border-b border-[color:var(--border-strong)] bg-[color:var(--surface-primary)] px-6 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="cart-preview-title" className="text-lg font-semibold text-[color:var(--text-primary)]">
                  Add Collection to Cart
                </h2>
                <p className="mt-0.5 text-sm text-[color:var(--text-secondary)]">
                  {collection.title}
                </p>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[color:var(--surface-secondary)]"
              >
                <X className="h-5 w-5 text-[color:var(--text-secondary)]" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse flex gap-3">
                    <div className="w-5 h-5 rounded bg-gray-200 dark:bg-zinc-700" />
                    <div className="w-16 h-16 rounded-lg bg-gray-200 dark:bg-zinc-700" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : previewData ? (
              <div className="space-y-4">
                {/* Summary stats */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[color:var(--text-secondary)]">
                    {previewData.availableCount} of {previewData.totalProducts} items available
                  </span>
                  <button
                    onClick={allSelected ? deselectAll : selectAll}
                    className="font-semibold text-[color:var(--brand-primary)] hover:underline"
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {/* Available products */}
                {availableProducts.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[color:var(--text-secondary)]">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                      Available ({availableProducts.length})
                    </h3>
                    <div className="space-y-2">
                      {availableProducts.map(product => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          isSelected={selectedIds.has(product.id)}
                          onToggle={() => toggleProduct(product.id)}
                          optionModel={
                            productOptionModels.get(product.id) ||
                            buildProductOptionModel(product)
                          }
                          selection={productSelections[product.id]}
                          selectionError={selectionErrors[product.id]}
                          onSelectionChange={(nextSelection) => {
                            setProductSelections((prev) => ({
                              ...prev,
                              [product.id]: nextSelection,
                            }));
                            setSelectionErrors((prev) => {
                              if (!prev[product.id]) return prev;
                              const next = { ...prev };
                              delete next[product.id];
                              return next;
                            });
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Unavailable products */}
                {unavailableProducts.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[color:var(--text-secondary)]">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                      Unavailable ({unavailableProducts.length})
                    </h3>
                    <div className="space-y-2">
                      {unavailableProducts.map(product => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          isSelected={false}
                          onToggle={() => {}}
                          optionModel={
                            productOptionModels.get(product.id) ||
                            buildProductOptionModel(product)
                          }
                          selection={productSelections[product.id]}
                          selectionError={selectionErrors[product.id]}
                          onSelectionChange={() => {}}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="w-10 h-10 text-gray-300 dark:text-zinc-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-zinc-400">Failed to load cart preview</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-[color:var(--border-strong)] bg-[color:var(--surface-secondary)]/60 px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-[color:var(--text-secondary)]">
                {selectedIds.size} items selected
              </div>
              <div className="text-right">
                <div className="text-xs text-[color:var(--text-secondary)]">Subtotal</div>
                <div className="text-lg font-bold text-[color:var(--text-primary)]">
                  {formatCurrency(selectedTotal, previewData?.currency || 'NGN')}
                </div>
              </div>
            </div>
            {missingSelectionCount > 0 && (
              <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">
                Select required size/color for {missingSelectionCount} item
                {missingSelectionCount === 1 ? '' : 's'} before adding to cart.
              </p>
            )}
            
            <button
              onClick={handleAddToCart}
              disabled={selectedIds.size === 0 || isAdding || missingSelectionCount > 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background:
                  'linear-gradient(135deg, var(--brand-primary), var(--brand-primary-strong))',
              }}
            >
              {isAdding ? (
                <>
                  <VLoader size={16} progress={68} phase="loading" showLabel={false} />
                  Adding to Cart...
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4" />
                  Add {selectedIds.size} Items to Cart
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default CollectionCartPreviewModal;
