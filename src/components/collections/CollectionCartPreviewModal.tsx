import React, { useRef, useState, useCallback, useMemo } from 'react';
import { 
  X, 
  ShoppingCart, 
  AlertCircle, 
  CheckCircle, 
  Package, 
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import MediaRenderer from '@/components/media/MediaRenderer';

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
  variantAvailability?: {
    available: number;
    total: number;
  };
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

const ProductCard: React.FC<{
  product: CartPreviewProduct;
  isSelected: boolean;
  onToggle: () => void;
}> = ({ product, isSelected, onToggle }) => {
  const [expanded, setExpanded] = useState(false);
  const hasVariants = product.variants && product.variants.length > 0;
  const availableVariants = hasVariants 
    ? product.variants!.filter(v => v.stock > 0).length 
    : 0;

  const displayPrice = product.salePrice || product.price;
  const isOnSale = product.salePrice && product.salePrice < product.price;

  return (
    <div
      className={`border rounded-xl overflow-hidden transition-all ${
        !product.isAvailable
          ? 'border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/30 opacity-60'
          : isSelected
          ? 'border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/10 shadow-sm'
          : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:border-gray-300 dark:hover:border-zinc-600'
      }`}
    >
      <div className="p-3 flex items-start gap-3">
        {/* Checkbox / Status */}
        <div className="flex-shrink-0 pt-1">
          {product.isAvailable ? (
            <button
              onClick={onToggle}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                isSelected
                  ? 'border-purple-600 bg-purple-600'
                  : 'border-gray-300 dark:border-zinc-600 hover:border-purple-400'
              }`}
            >
              {isSelected && (
                <CheckCircle className="w-3.5 h-3.5 text-white" />
              )}
            </button>
          ) : (
            <div className="w-5 h-5 rounded border-2 border-gray-200 dark:border-zinc-700 flex items-center justify-center">
              <AlertCircle className="w-3 h-3 text-gray-400 dark:text-zinc-500" />
            </div>
          )}
        </div>

        {/* Thumbnail */}
        <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-zinc-700">
          {product.thumbnail || (product.images && product.images[0]) ? (
            <MediaRenderer
              kind="image"
              src={product.thumbnail || product.images![0]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-6 h-6 text-gray-400 dark:text-zinc-500" />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate">
            {product.name}
          </h4>
          
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-sm font-semibold ${isOnSale ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
              {formatCurrency(displayPrice, product.currency)}
            </span>
            {isOnSale && (
              <span className="text-xs text-gray-400 dark:text-zinc-500 line-through">
                {formatCurrency(product.price, product.currency)}
              </span>
            )}
          </div>

          {/* Availability status */}
          {!product.isAvailable && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500 dark:text-zinc-400">
              <AlertTriangle className="w-3 h-3" />
              <span>{product.unavailableReason || 'Unavailable'}</span>
            </div>
          )}

          {/* Variant summary */}
          {hasVariants && product.isAvailable && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 mt-1.5 text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300"
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
        <div className="border-t border-gray-100 dark:border-zinc-700/50 px-3 py-2 bg-gray-50/50 dark:bg-zinc-800/30">
          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
            {product.variants!.map((v, idx) => (
              <div
                key={idx}
                className={`text-xs px-2 py-1.5 rounded ${
                  v.stock > 0
                    ? 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300'
                    : 'bg-gray-100 dark:bg-zinc-900 text-gray-400 dark:text-zinc-500 line-through'
                }`}
              >
                {[v.size, v.color].filter(Boolean).join(' / ') || 'Default'} 
                <span className="ml-1 opacity-70">({v.stock})</span>
              </div>
            ))}
          </div>
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
  const [isAdding, setIsAdding] = useState(false);

  useFocusTrap({
    active: isOpen,
    containerRef: dialogRef,
    onEscape: onClose,
  });

  // Initialize selection with all available products
  React.useEffect(() => {
    if (previewData) {
      const availableIds = previewData.products
        .filter(p => p.isAvailable)
        .map(p => p.id);
      setSelectedIds(new Set(availableIds));
    }
  }, [previewData]);

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
  }, []);

  const selectAll = useCallback(() => {
    if (previewData) {
      const availableIds = previewData.products
        .filter(p => p.isAvailable)
        .map(p => p.id);
      setSelectedIds(new Set(availableIds));
    }
  }, [previewData]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedProducts = useMemo(() => {
    if (!previewData) return [];
    return previewData.products.filter(p => selectedIds.has(p.id));
  }, [previewData, selectedIds]);

  const selectedTotal = useMemo(() => {
    return selectedProducts.reduce((sum, p) => sum + (p.salePrice || p.price), 0);
  }, [selectedProducts]);

  const handleAddToCart = useCallback(async () => {
    if (selectedProducts.length === 0) return;
    
    setIsAdding(true);
    try {
      const toAdd: SelectedProduct[] = selectedProducts.map(p => ({
        productId: p.id,
        quantity: 1,
      }));
      await onAddToCart(toAdd);
      onClose();
    } finally {
      setIsAdding(false);
    }
  }, [selectedProducts, onAddToCart, onClose]);

  if (!isOpen) return null;

  const availableProducts = previewData?.products.filter(p => p.isAvailable) || [];
  const unavailableProducts = previewData?.products.filter(p => !p.isAvailable) || [];
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
          className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden outline-none flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex-shrink-0 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-6 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="cart-preview-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                  Add Collection to Cart
                </h2>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
                  {collection.title}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
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
                  <span className="text-gray-600 dark:text-zinc-400">
                    {previewData.availableCount} of {previewData.totalProducts} items available
                  </span>
                  <button
                    onClick={allSelected ? deselectAll : selectAll}
                    className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {/* Available products */}
                {availableProducts.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-zinc-500 flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      Available ({availableProducts.length})
                    </h3>
                    <div className="space-y-2">
                      {availableProducts.map(product => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          isSelected={selectedIds.has(product.id)}
                          onToggle={() => toggleProduct(product.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Unavailable products */}
                {unavailableProducts.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-zinc-500 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
                      Unavailable ({unavailableProducts.length})
                    </h3>
                    <div className="space-y-2">
                      {unavailableProducts.map(product => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          isSelected={false}
                          onToggle={() => {}}
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
          <div className="flex-shrink-0 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-200 dark:border-zinc-800 px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-gray-600 dark:text-zinc-400">
                {selectedIds.size} items selected
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500 dark:text-zinc-500">Subtotal</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatCurrency(selectedTotal, previewData?.currency || 'NGN')}
                </div>
              </div>
            </div>
            
            <button
              onClick={handleAddToCart}
              disabled={selectedIds.size === 0 || isAdding}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {isAdding ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
