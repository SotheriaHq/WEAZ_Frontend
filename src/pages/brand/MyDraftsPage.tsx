/**
 * PHASE 6: My Drafts Page
 * Shows collections pending category approval
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { brandApi } from '@/api/BrandApi';
import { deleteDesign } from '@/api/DesignApi';
import { getStoredAccessToken, subscribeAccessToken } from '@/api/httpClient';
import { securityIdentityFromToken } from '@/auth/securityChallenge';
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import { MuseLoader } from '@/components/loaders/MuseLoader';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import MediaRenderer from '@/components/media/MediaRenderer';
import { buildDesignRoute } from '@/utils/catalogRoutes';
import { queryClient } from '@/query/queryClient';

interface DraftCollection {
  id: string;
  title: string;
  description?: string;
  pendingCategoryName?: string;
  draftReason?: string;
  createdAt: string;
  itemCount?: number;
  coverImage?: string;
}

const DRAFTS_QUERY_KEY = ['brand', 'draft-collections'] as const;

const MyDraftsPage: React.FC = () => {
  const accessToken = React.useSyncExternalStore(subscribeAccessToken, getStoredAccessToken, () => null);
  const identity = securityIdentityFromToken(accessToken, atob);
  const queryKey = [...DRAFTS_QUERY_KEY, identity] as const;
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const navigate = useNavigate();

  const { data, isLoading: loading, error: fetchError, hasNextPage, fetchNextPage, isFetchingNextPage, refetch } = useInfiniteQuery({
    queryKey,
    enabled: Boolean(identity),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => brandApi.getMyDraftCollectionsPage({
      cursor: pageParam, limit: 50, signal, expectedIdentity: identity ?? undefined,
    }),
    getNextPageParam: page => page.nextCursor ?? undefined,
  });
  const drafts = React.useMemo(() => [...new Map((data?.pages ?? []).flatMap(page => page.items)
    .filter(d => d?.id && ((d.title && d.title.trim().length) || d.coverImage || (d.itemCount ?? 0) > 0))
    .map(d => [d.id, d])).values()], [data]);
  React.useEffect(() => {
    setConfirmOpen(false); setPendingDelete(null); setDeleting(null);
  }, [identity]);

  React.useEffect(() => {
    if (fetchError) toast.error('Failed to load draft designs');
  }, [fetchError]);

  const handleDelete = (id: string, title: string) => {
    setPendingDelete({ id, title });
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setDeleting(id);
    const removeFromCache = () =>
      queryClient.setQueryData<InfiniteData<{ items: DraftCollection[]; nextCursor: string | null }>>(queryKey, (prev) =>
        prev ? { ...prev, pages: prev.pages.map(page => ({ ...page, items: page.items.filter(d => d.id !== id) })) } : prev,
      );
    try {
      await deleteDesign(id);
      toast.success('Draft deleted successfully');
      removeFromCache();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Failed to delete draft');
    } finally {
      setDeleting(null);
      setConfirmOpen(false);
      setPendingDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            My Draft Designs
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Saved designs stay private until you submit them. Category approval is separate and never publishes a draft.
          </p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <MuseLoader size={32} />
            <p className="ml-3 text-gray-600 dark:text-gray-400">Loading drafts...</p>
          </div>
        ) : fetchError && drafts.length === 0 ? (
          <div className="space-y-4 py-12" role="alert">
            <p>Your drafts could not be loaded. Retry when connected.</p>
            <Button type="button" onClick={() => void refetch()}>Retry drafts</Button>
          </div>
        ) : drafts.length === 0 && !hasNextPage ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
              <span aria-hidden="true">📝</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No draft designs
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              All your designs are published or you haven't created any drafts yet.
            </p>
            <button
              onClick={() => navigate(buildDesignRoute({ mode: 'create' }))}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
            >
              Create Design
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow [content-visibility:auto] [contain-intrinsic-size:0_420px]"
              >
                {/* Cover Image */}
                {draft.coverImage && (
                  <div className="relative">
                    <MediaRenderer
                      kind="image"
                      src={draft.coverImage}
                      alt={draft.title}
                      maxHeightClassName="max-h-48"
                      className="w-full"
                    />
                    <div className="absolute top-3 right-3">
                      <span className="px-3 py-1 bg-yellow-500 text-white text-xs font-semibold rounded-full">
                        DRAFT
                      </span>
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="p-5">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 break-words">
                    {draft.title}
                  </h3>
                  
                  {draft.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 break-words">
                      {draft.description}
                    </p>
                  )}

                  {/* Draft Info */}
                  <div className="space-y-2 mb-4">
                    {draft.pendingCategoryName && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-500 font-medium">Pending Category:</span>
                        <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold">
                          {draft.pendingCategoryName}
                        </span>
                      </div>
                    )}
                    {draft.draftReason && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-500 font-medium">Reason:</span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {draft.draftReason}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                      <span>{draft.itemCount ?? 0} items</span>
                      <span>•</span>
                      <span>{new Date(draft.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(buildDesignRoute({ designId: draft.id, legacyCollectionId: draft.id, mode: 'edit' }))}
                      className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <span aria-hidden="true">📝</span>
                      Continue Creation
                    </button>
                    <button
                      onClick={() => handleDelete(draft.id, draft.title)}
                      aria-label={`Delete ${draft.title || 'untitled draft'}`}
                      disabled={deleting === draft.id}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {deleting === draft.id ? (
                        <MuseLoader size={16} />
                      ) : (
                        <span aria-hidden="true">🗑️</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {hasNextPage ? <div className="flex justify-center py-6">
          <Button type="button" loading={isFetchingNextPage} disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}>Load more drafts</Button>
        </div> : null}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete draft?"
        message={pendingDelete ? `Are you sure you want to delete "${pendingDelete.title}"? This cannot be undone.` : 'This action cannot be undone.'}
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive
        onConfirm={confirmDelete}
        onCancel={() => { setConfirmOpen(false); setPendingDelete(null); }}
      />
    </div>
  );
};

export default MyDraftsPage;
