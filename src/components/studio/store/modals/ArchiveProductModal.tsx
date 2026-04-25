import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { productApi } from '@/api/ProductApi';
import VLoader from '@/components/loaders/VLoader';

const getProductInitials = (name: string): string => {
  if (!name) return 'P';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const gradientBackgrounds = [
  'bg-gradient-to-br from-purple-500 to-pink-500',
  'bg-gradient-to-br from-blue-500 to-cyan-500',
  'bg-gradient-to-br from-amber-500 to-orange-500',
  'bg-gradient-to-br from-emerald-500 to-teal-500',
  'bg-gradient-to-br from-rose-500 to-red-500',
];

const getGradientForName = (name: string): string => {
  const hash = name
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return gradientBackgrounds[hash % gradientBackgrounds.length];
};

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
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setImageError(false);
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const isArchiving = mode === 'archive';
  const productImage = product.thumbnail || product.images?.[0];
  const showFallback = !productImage || imageError;
  const initials = getProductInitials(product.name);
  const gradientClass = getGradientForName(product.name);
  const daysUntilDelete = product.archivedAt
    ? Math.max(
        0,
        60 -
          Math.floor(
            (Date.now() - new Date(product.archivedAt).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
      )
    : 60;

  const handleArchive = async () => {
    if (!product.id) return;
    setLoading(true);
    setError(null);
    try {
      if (isArchiving) {
        await productApi.archiveProduct(product.id);
        toast.success(`"${product.name}" has been archived`);
      } else {
        await productApi.unarchiveProduct(product.id);
        toast.success(`"${product.name}" has been restored`);
      }
      onArchived();
      onClose();
    } catch (e: any) {
      const responseData = e?.response?.data;
      const message =
        (typeof responseData?.message === 'string' && responseData.message.trim()) ||
        (Array.isArray(responseData?.message) &&
          responseData.message
            .filter((entry: unknown) => typeof entry === 'string')
            .join(', ')) ||
        (typeof responseData === 'string' && responseData.trim()) ||
        (typeof e?.message === 'string' && e.message.trim()) ||
        `Failed to ${mode} product`;
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-layer-modal flex items-start justify-center px-4 pt-24 sm:pt-20">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900 max-h-[calc(100vh-8rem)] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
        <div className="border-b border-gray-100 p-6 dark:border-white/10">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl">
              {showFallback ? (
                <div
                  className={`h-full w-full ${gradientClass} flex items-center justify-center`}
                >
                  <span className="text-xl font-bold text-white">{initials}</span>
                </div>
              ) : (
                <img
                  src={productImage}
                  alt={product.name}
                  className="h-full w-full object-cover"
                  onError={() => setImageError(true)}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {isArchiving ? 'Archive Product' : 'Restore Product'}
              </h2>
              <p className="mt-0.5 truncate text-sm text-gray-600 dark:text-gray-400">
                {product.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
              aria-label="Close"
            >
              <span className="text-base leading-none">✕</span>
            </button>
          </div>
        </div>

        <div className="space-y-3 p-6">
          {isArchiving ? (
            <>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-700/30 dark:bg-amber-900/20">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-lg">⏰</span>
                  <div>
                    <p className="font-semibold text-amber-800 dark:text-amber-200">
                      60-Day Auto-Delete
                    </p>
                    <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                      Archived products are automatically deleted after 60 days.
                      You will receive reminders every 7 days.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-700/30 dark:bg-blue-900/20">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-lg">📋</span>
                  <div>
                    <p className="font-semibold text-blue-800 dark:text-blue-200">
                      Visible in Order History
                    </p>
                    <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                      Customers who already ordered this product can still see it
                      in their order history.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-700/30 dark:bg-emerald-900/20">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-lg">↩️</span>
                  <div>
                    <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                      Easy to Restore
                    </p>
                    <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                      You can restore before the 60-day window ends. Working on it
                      resets the timer.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {product.archivedAt && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-700/30 dark:bg-amber-900/20">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-lg">⏰</span>
                    <div>
                      <p className="font-semibold text-amber-800 dark:text-amber-200">
                        {daysUntilDelete} day(s) until auto-delete
                      </p>
                      <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                        Restoring now cancels this auto-delete schedule.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-700/30 dark:bg-blue-900/20">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-lg">ℹ️</span>
                  <div>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Restored products return as <strong>drafts</strong>. Publish
                      them when ready.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-center text-sm text-rose-600 dark:border-rose-700/30 dark:bg-rose-900/20 dark:text-rose-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-gray-100 bg-gray-50/60 p-6 dark:border-white/10 dark:bg-zinc-800/30">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-gray-200 dark:hover:bg-zinc-600"
          >
            Cancel
          </button>
          <button
            onClick={handleArchive}
            disabled={loading}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white transition-colors disabled:opacity-50 ${
              isArchiving
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {loading ? (
              <>
                <VLoader size={16} phase="loading" showLabel={false} />
                {isArchiving ? 'Archiving...' : 'Restoring...'}
              </>
            ) : (
              <>
                <span>{isArchiving ? '📦' : '↩️'}</span>
                {isArchiving ? 'Archive Product' : 'Restore Product'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArchiveProductModal;
