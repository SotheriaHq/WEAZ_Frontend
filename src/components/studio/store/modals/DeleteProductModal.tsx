import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { productApi } from '@/api/ProductApi';
import VLoader from '@/components/loaders/VLoader';

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE PRODUCT MODAL
// 3-screen flow: Impact Preview → Type Confirmation → Success
// Follows NN Group best practices for destructive actions
// ═══════════════════════════════════════════════════════════════════════════════

interface DeleteProductModalProps {
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

interface DeleteImpact {
  productName: string;
  hasActiveOrders: boolean;
  activeOrdersCount: number;
  inCarts: number;
  inWishlists: number;
  totalViews: number;
  totalThreads: number;
  canDelete: boolean;
  mustArchiveReason?: string;
}

type ModalScreen = 'impact' | 'confirm' | 'success';

const DeleteProductModal: React.FC<DeleteProductModalProps> = ({
  isOpen,
  onClose,
  onDeleted,
  product,
}) => {
  const [screen, setScreen] = useState<ModalScreen>('impact');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [impact, setImpact] = useState<DeleteImpact | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen && product) {
      setScreen('impact');
      setConfirmText('');
      setError(null);
      fetchImpact();
    }
  }, [isOpen, product?.id]);

  const fetchImpact = async () => {
    if (!product?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await productApi.getDeleteImpact(product.id);
      setImpact(response);
    } catch (e: any) {
      const message = e?.response?.data?.message || 'Failed to check delete impact';
      setError(message);
      // Fallback impact data
      setImpact({
        productName: product.name,
        hasActiveOrders: false,
        activeOrdersCount: 0,
        inCarts: 0,
        inWishlists: 0,
        totalViews: 0,
        totalThreads: 0,
        canDelete: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!product?.id || confirmText !== 'DELETE') return;
    
    setDeleting(true);
    setError(null);
    
    try {
      await productApi.deleteProduct(product.id);
      setScreen('success');
    } catch (e: any) {
      const message = e?.response?.data?.message || 'Failed to delete product';
      setError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const handleSuccessClose = () => {
    onDeleted();
    onClose();
  };

  if (!isOpen || !product) return null;

  const productImage = product.thumbnail || product.images?.[0];

  return (
    <div className="fixed inset-0 z-layer-modal flex items-center justify-center px-4 py-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={screen !== 'success' ? onClose : undefined}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md neu-modal-surface bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200 max-h-[calc(100vh-7rem)] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* SCREEN 1: Impact Preview */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {screen === 'impact' && (
          <>
            {/* Header with product preview */}
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
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Delete Product</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate whitespace-nowrap mt-0.5">
                    {String(product.name || '').replace(/\s+/g, ' ').trim()}
                  </p>
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
              {loading ? (
                <div className="py-8 text-center">
                  <VLoader size={34} phase="loading" showLabel={false} className="mx-auto" />
                  <p className="text-gray-500 dark:text-gray-400 mt-3">Checking impact...</p>
                </div>
              ) : impact ? (
                <>
                  {/* Warning for active orders */}
                  {impact.hasActiveOrders && (
                    <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-xl">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">⚠️</span>
                        <div>
                          <p className="font-semibold text-amber-800 dark:text-amber-200">Cannot Delete</p>
                          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                            This product has {impact.activeOrdersCount} active order{impact.activeOrdersCount !== 1 ? 's' : ''}. 
                            You can archive it instead—buyers will still see it in their order history.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Impact stats */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Deleting this product will:
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl">
                        <div className="text-2xl mb-1">🛒</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white">{impact.inCarts}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Remove from carts</div>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl">
                        <div className="text-2xl mb-1">❤️</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white">{impact.inWishlists}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Remove from wishlists</div>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl">
                        <div className="text-2xl mb-1">👀</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white">{impact.totalViews}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Views lost</div>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl">
                        <div className="text-2xl mb-1">👍</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white">{impact.totalThreads}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Threads lost</div>
                      </div>
                    </div>

                    {/* 30-day grace period note */}
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/30 rounded-xl">
                      <div className="flex items-start gap-2">
                        <span className="text-lg">ℹ️</span>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          You have <strong>30 days</strong> to undo this action. After that, deletion is permanent.
                        </p>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700/30 rounded-xl text-sm text-rose-600 dark:text-rose-300">
                      {error}
                    </div>
                  )}
                </>
              ) : (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                  Unable to load impact data
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
              {impact?.canDelete ? (
                <button
                  onClick={() => setScreen('confirm')}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50"
                >
                  Continue to Delete
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-colors"
                >
                  Archive Instead
                </button>
              )}
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* SCREEN 2: Type Confirmation */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {screen === 'confirm' && (
          <>
            <div className="p-6 border-b border-gray-100 dark:border-white/10">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setScreen('impact')}
                  className="p-2 -m-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  <span className="text-xl">←</span>
                </button>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Confirm Deletion</h2>
              </div>
            </div>

            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mb-4">
                  <span className="text-4xl">🗑️</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  To permanently delete <strong className="text-gray-900 dark:text-white">{product.name}</strong>, 
                  type <strong className="text-rose-600">DELETE</strong> below.
                </p>
              </div>

              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="Type DELETE to confirm"
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-zinc-700 rounded-xl text-center font-mono text-lg tracking-widest focus:outline-none focus:border-rose-500 dark:focus:border-rose-500 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400"
                autoFocus
              />

              {error && (
                <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700/30 rounded-xl text-sm text-rose-600 dark:text-rose-300 text-center">
                  {error}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-zinc-800/30 flex gap-3">
              <button
                onClick={() => setScreen('impact')}
                className="flex-1 px-4 py-3 bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-zinc-600 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleDelete}
                disabled={confirmText !== 'DELETE' || deleting}
                className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <VLoader size={16} phase="loading" showLabel={false} />
                    Deleting...
                  </>
                ) : (
                  <>🗑️ Delete Permanently</>
                )}
              </button>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* SCREEN 3: Success */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {screen === 'success' && (
          <div className="p-8 text-center">
            <div className="w-20 h-20 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4 animate-in zoom-in duration-300">
              <span className="text-4xl">✅</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Product Deleted</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              <strong>{product.name}</strong> has been moved to trash. 
              You can undo this within 30 days.
            </p>
            <button
              onClick={handleSuccessClose}
              className="px-8 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeleteProductModal;
