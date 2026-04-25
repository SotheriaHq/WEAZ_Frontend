import React, { useRef, useMemo } from 'react';
import { 
  X, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  Package,
  CheckCircle
} from 'lucide-react';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import VLoader from '@/components/loaders/VLoader';
import { useFocusTrap } from '@/hooks/useFocusTrap';

/**
 * Price Change Preview Modal (Item #8 Frontend)
 * 
 * Shows how a product price change affects collection price ranges.
 * Used before confirming price updates to show impact across collections.
 * 
 * USAGE:
 * const { data } = useMutation(['price-preview'], (price) =>
 *   storeApi.getProductPriceChangePreview(productId, price)
 * );
 * <PriceChangePreviewModal
 *   isOpen={showPreview}
 *   productName="Summer Dress"
 *   currentPrice={15000}
 *   newPrice={12000}
 *   currency="NGN"
 *   affectedCollections={data.affectedCollections}
 *   onConfirm={() => handleConfirmPriceChange()}
 *   onClose={() => setShowPreview(false)}
 * />
 */

interface CollectionPriceImpact {
  collectionId: string;
  collectionTitle: string;
  currentMinPrice: number | null;
  currentMaxPrice: number | null;
  newMinPrice: number | null;
  newMaxPrice: number | null;
  productsCount: number;
  isPublished: boolean;
}

