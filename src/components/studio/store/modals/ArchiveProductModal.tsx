import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { productApi } from '@/api/ProductApi';

// ═══════════════════════════════════════════════════════════════════════════════
// ARCHIVE PRODUCT MODAL
// Informs user about 60-day auto-delete and 7-day reminders
// ═══════════════════════════════════════════════════════════════════════════════

interface ArchiveProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onArchived: () => void;
  product: {
    id: string;
    name: string;
    images?: string[];
    thumbnail?: string | null;
    archivedAt?: string | null;
  } | null;
  mode?: 'archive' | 'unarchive';
}

const ArchiveProductModal: React.FC<ArchiveProductModalProps> = ({
  isOpen,
  onClose,
  onArchived,
  product,
  mode = 'archive',
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset error when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen]);

  const handleArchive = async () => {
    if (!product?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      if (mode === 'archive') {
        await productApi.archiveProduct(product.id);
        toast.success(`"${product.name}" has been archived`);
      } else {
        await productApi.unarchiveProduct(product.id);
        toast.success(`"${product.name}" has been restored`);
      }
      onArchived();
      onClose();
    } catch (e: any) {
      const message = e?.response?.data?.message || `Failed to ${mode} product`;
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !product) return null;

  const productImage = product.thumbnail || product.images?.[0];
  const isArchiving = mode === 'archive';

  // Calculate days until auto-delete if already archived
  const daysUntilDelete = product.archivedAt
    ? Math.max(0, 60 - Math.floor((Date.now() - new Date(product.archivedAt).getTime()) / (1000 * 60 * 60 * 24)))
    : 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-start gap-4">
            {/* Product thumbnail */}
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-zinc-800 flex-shrink-0">
              {productImage ? (
                <img src={productImage} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {isArchiving ? 'Archive Product' : 'Restore Product'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-0.5">{product.name}</p>
            </div>
            {/* Close button */}
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
          {isArchiving ? (
            <>
              {/* Archive explanation */}
              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
                  <span className="text-4xl">📦</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  Archiving hides this product from your store but keeps it accessible for orders in progress.
                </p>
              </div>

              {/* Info cards */}
              <div className="space-y-3">
                {/* Auto-delete warning */}
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⏰</span>
                    <div>
                      <p className="font-semibold text-amber-800 dark:text-amber-200">60-Day Auto-Delete</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        Archived products are automatically deleted after 60 days. 
                        You'll receive reminders every 7 days.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Order history note */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">📋</span>
                    <div>
                      <p className="font-semibold text-blue-800 dark:text-blue-200">Visible in Order History</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Customers who ordered this product can still see it in their order history.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Restore option */}
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">↩️</span>
                    <div>
                      <p className="font-semibold text-emerald-800 dark:text-emerald-200">Easy to Restore</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                        You can restore this product anytime before the 60-day period ends. 
                        Working on it resets the timer.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Unarchive explanation */}
              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
                  <span className="text-4xl">↩️</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  Restoring this product will make it visible in your store again.
                </p>
              </div>

              {/* Days remaining warning */}
              {product.archivedAt && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-xl mb-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⏰</span>
                    <div>
                      <p className="font-semibold text-amber-800 dark:text-amber-200">
                        {daysUntilDelete} days until auto-delete
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        Restoring now will cancel the auto-delete schedule.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">ℹ️</span>
                  <div>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      The product will be restored as a <strong>draft</strong>. 
                      You can publish it when you're ready.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

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
            onClick={handleArchive}
            disabled={loading}
            className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
              isArchiving
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-emerald-500 text-white hover:bg-emerald-600'
            }`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isArchiving ? 'Archiving...' : 'Restoring...'}
              </>
            ) : (
              <>
                {isArchiving ? '📦 Archive Product' : '↩️ Restore Product'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArchiveProductModal;
