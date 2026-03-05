import React, { useEffect, useMemo, useState } from 'react';
import { productApi } from '@/api/ProductApi';

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
  products: BulkDeleteCandidate[];
  isProcessing?: boolean;
  onClose: () => void;
  onConfirmDelete: (productIds: string[]) => Promise<void> | void;
}

type ModalScreen = 'impact' | 'confirm';

const BulkDeleteProductsModal: React.FC<BulkDeleteProductsModalProps> = ({
  isOpen,
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
  }, [isOpen, products]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!isProcessing ? onClose : undefined}
        aria-label="Close bulk delete modal"
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-primary)] text-[color:var(--text-primary)] shadow-2xl">
        {screen === 'impact' && (
          <>
            <div className="border-b border-[color:var(--border-strong)] px-6 py-5">
              <h2 className="text-lg font-bold">Delete Products</h2>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                {products.length} selected
              </p>
            </div>

            <div className="px-6 py-5">
              {loadingImpact ? (
                <div className="py-8 text-center text-sm text-[color:var(--text-secondary)]">
                  Checking delete impact...
                </div>
              ) : (
                <div className="space-y-4">
                  {impactSummary.blockedCount > 0 && (
                    <div className="rounded-xl border border-[color:var(--status-warning,#f59e0b)]/35 bg-[color:var(--status-warning,#f59e0b)]/10 p-3 text-sm text-[color:var(--text-primary)]">
                      {impactSummary.blockedCount} product
                      {impactSummary.blockedCount === 1 ? '' : 's'} have active
                      orders and cannot be deleted. They should be archived
                      instead.
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-secondary)] p-3">
                      Carts: {impactSummary.inCarts}
                    </div>
                    <div className="rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-secondary)] p-3">
                      Wishlists: {impactSummary.inWishlists}
                    </div>
                    <div className="rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-secondary)] p-3">
                      Views: {impactSummary.totalViews}
                    </div>
                    <div className="rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-secondary)] p-3">
                      Threads: {impactSummary.totalThreads}
                    </div>
                  </div>

                  {impactSummary.blockedNames.length > 0 && (
                    <p className="text-xs text-[color:var(--text-secondary)]">
                      Blocked: {impactSummary.blockedNames.slice(0, 3).join(', ')}
                      {impactSummary.blockedNames.length > 3 ? '...' : ''}
                    </p>
                  )}

                  {error && (
                    <p className="text-sm text-[color:var(--status-danger,#dc2626)]">
                      {error}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t border-[color:var(--border-strong)] bg-[color:var(--surface-secondary)]/70 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold neu-modal-inset text-[color:var(--neu-text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loadingImpact || impactSummary.deletableIds.length === 0}
                onClick={() => setScreen('confirm')}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{
                  background:
                    'var(--status-danger, #dc2626)',
                }}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {screen === 'confirm' && (
          <>
            <div className="border-b border-[color:var(--border-strong)] px-6 py-5">
              <h2 className="text-lg font-bold">Confirm Deletion</h2>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                Type DELETE to continue
              </p>
            </div>
            <div className="px-6 py-5">
              <input
                type="text"
                value={confirmText}
                onChange={(event) =>
                  setConfirmText(String(event.target.value || '').toUpperCase())
                }
                placeholder="Type DELETE"
                autoFocus
                className="w-full rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-primary)] px-4 py-3 text-center font-mono tracking-widest text-[color:var(--text-primary)] outline-none focus:border-[color:var(--brand-primary)]"
              />
              {impactSummary.blockedCount > 0 && (
                <p className="mt-3 text-xs text-[color:var(--text-secondary)]">
                  Only {impactSummary.deletableIds.length} product
                  {impactSummary.deletableIds.length === 1 ? '' : 's'} will be
                  deleted.
                </p>
              )}
              {error && (
                <p className="mt-3 text-sm text-[color:var(--status-danger,#dc2626)]">
                  {error}
                </p>
              )}
            </div>
            <div className="flex gap-3 border-t border-[color:var(--border-strong)] bg-[color:var(--surface-secondary)]/70 px-6 py-4">
              <button
                type="button"
                onClick={() => setScreen('impact')}
                disabled={isProcessing}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold neu-modal-inset text-[color:var(--neu-text)] disabled:opacity-60"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={
                  isProcessing ||
                  confirmText !== 'DELETE' ||
                  impactSummary.deletableIds.length === 0
                }
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{
                  background: 'var(--status-danger, #dc2626)',
                }}
              >
                {isProcessing ? 'Deleting...' : 'Delete Selected'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BulkDeleteProductsModal;
