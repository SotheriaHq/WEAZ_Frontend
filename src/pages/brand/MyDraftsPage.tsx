/**
 * PHASE 6: My Drafts Page
 * Shows collections pending category approval
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { brandApi } from '@/api/BrandApi';
import { useNavigate } from 'react-router-dom';
import { Loader2, Trash2, Eye } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import MediaRenderer from '@/components/media/MediaRenderer';

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

const MyDraftsPage: React.FC = () => {
  const [drafts, setDrafts] = useState<DraftCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const navigate = useNavigate();

  const fetchDrafts = async () => {
    setLoading(true);
    try {
      const response = await brandApi.getMyDraftCollections();
      const cleaned = (response || []).filter((d) => d && d.id && ((d.title && d.title.trim().length) || d.coverImage || (d.itemCount ?? 0) > 0));
      setDrafts(cleaned);
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Failed to load draft designs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, []);

  const handleDelete = (id: string, title: string) => {
    setPendingDelete({ id, title });
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setDeleting(id);
    try {
      await brandApi.deleteCollection(id);
      toast.success('Draft deleted successfully');
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    } catch (error: any) {
      // If backend cannot delete (already missing records), remove locally to avoid broken cards
      toast.error(error?.response?.data?.message ?? 'Failed to delete draft');
      setDrafts((prev) => prev.filter((d) => d.id !== id));
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
            Designs pending category approval. They will be published automatically once the category is approved.
          </p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            <p className="ml-3 text-gray-600 dark:text-gray-400">Loading drafts...</p>
          </div>
        ) : drafts.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
              <Eye className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No draft designs
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              All your designs are published or you haven't created any drafts yet.
            </p>
            <button
              onClick={() => navigate('/profile/collections/create')}
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
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow"
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
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-1">
                    {draft.title}
                  </h3>
                  
                  {draft.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
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
                      onClick={() => navigate(`/profile/edit/${draft.id}`)}
                      className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      Continue Creation
                    </button>
                    <button
                      onClick={() => handleDelete(draft.id, draft.title)}
                      disabled={deleting === draft.id}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {deleting === draft.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