interface PriceChangePreviewModalProps {
  isOpen: boolean;
  productName: string;
  currentPrice: number;
  newPrice: number;
  currency?: string;
  affectedCollections: CollectionPriceImpact[];
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

const formatCurrency = (amount: number | null, currency: string = 'NGN') => {
  if (amount === null) return '—';
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

const formatPriceRange = (min: number | null, max: number | null, currency: string) => {
  if (!min && !max) return 'Not set';
  if (min === max || !max) return formatCurrency(min, currency);
  if (!min) return formatCurrency(max, currency);
  return `${formatCurrency(min, currency)} - ${formatCurrency(max, currency)}`;
};

const PriceChangeIndicator: React.FC<{ current: number; next: number; currency: string }> = ({
  current,
  next,
  currency,
}) => {
  const diff = next - current;
  const pctChange = current > 0 ? ((diff / current) * 100).toFixed(1) : 0;

  if (diff === 0) {
    return (
      <span className="flex items-center gap-1 text-gray-500 dark:text-zinc-400">
        <Minus className="w-3.5 h-3.5" />
        No change
      </span>
    );
  }

  const isIncrease = diff > 0;
  return (
    <span className={`flex items-center gap-1 ${isIncrease ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {isIncrease ? (
        <TrendingUp className="w-3.5 h-3.5" />
      ) : (
        <TrendingDown className="w-3.5 h-3.5" />
      )}
      {isIncrease ? '+' : ''}{formatCurrency(diff, currency)} ({isIncrease ? '+' : ''}{pctChange}%)
    </span>
  );
};

const CollectionImpactCard: React.FC<{
  collection: CollectionPriceImpact;
  currency: string;
}> = ({ collection, currency }) => {
  const minChanged = collection.currentMinPrice !== collection.newMinPrice;
  const maxChanged = collection.currentMaxPrice !== collection.newMaxPrice;
  const hasChange = minChanged || maxChanged;

  return (
    <div className={`border rounded-xl p-4 ${
      hasChange 
        ? 'border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10' 
        : 'border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/30'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900 dark:text-white truncate">
              {collection.collectionTitle}
            </h4>
            {collection.isPublished ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                LIVE
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400">
                DRAFT
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
            {collection.productsCount} product{collection.productsCount !== 1 ? 's' : ''}
          </p>
        </div>
        {hasChange && (
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Current Range</div>
          <div className="font-medium text-gray-700 dark:text-zinc-300">
            {formatPriceRange(collection.currentMinPrice, collection.currentMaxPrice, currency)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-zinc-500 mb-1">New Range</div>
          <div className={`font-medium ${hasChange ? 'text-amber-700 dark:text-amber-300' : 'text-gray-700 dark:text-zinc-300'}`}>
            {formatPriceRange(collection.newMinPrice, collection.newMaxPrice, currency)}
          </div>
        </div>
      </div>
    </div>
  );
};

export const PriceChangePreviewModal: React.FC<PriceChangePreviewModalProps> = ({
  isOpen,
  productName,
  currentPrice,
  newPrice,
  currency = 'NGN',
  affectedCollections,
  isLoading,
  onConfirm,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isConfirming, setIsConfirming] = React.useState(false);

  useFocusTrap({
    active: isOpen,
    containerRef: dialogRef,
    onEscape: onClose,
  });

  const stats = useMemo(() => {
    const published = affectedCollections.filter(c => c.isPublished);
    const affected = affectedCollections.filter(c => 
      c.currentMinPrice !== c.newMinPrice || c.currentMaxPrice !== c.newMaxPrice
    );
    return {
      total: affectedCollections.length,
      published: published.length,
      affected: affected.length,
    };
  }, [affectedCollections]);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsConfirming(false);
    }
  };

  if (!isOpen) return null;

  const priceIncreasing = newPrice > currentPrice;
  const priceDecreasing = newPrice < currentPrice;

  return (
    <OverlayPortal>
      <div 
        className="fixed inset-0 z-layer-modal flex items-center justify-center p-4" 
        role="dialog" 
        aria-modal="true"
        aria-labelledby="price-preview-title"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />

        {/* Modal */}
        <div 
          ref={dialogRef}
          tabIndex={-1}
          className="relative w-full max-w-lg neu-modal-surface bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden outline-none flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex-shrink-0 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-6 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                  priceIncreasing 
                    ? 'bg-green-100 dark:bg-green-900/30' 
                    : priceDecreasing 
                    ? 'bg-red-100 dark:bg-red-900/30'
                    : 'bg-gray-100 dark:bg-zinc-800'
                }`}>
                  <DollarSign className={`w-5 h-5 ${
                    priceIncreasing 
                      ? 'text-green-600 dark:text-green-400' 
                      : priceDecreasing 
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-500 dark:text-zinc-400'
                  }`} />
                </div>
                <div>
                  <h2 id="price-preview-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                    Price Change Preview
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
                    {productName}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
              </button>
            </div>
          </div>

          {/* Price change summary */}
          <div className="flex-shrink-0 bg-gray-50 dark:bg-zinc-800/50 px-6 py-4 border-b border-gray-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="text-center flex-1">
                <div className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Current Price</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatCurrency(currentPrice, currency)}
                </div>
              </div>
              <div className="px-4">
                {priceIncreasing ? (
                  <TrendingUp className="w-6 h-6 text-green-500" />
                ) : priceDecreasing ? (
                  <TrendingDown className="w-6 h-6 text-red-500" />
                ) : (
                  <Minus className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div className="text-center flex-1">
                <div className="text-xs text-gray-500 dark:text-zinc-500 mb-1">New Price</div>
                <div className={`text-lg font-bold ${
                  priceIncreasing 
                    ? 'text-green-600 dark:text-green-400' 
                    : priceDecreasing 
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {formatCurrency(newPrice, currency)}
                </div>
              </div>
            </div>
            <div className="text-center mt-2">
              <PriceChangeIndicator current={currentPrice} next={newPrice} currency={currency} />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="animate-pulse border rounded-xl p-4">
                    <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : affectedCollections.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-10 h-10 text-gray-300 dark:text-zinc-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-zinc-400">
                  This product is not in any collections
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Stats summary */}
                <div className="flex items-center justify-between text-sm bg-gray-50 dark:bg-zinc-800/50 rounded-lg px-4 py-3">
                  <span className="text-gray-600 dark:text-zinc-400">
                    Found in {stats.total} collection{stats.total !== 1 ? 's' : ''}
                  </span>
                  {stats.affected > 0 && (
                    <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {stats.affected} will update
                    </span>
                  )}
                </div>

                {/* Collection list */}
                <div className="space-y-3">
                  {affectedCollections.map(collection => (
                    <CollectionImpactCard
                      key={collection.collectionId}
                      collection={collection}
                      currency={currency}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-200 dark:border-zinc-800 px-6 py-4">
            {stats.affected > 0 && stats.published > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3 mb-4">
                <p className="text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Note:</strong> This will update price ranges on {stats.published} published collection{stats.published !== 1 ? 's' : ''}. 
                    Customers may see the new prices immediately.
                  </span>
                </p>
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isConfirming}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isConfirming ? (
                  <>
                    <VLoader size={16} phase="loading" showLabel={false} />
                    Updating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Confirm Change
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default PriceChangePreviewModal;
