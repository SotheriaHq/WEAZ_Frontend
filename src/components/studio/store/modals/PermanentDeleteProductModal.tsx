import React, { useState } from 'react';
import { toast } from 'sonner';
import { productApi } from '@/api/ProductApi';

interface PermanentDeleteProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
  product: {
    id: string;
    name: string;
    images?: string[];
    thumbnail?: string | null;
  } | null;
}

const PermanentDeleteProductModal: React.FC<PermanentDeleteProductModalProps> = ({
  isOpen,
  onClose,
  onDeleted,
  product,
}) => {
  const [loading, setLoading] = useState(false);

  if (!isOpen || !product) return null;

  const productImage = product.thumbnail || product.images?.[0];

  const handleDelete = async () => {
    setLoading(true);
    try {
      await productApi.permanentlyDeleteProduct(product.id);
      toast.success('Product permanently deleted');
      onDeleted();
      onClose();
    } catch (e: any) {
      const message = e?.response?.data?.message || 'Failed to permanently delete product';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        <div className="p-6 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-zinc-800 flex-shrink-0">
              {productImage ? (
                <img src={productImage} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">🗑️</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Permanent Delete</h2>
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

        <div className="p-6 space-y-4">
          <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700/30 rounded-xl">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-semibold text-rose-800 dark:text-rose-200">This cannot be undone</p>
                <p className="text-sm text-rose-700 dark:text-rose-300 mt-1">
                  This product will be removed permanently from your store, including its media and history.
                </p>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            If you only want to hide the product, use Archive instead.
          </p>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-zinc-800/30 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-zinc-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 bg-rose-600 text-white hover:bg-rose-700"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <>🗑️ Delete Forever</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermanentDeleteProductModal;
