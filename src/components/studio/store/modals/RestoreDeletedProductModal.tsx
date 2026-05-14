import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { productApi } from '@/api/ProductApi';
import VLoader from '@/components/loaders/VLoader';
import MediaRenderer from '@/components/media/MediaRenderer';

// ═══════════════════════════════════════════════════════════════════════════════
// RESTORE DELETED PRODUCT MODAL
// Guides users through restoring a soft-deleted product (30-day grace period)
// ═══════════════════════════════════════════════════════════════════════════════

interface RestoreDeletedProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestored: () => void;
  product: {
    id: string;
    name: string;
    images?: string[];
    thumbnail?: string | null;
    deletedAt?: string | null;
  } | null;
}

const RestoreDeletedProductModal: React.FC<RestoreDeletedProductModalProps> = ({
  isOpen,
  onClose,
  onRestored,
  product,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const productImage = product.thumbnail || product.images?.[0];
  const deletedAt = product.deletedAt ? new Date(product.deletedAt) : null;
  const daysSinceDelete = deletedAt
    ? Math.floor((Date.now() - deletedAt.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const daysRemaining = daysSinceDelete !== null ? Math.max(0, 30 - daysSinceDelete) : null;

  const handleRestore = async () => {
    if (!product?.id) return;

    setLoading(true);
    setError(null);
    try {
      await productApi.restoreProduct(product.id);
      toast.success(`"${product.name}" has been restored`);
      onRestored();
      onClose();
    } catch (e: any) {
      const message = e?.response?.data?.message || 'Failed to restore product';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-layer-modal flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 neu-modal-surface bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-zinc-800 flex-shrink-0">
              {productImage ? (
                <MediaRenderer
                  kind="image"
                  src={productImage}
                  alt={product.name}
                  fit="cover"
                  className="h-full w-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Restore Product</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-0.5">{product.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 -m-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <span className="text-xl">✕</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-20 h-20 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
              <span className="text-4xl">↩️</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Restoring will bring this product back as a <strong>draft</strong>.
            </p>
          </div>

          <div className="space-y-3">
            {daysRemaining !== null && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⏰</span>
                  <div>
                    <p className="font-semibold text-amber-800 dark:text-amber-200">
                      {daysRemaining} days remaining
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Deleted products are permanently removed after 30 days.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/30 rounded-xl">
              <div className="flex items-start gap-3">
                <span className="text-2xl">ℹ️</span>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  You can edit and publish the product after restoring.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700/30 rounded-xl text-sm text-rose-600 dark:text-rose-300 text-center">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-zinc-800/30 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-zinc-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRestore}
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 bg-emerald-500 text-white hover:bg-emerald-600"
          >
            {loading ? (
              <>
                <VLoader size={16} phase="loading" showLabel={false} />
                Restoring...
              </>
            ) : (
              <>↩️ Restore Product</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RestoreDeletedProductModal;
