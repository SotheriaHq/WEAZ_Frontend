import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, EyeOff, RefreshCcw, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';

import marketApi, {
  type MarketSuppression,
  type MarketSuppressionType,
  type MarketSignalTargetType,
} from '@/api/MarketApi';
import { useConfirm } from '@/components/ui/useConfirm';
import type { RootState } from '@/store';

const targetTypeLabel: Record<MarketSignalTargetType, string> = {
  PRODUCT: 'Product',
  COLLECTION: 'Collection',
  DESIGN: 'Design',
  BRAND: 'Brand',
  CATEGORY: 'Category',
  SECTION: 'Market section',
  SUGGESTION_BLOCK: 'Suggestion block',
};

const suppressionTypeLabel: Record<MarketSuppressionType, string> = {
  HIDE_ITEM: 'Hidden item',
  NOT_INTERESTED: 'Not interested',
  HIDE_BRAND: 'Hidden brand',
  HIDE_CATEGORY: 'Hidden category',
  HIDE_SECTION: 'Hidden section',
  HIDE_SUGGESTION_BLOCK: 'Hidden suggestion block',
  SHOW_LESS: 'Show less often',
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Recently hidden';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently hidden';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const getSuppressionLabel = (suppression: MarketSuppression) => {
  if (suppression.sectionKey) return suppression.sectionKey;
  if (suppression.suggestionBlockKey) return suppression.suggestionBlockKey;
  if (suppression.targetId) return suppression.targetId;
  if (suppression.brandId) return suppression.brandId;
  if (suppression.categoryId) return suppression.categoryId;
  return suppressionTypeLabel[suppression.suppressionType];
};

const getSuppressionSubtitle = (suppression: MarketSuppression) => {
  const parts = [
    targetTypeLabel[suppression.targetType],
    suppressionTypeLabel[suppression.suppressionType],
    suppression.reason ? `Reason: ${suppression.reason.replace(/[-_]/g, ' ')}` : null,
  ].filter(Boolean);
  return parts.join(' / ');
};

const EmptyState = () => (
  <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center dark:border-white/10 dark:bg-gray-950">
    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300">
      <EyeOff className="h-5 w-5" />
    </div>
    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
      Nothing hidden yet
    </h3>
    <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
      Items you mark as not interested in market sections or suggestions will appear here so you can restore them later.
    </p>
  </div>
);

export const HiddenContentSettings: React.FC = () => {
  const isAuthenticated = useSelector((state: RootState) => state.user.isAuthenticated);
  const profile = useSelector((state: RootState) => state.user.profile);
  const { confirm, ConfirmDialog } = useConfirm();
  const [suppressions, setSuppressions] = useState<MarketSuppression[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busySuppressionId, setBusySuppressionId] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);

  const canManagePreferences = Boolean(isAuthenticated && profile);

  const loadSuppressions = useCallback(
    async (signal?: AbortSignal) => {
      if (!canManagePreferences) {
        setSuppressions([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      try {
        const nextSuppressions = await marketApi.getMarketSuppressions(undefined, { signal });
        setSuppressions(nextSuppressions);
      } catch {
        if (signal?.aborted) return;
        setLoadError('Unable to load hidden content right now.');
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [canManagePreferences],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadSuppressions(controller.signal);
    return () => controller.abort();
  }, [loadSuppressions]);

  const visibleSuppressions = useMemo(
    () =>
      [...suppressions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [suppressions],
  );

  const handleRestore = async (suppression: MarketSuppression) => {
    const previous = suppressions;
    setBusySuppressionId(suppression.id);
    setSuppressions((current) => current.filter((item) => item.id !== suppression.id));

    try {
      await marketApi.deleteMarketSuppression(suppression.id);
      toast.success('Content restored to future market results.');
    } catch {
      setSuppressions(previous);
      toast.error('Could not restore that content. Try again.');
    } finally {
      setBusySuppressionId(null);
    }
  };

  const handleResetPreferences = async () => {
    const approved = await confirm({
      title: 'Reset market preferences?',
      message:
        'This resets market, feed, and suggestion learning signals. It does not delete your account, orders, saved items, products, collections, or hidden content list.',
      confirmText: 'Reset preferences',
      cancelText: 'Cancel',
      isDestructive: true,
    });
    if (!approved) return;

    setResetBusy(true);
    try {
      await marketApi.resetFeedPreferences({
        resetType: 'ALL',
        reason: 'user_settings_reset',
      });
      toast.success('Market preferences reset. Future recommendations will rebuild from new activity.');
    } catch {
      toast.error('Could not reset market preferences. Try again.');
    } finally {
      setResetBusy(false);
    }
  };

  if (!canManagePreferences) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-white">
            Market & Feed Preferences
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Sign in to manage hidden content and reset market preference learning.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-gray-950">
          <Link
            to="/login"
            className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {ConfirmDialog}
      <div>
        <h1 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-white">
          Market & Feed Preferences
        </h1>
        <p className="max-w-3xl text-gray-500 dark:text-gray-400">
          Manage content you have hidden from market experiences and reset preference learning for market, feed, and suggestion recommendations.
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-gray-950">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <EyeOff className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Hidden / Not Interested Content
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Restored items become eligible for future market sections and suggestion blocks.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadSuppressions()}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
          >
            <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="mt-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-white/10"
                />
              ))}
            </div>
          ) : loadError ? (
            <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm">{loadError}</p>
              </div>
              <button
                type="button"
                onClick={() => void loadSuppressions()}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold dark:border-red-800"
              >
                Retry
              </button>
            </div>
          ) : visibleSuppressions.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="divide-y divide-gray-200 rounded-xl border border-gray-200 dark:divide-white/10 dark:border-white/10">
              {visibleSuppressions.map((suppression) => (
                <div
                  key={suppression.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {getSuppressionLabel(suppression)}
                      </h3>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">
                        {targetTypeLabel[suppression.targetType]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {getSuppressionSubtitle(suppression)}
                    </p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      Hidden {formatDate(suppression.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRestore(suppression)}
                    disabled={busySuppressionId === suppression.id}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {busySuppressionId === suppression.id ? 'Restoring...' : 'Restore'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/30 dark:bg-amber-900/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
              Reset market preferences
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-800 dark:text-amber-200">
              This creates a fresh preference marker for market, feed, and suggestion learning. It does not delete your account, orders, saved items, products, collections, or hidden content list.
            </p>
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
              Future recommendations may feel less tailored until new activity builds up.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleResetPreferences()}
            disabled={resetBusy}
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resetBusy ? 'Resetting...' : 'Reset preferences'}
          </button>
        </div>
      </section>
    </div>
  );
};

export default HiddenContentSettings;
