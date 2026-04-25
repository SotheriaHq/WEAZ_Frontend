import React, { useEffect, useMemo, useState } from 'react';
import { productApi } from '@/api/ProductApi';
import VLoader from '@/components/loaders/VLoader';

interface BulkDeleteCandidate {
  id: string;
  name: string;
  thumbnail?: string | null;
  images?: string[];
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

interface BulkDeleteProductsModalProps {
  isOpen: boolean;
  mode?: 'delete' | 'permanent-delete';
  products: BulkDeleteCandidate[];
  isProcessing?: boolean;
  onClose: () => void;
  onConfirmDelete: (productIds: string[]) => Promise<void> | void;
}

type ModalScreen = 'impact' | 'confirm';

const BulkDeleteProductsModal: React.FC<BulkDeleteProductsModalProps> = ({
  isOpen,
  mode = 'delete',
  products,
  isProcessing = false,
  onClose,
  onConfirmDelete,
}) => {
  const [screen, setScreen] = useState<ModalScreen>('impact');
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [impacts, setImpacts] = useState<
    Array<{ productId: string; productName: string; impact: DeleteImpact }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const isPermanentDeleteMode = mode === 'permanent-delete';

  useEffect(() => {
    if (!isOpen) return;
    setScreen('impact');
    setConfirmText('');
    setError(null);

    const loadImpact = async () => {
      const selected = Array.isArray(products) ? products : [];
      if (selected.length === 0) {
        setImpacts([]);
        return;
      }

      if (isPermanentDeleteMode) {
        setImpacts(
          selected.map((product) => ({
            productId: product.id,
            productName: product.name,
            impact: {
              productName: product.name,
              hasActiveOrders: false,
              activeOrdersCount: 0,
              inCarts: 0,
              inWishlists: 0,
              totalViews: 0,
              totalThreads: 0,
              canDelete: true,
            },
          })),
        );
        return;
      }

      setLoadingImpact(true);
      try {
        const results = await Promise.allSettled(
          selected.map(async (product) => {
            const impact = await productApi.getDeleteImpact(product.id);
            return {
              productId: product.id,
              productName: product.name,
              impact,
            };
          }),
        );

        const mapped = results.map((result, index) => {
          const fallback = selected[index];
          if (result.status === 'fulfilled') return result.value;
          return {
            productId: fallback.id,
            productName: fallback.name,
            impact: {
              productName: fallback.name,
              hasActiveOrders: false,
              activeOrdersCount: 0,
              inCarts: 0,
              inWishlists: 0,
              totalViews: 0,
              totalThreads: 0,
              canDelete: true,
            },
          };
        });

        setImpacts(mapped);
      } catch {
        setError('Failed to check delete impact for selected products.');
      } finally {
        setLoadingImpact(false);
      }
    };

    void loadImpact();
  }, [isOpen, products, isPermanentDeleteMode]);

  const impactSummary = useMemo(() => {
    const items = Array.isArray(impacts) ? impacts : [];
    const deletable = items.filter((entry) => entry.impact?.canDelete);
    const blocked = items.filter((entry) => !entry.impact?.canDelete);

    return {
      deletableIds: deletable.map((entry) => entry.productId),
      blockedNames: blocked.map((entry) => entry.productName),
      blockedCount: blocked.length,
      inCarts: items.reduce(
        (sum, entry) => sum + Number(entry.impact?.inCarts || 0),
        0,
      ),
      inWishlists: items.reduce(
        (sum, entry) => sum + Number(entry.impact?.inWishlists || 0),
        0,
      ),
      totalViews: items.reduce(
        (sum, entry) => sum + Number(entry.impact?.totalViews || 0),
        0,
      ),
      totalThreads: items.reduce(
        (sum, entry) => sum + Number(entry.impact?.totalThreads || 0),
        0,
      ),
      activeOrdersCount: items.reduce(
        (sum, entry) => sum + Number(entry.impact?.activeOrdersCount || 0),
        0,
      ),
    };
  }, [impacts]);

  const handleConfirm = async () => {
    if (confirmText !== 'DELETE') return;
    if (impactSummary.deletableIds.length === 0) return;
    setError(null);
    try {
      await onConfirmDelete(impactSummary.deletableIds);
    } catch (e: any) {
      const message =
        e?.response?.data?.message || 'Failed to delete selected products.';
      setError(typeof message === 'string' ? message : 'Delete failed.');
    }
  };

  const isDeleteTyped = confirmText === 'DELETE';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-layer-modal flex items-center justify-center px-4 py-6">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={!isProcessing ? onClose : undefined}
        aria-label="Close bulk delete modal"
      />

      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl shadow-red-500/10 dark:shadow-red-500/20 ring-1 ring-black/5 dark:ring-white/10">

        {/* ── IMPACT SCREEN ── */}
        {screen === 'impact' && (
          <>
            {/* Header with danger accent */}
            <div className="relative px-6 pt-7 pb-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-500/10 ring-1 ring-red-200/60 dark:ring-red-500/20">
                  <span className="text-2xl">🗑️</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    {isPermanentDeleteMode ? 'Permanently Delete' : 'Delete'} {products.length} Product{products.length !== 1 ? 's' : ''}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                    {isPermanentDeleteMode
                      ? 'This permanently removes products from the deleted tab. This action is irreversible.'
                      : 'Review the impact before proceeding. This action is irreversible.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 pb-5">
              {loadingImpact ? (
                <div className="flex flex-col items-center gap-3 py-10">
                  <VLoader size={36} phase="loading" showLabel={false} />
                  <span className="text-sm text-gray-500 dark:text-zinc-400">Checking impact...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Blocked products warning */}
                  {impactSummary.blockedCount > 0 && (
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4">
                      <span className="text-xl mt-0.5">⚠️</span>
                      <div>
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                          {impactSummary.blockedCount} product{impactSummary.blockedCount === 1 ? '' : 's'} cannot be deleted
                        </p>
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300/80">
                          Active orders exist. Archive them instead.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Impact stats grid */}
                  {!isPermanentDeleteMode && (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { emoji: '🛒', label: 'In Carts', value: impactSummary.inCarts },
                      { emoji: '❤️', label: 'Wishlisted', value: impactSummary.inWishlists },
                      { emoji: '👁️', label: 'Total Views', value: impactSummary.totalViews },
                      { emoji: '🧵', label: 'Threads', value: impactSummary.totalThreads },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="flex items-center gap-3 rounded-2xl border border-gray-100 dark:border-white/[0.08] bg-gray-50/80 dark:bg-white/[0.03] p-3.5"
                      >
                        <span className="text-xl">{stat.emoji}</span>
                        <div>
                          <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">
                            {stat.value.toLocaleString()}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">{stat.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  )}

                  {isPermanentDeleteMode && (
                    <div className="rounded-2xl border border-red-200 dark:border-red-500/25 bg-red-50 dark:bg-red-500/10 p-4">
                      <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                        {products.length} product{products.length === 1 ? '' : 's'} selected for permanent deletion
                      </p>
                      <p className="mt-1 text-xs text-red-600/90 dark:text-red-300/80">
                        Items removed here cannot be restored later.
                      </p>
                    </div>
                  )}

                  {/* Active orders callout */}
                  {impactSummary.activeOrdersCount > 0 && (
                    <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3">
                      <span className="text-lg">📦</span>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        <span className="font-semibold">{impactSummary.activeOrdersCount}</span> active order{impactSummary.activeOrdersCount !== 1 ? 's' : ''} will be affected
                      </p>
                    </div>
                  )}

                  {/* Blocked product names */}
                  {impactSummary.blockedNames.length > 0 && (
                    <p className="text-xs text-gray-400 dark:text-zinc-500">
                      Blocked: {impactSummary.blockedNames.slice(0, 3).join(', ')}
                      {impactSummary.blockedNames.length > 3 ? ` +${impactSummary.blockedNames.length - 3} more` : ''}
                    </p>
                  )}

                  {error && (
                    <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3">
                      <span>❌</span>
                      <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 border-t border-gray-100 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02] px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-white/10 transition-all active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loadingImpact || impactSummary.deletableIds.length === 0}
                onClick={() => setScreen('confirm')}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/25 disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98]"
              >
                {isPermanentDeleteMode ? 'Continue to Permanent Delete' : 'Continue to Delete'}
              </button>
            </div>
          </>
        )}

        {/* ── CONFIRM SCREEN ── */}
        {screen === 'confirm' && (
          <>
            {/* Header with large warning icon */}
            <div className="flex flex-col items-center pt-8 pb-2 px-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/15 ring-4 ring-red-50 dark:ring-red-500/10 mb-5">
                <span className="text-3xl">⚠️</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center">
                Are you sure?
              </h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400 text-center max-w-xs">
                You are about to permanently delete{' '}
                <span className="font-semibold text-red-600 dark:text-red-400">
                  {impactSummary.deletableIds.length} product{impactSummary.deletableIds.length !== 1 ? 's' : ''}
                </span>. This cannot be undone.
              </p>
            </div>

            {/* Confirm Input */}
            <div className="px-6 py-5">
              <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-2 text-center uppercase tracking-wider">
                Type <span className="font-bold text-red-600 dark:text-red-400">DELETE</span> to confirm
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={confirmText}
                  onChange={(event) =>
                    setConfirmText(String(event.target.value || '').toUpperCase())
                  }
                  placeholder="DELETE"
                  autoFocus
                  className={`
                    w-full rounded-2xl border-2 bg-gray-50 dark:bg-white/[0.04] px-4 py-4
                    text-center font-mono text-lg tracking-[0.3em] font-bold
                    text-gray-900 dark:text-white
                    outline-none transition-all duration-200
                    placeholder:text-gray-300 dark:placeholder:text-zinc-600 placeholder:font-normal placeholder:tracking-[0.3em]
                    ${isDeleteTyped
                      ? 'border-red-500 dark:border-red-500 ring-4 ring-red-500/10 dark:ring-red-500/20'
                      : 'border-gray-200 dark:border-white/10 focus:border-red-300 dark:focus:border-red-500/50 focus:ring-4 focus:ring-red-500/5'
                    }
                  `}
                />
                {isDeleteTyped && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <span className="text-xl">✅</span>
                  </div>
                )}
              </div>

              {impactSummary.blockedCount > 0 && (
                <p className="mt-3 text-xs text-gray-400 dark:text-zinc-500 text-center">
                  Only {impactSummary.deletableIds.length} of {products.length} product{products.length !== 1 ? 's' : ''} will be deleted.
                  {impactSummary.blockedCount} will be skipped (active orders).
                </p>
              )}

              {error && (
                <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3">
                  <span>❌</span>
                  <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 border-t border-gray-100 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02] px-6 py-4">
              <button
                type="button"
                onClick={() => setScreen('impact')}
                disabled={isProcessing}
                className="flex-1 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-white/10 transition-all disabled:opacity-50 active:scale-[0.98]"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={isProcessing || !isDeleteTyped || impactSummary.deletableIds.length === 0}
                className={`
                  flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white
                  transition-all active:scale-[0.98]
                  disabled:opacity-40 disabled:shadow-none
                  ${isDeleteTyped
                    ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/30'
                    : 'bg-red-400 dark:bg-red-800'
                  }
                `}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <VLoader size={16} phase="loading" showLabel={false} />
                    Deleting...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>🗑️</span>
                    Permanently Delete {impactSummary.deletableIds.length} Product{impactSummary.deletableIds.length !== 1 ? 's' : ''}
                  </span>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BulkDeleteProductsModal;
