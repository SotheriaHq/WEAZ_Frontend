import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import type { BrandPatchHistoryAction } from '../../../api/BrandApi';
import {
  cancelPatch,
  fetchPatchHistory,
  fetchPatches,
  respondToPatch,
} from '../../../features/patchesSlice';
import MediaRenderer from '@/components/media/MediaRenderer';

type PatchesFilter = 'pending' | 'active' | 'history';

const historyActionMeta: Record<
  BrandPatchHistoryAction,
  { marker: string; label: string }
> = {
  REQUESTED: { marker: '📨', label: 'Patch requested' },
  ACCEPTED: { marker: '✅', label: 'Patch accepted' },
  REJECTED: { marker: '❌', label: 'Patch rejected' },
  CANCELLED: { marker: '🛑', label: 'Request cancelled' },
  REMOVED: { marker: '✂️', label: 'Patch removed' },
};

const toReadableDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
};

const PatchesSettings: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawFilter = searchParams.get('filter');
  const filter: PatchesFilter =
    rawFilter === 'active' || rawFilter === 'history' ? rawFilter : 'pending';
  const dispatch = useDispatch<AppDispatch>();

  const { profile: user } = useSelector((state: RootState) => state.user);
  const { pending, active, history, loading, loadingTab, loaded, error } = useSelector(
    (state: RootState) => state.patches,
  );

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    if (filter === 'pending' && !loaded.pending) {
      dispatch(fetchPatches({ brandId: user.id, status: 'PENDING' }));
      return;
    }

    if (filter === 'active' && !loaded.active) {
      dispatch(fetchPatches({ brandId: user.id, status: 'ACCEPTED' }));
      return;
    }

    if (filter === 'history' && !loaded.history) {
      dispatch(fetchPatchHistory({ brandId: user.id }));
    }
  }, [
    dispatch,
    filter,
    loaded.active,
    loaded.history,
    loaded.pending,
    user?.id,
  ]);

  const setActiveTab = (tab: PatchesFilter) => {
    setSearchParams({ tab: 'patches', filter: tab });
  };

  const handleAccept = (patchId: string) => {
    dispatch(respondToPatch({ patchId, action: 'ACCEPTED' }));
  };

  const handleReject = (patchId: string) => {
    dispatch(respondToPatch({ patchId, action: 'REJECTED' }));
  };

  const handleRemove = (patchId: string) => {
    dispatch(cancelPatch(patchId));
  };

  const isTabLoading = loading && loadingTab === filter;

  const showInlineLoading = (itemsCount: number) => isTabLoading && itemsCount > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Brand Patches</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage your connections with other brands.</p>
      </div>

      <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-white/10">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
              filter === 'pending'
                ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50 dark:bg-purple-900/10'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
            }`}
          >
            <span aria-hidden="true">⏳</span>
            Pending
            {pending.length > 0 && (
              <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-full">
                {pending.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
              filter === 'active'
                ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50 dark:bg-purple-900/10'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
            }`}
          >
            <span aria-hidden="true">🤝</span>
            Active Patches
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
              filter === 'history'
                ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50 dark:bg-purple-900/10'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
            }`}
          >
            <span aria-hidden="true">🕘</span>
            History
          </button>
        </div>

        <div className="p-6">
          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          ) : null}

          {filter === 'pending' && (
            <div className="space-y-4">
              {isTabLoading && pending.length === 0 && (
                <div className="text-center py-8 text-gray-500">Loading patch requests...</div>
              )}
              {showInlineLoading(pending.length) && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Refreshing...</p>
              )}
              {!isTabLoading && pending.length === 0 && (
                <p className="text-gray-500 text-center">No pending requests.</p>
              )}
              {pending.map((patch) => (
                <div
                  key={patch.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-white/10"
                >
                  <div className="flex items-center gap-4">
                    <div className="max-h-10 max-w-10 rounded-xl overflow-hidden">
                      {patch.partner.profileImage ? (
                        <MediaRenderer
                          kind="image"
                          src={patch.partner.profileImage}
                          alt=""
                          maxHeightClassName="max-h-10"
                          maxWidthClassName="max-w-10"
                          className="rounded-xl"
                          mediaClassName="rounded-xl"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-200 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-200">
                          🪡
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {patch.partner.brandFullName || patch.partner.username}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {patch.isOutgoing ? 'Outgoing request' : 'Incoming request'} •{' '}
                        {toReadableDate(patch.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {patch.isOutgoing ? (
                      <button
                        onClick={() => handleRemove(patch.id)}
                        className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/10 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20"
                      >
                        Cancel
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleAccept(patch.id)}
                          className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleReject(patch.id)}
                          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                          Decline
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {filter === 'active' && (
            <div className="space-y-4">
              {isTabLoading && active.length === 0 && (
                <div className="text-center py-8 text-gray-500">Loading active patches...</div>
              )}
              {showInlineLoading(active.length) && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Refreshing...</p>
              )}
              {!isTabLoading && active.length === 0 && (
                <p className="text-gray-500 text-center">No active patches.</p>
              )}
              {active.map((patch) => (
                <div
                  key={patch.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-white/10"
                >
                  <div className="flex items-center gap-4">
                    <div className="max-h-10 max-w-10 rounded-xl overflow-hidden">
                      {patch.partner.profileImage ? (
                        <MediaRenderer
                          kind="image"
                          src={patch.partner.profileImage}
                          alt=""
                          maxHeightClassName="max-h-10"
                          maxWidthClassName="max-w-10"
                          className="rounded-xl"
                          mediaClassName="rounded-xl"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-200 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-200">
                          🪡
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {patch.partner.brandFullName || patch.partner.username}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Patched since {toReadableDate(patch.createdAt)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(patch.id)}
                    className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/10 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {filter === 'history' && (
            <div className="space-y-4">
              {isTabLoading && history.length === 0 && (
                <div className="text-center py-8 text-gray-500">Loading patch history...</div>
              )}
              {showInlineLoading(history.length) && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Refreshing...</p>
              )}
              {!isTabLoading && history.length === 0 && (
                <p className="text-gray-500 text-center">No patch history yet.</p>
              )}
              {history.map((entry) => {
                const meta = historyActionMeta[entry.action] ?? {
                  marker: '🕘',
                  label: entry.action,
                };

                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-white/10"
                  >
                    <div className="flex items-center gap-4">
                      <div className="max-h-10 max-w-10 rounded-xl overflow-hidden">
                        {entry.partner.profileImage ? (
                          <MediaRenderer
                            kind="image"
                            src={entry.partner.profileImage}
                            alt=""
                            maxHeightClassName="max-h-10"
                            maxWidthClassName="max-w-10"
                            className="rounded-xl"
                            mediaClassName="rounded-xl"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-200 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-200">
                            🪡
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {entry.partner.brandFullName || entry.partner.username}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {meta.label} • {entry.isOutgoing ? 'You initiated' : 'Partner initiated'} •{' '}
                          {toReadableDate(entry.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span aria-hidden="true">{meta.marker}</span>
                      {meta.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default PatchesSettings;
