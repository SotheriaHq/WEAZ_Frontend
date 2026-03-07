import React, { useCallback, useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { adminFeaturedApi } from '@/api/AdminApi';
import type { EligibleEntity } from '@/types/admin';
import { unwrapApiResponse } from '@/types/auth';
import { toast } from 'sonner';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const FeatureItemModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [entityType, setEntityType] = useState<'PRODUCT' | 'DESIGN'>('PRODUCT');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [results, setResults] = useState<EligibleEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<EligibleEntity | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(handle);
  }, [search]);

  const doSearch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { entityType };
      if (debouncedSearch) params.search = debouncedSearch;
      params.limit = '20';
      const res = await adminFeaturedApi.search(params);
      const data = unwrapApiResponse<EligibleEntity[]>(res.data as any);
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, debouncedSearch]);

  useEffect(() => {
    doSearch();
  }, [doSearch]);

  const handleSubmit = async () => {
    if (!selected || !selected.eligible) return;
    setSubmitting(true);
    try {
      await adminFeaturedApi.create({
        entityType: selected.entityType,
        entityId: selected.entityId,
      });
      toast.success(`${selected.name} is now featured!`);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to feature item');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="⭐ Feature an item" size="lg">
      <div className="space-y-4">
        {/* Entity type toggle */}
        <div className="inline-flex overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
          {(['PRODUCT', 'DESIGN'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => { setEntityType(type); setSelected(null); }}
              className={`px-4 py-2 text-xs font-semibold transition ${
                entityType === type
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-black/20 dark:text-gray-300 dark:hover:bg-white/10'
              }`}
            >
              {type === 'PRODUCT' ? '📦 Product' : '🎨 Design'}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${entityType.toLowerCase()}s by name...`}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-purple-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
        />

        {/* Results */}
        <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200/80 bg-white dark:border-white/10 dark:bg-black/20">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-gray-500">Searching...</div>
          ) : results.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-gray-500">No results</div>
          ) : (
            results.map((item) => (
              <button
                key={item.entityId}
                type="button"
                onClick={() => item.eligible && setSelected(item)}
                disabled={!item.eligible}
                className={`flex w-full items-center gap-3 border-b border-gray-100 px-3 py-3 text-left transition last:border-b-0 dark:border-white/5 ${
                  selected?.entityId === item.entityId
                    ? 'bg-purple-50 dark:bg-purple-500/10'
                    : item.eligible
                      ? 'hover:bg-gray-50 dark:hover:bg-white/5'
                      : 'cursor-not-allowed opacity-50'
                }`}
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-gray-200/70 bg-gray-100 dark:border-white/10 dark:bg-white/10">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                      {item.entityType === 'PRODUCT' ? '📦' : '🎨'}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{item.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.brandName}</p>
                </div>
                {item.eligible ? (
                  selected?.entityId === item.entityId ? (
                    <span className="shrink-0 rounded-full bg-purple-100 px-2 py-1 text-[10px] font-bold text-purple-700 dark:bg-purple-500/20 dark:text-purple-200">
                      ✅ Selected
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                      Eligible
                    </span>
                  )
                ) : (
                  <span className="shrink-0 rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">
                    {item.reason ?? 'Ineligible'}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/20 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selected || !selected.eligible || submitting}
            className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Featuring...' : '⭐ Feature'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default FeatureItemModal;
