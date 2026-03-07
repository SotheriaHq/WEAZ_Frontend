import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminTaxonomyApi } from '@/api/AdminApi';
import type { AdminCategory } from '@/types/admin';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { unwrapApiResponse } from '@/types/auth';

type AdminSubCategory = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  order?: number;
};

const AdminTaxonomyPage: React.FC = () => {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [subCategoryMap, setSubCategoryMap] = useState<Record<string, AdminSubCategory[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formOrder, setFormOrder] = useState('');
  const [saving, setSaving] = useState(false);

  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    isDestructive: boolean;
    action: () => Promise<void>;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const hydrateSubCategories = useCallback(async (rows: AdminCategory[], includeInactive: boolean) => {
    const entries = await Promise.all(
      rows.map(async (row) => {
        try {
          const res = await adminTaxonomyApi.listSubCategories(row.id, includeInactive);
          const payload = unwrapApiResponse<AdminSubCategory[] | { items?: AdminSubCategory[] }>(
            res.data as any,
          );
          const items = Array.isArray(payload) ? payload : payload?.items ?? [];
          return [row.id, items] as const;
        } catch {
          return [row.id, []] as const;
        }
      }),
    );
    setSubCategoryMap(Object.fromEntries(entries));
  }, []);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminTaxonomyApi.listCategories(showInactive);
      const payload = unwrapApiResponse<AdminCategory[] | { items?: AdminCategory[] }>(res.data as any);
      const rows = Array.isArray(payload) ? payload : payload?.items ?? [];
      setCategories(rows);
      await hydrateSubCategories(rows, showInactive);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load taxonomy data');
    } finally {
      setLoading(false);
    }
  }, [hydrateSubCategories, showInactive]);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  const openCreate = () => {
    setFormName('');
    setFormSlug('');
    setFormDescription('');
    setFormOrder('');
    setShowCreate(true);
  };

  const openEdit = (cat: AdminCategory) => {
    setFormName(cat.name);
    setFormSlug(cat.slug ?? '');
    setFormDescription(cat.description ?? '');
    setFormOrder(typeof cat.order === 'number' ? String(cat.order) : '');
    setEditingCategory(cat);
  };

  const parseOrder = () => {
    if (!formOrder.trim()) return undefined;
    const parsed = Number(formOrder);
    if (!Number.isFinite(parsed)) return undefined;
    return parsed;
  };

  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);
    try {
      await adminTaxonomyApi.createCategory({
        name: formName.trim(),
        slug: formSlug.trim() || undefined,
        description: formDescription.trim() || undefined,
        order: parseOrder(),
      });
      toast.success('Category created');
      setShowCreate(false);
      await fetchCategories();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create category');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !formName.trim()) return;
    setSaving(true);
    try {
      await adminTaxonomyApi.updateCategory(editingCategory.id, {
        name: formName.trim(),
        slug: formSlug.trim() || undefined,
        description: formDescription.trim() || undefined,
        order: parseOrder(),
      });
      toast.success('Category updated');
      setEditingCategory(null);
      await fetchCategories();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update category');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = (cat: AdminCategory) => {
    const active = cat.isActive !== false;
    setConfirmAction({
      title: `${active ? 'Deactivate' : 'Activate'} "${cat.name}"?`,
      message: active
        ? 'This category will be hidden from active listings.'
        : 'This category will be restored to active listings.',
      isDestructive: active,
      action: async () => {
        if (active) await adminTaxonomyApi.deactivateCategory(cat.id);
        else await adminTaxonomyApi.activateCategory(cat.id);
        toast.success(`Category ${active ? 'deactivated' : 'activated'}`);
        await fetchCategories();
      },
    });
  };

  const executeConfirm = async () => {
    if (!confirmAction) return;
    setConfirmLoading(true);
    try {
      await confirmAction.action();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Action failed');
    } finally {
      setConfirmLoading(false);
      setConfirmAction(null);
    }
  };

  const activeCount = useMemo(() => categories.filter((item) => item.isActive !== false).length, [categories]);
  const inactiveCount = useMemo(() => categories.length - activeCount, [activeCount, categories.length]);

  const formBody = (onSubmit: (e: React.FormEvent) => void, isEdit: boolean) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-2xl border border-purple-200/50 bg-gradient-to-br from-white to-purple-50 p-4 dark:border-white/10 dark:from-white/10 dark:to-white/[0.03]">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {isEdit ? 'Edit Category' : 'Create Category'}
        </p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Maintain naming consistency so products map cleanly to taxonomy and filters.
        </p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
        <input
          type="text"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          required
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-purple-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Slug (optional)</label>
        <input
          type="text"
          value={formSlug}
          onChange={(e) => setFormSlug(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-purple-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
          placeholder="auto-generated if empty"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Description (optional)</label>
        <textarea
          value={formDescription}
          onChange={(e) => setFormDescription(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-purple-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
          placeholder="Short guidance for admins and sellers"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Display Order (optional)</label>
        <input
          type="number"
          value={formOrder}
          onChange={(e) => setFormOrder(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-purple-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
          placeholder="0"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => {
            setShowCreate(false);
            setEditingCategory(null);
          }}
          disabled={saving}
          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !formName.trim()}
          className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
        >
          {saving ? 'Saving...' : isEdit ? 'Update Category' : 'Create Category'}
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-purple-200/40 bg-gradient-to-br from-white/95 via-[#f8f3ff] to-[#efe6ff] p-5 shadow-md shadow-purple-500/10 dark:border-white/10 dark:from-white/10 dark:via-[#130d1d] dark:to-[#1a1227]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">Taxonomy Console</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Manage categories and verify related sub-categories from one workspace.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">{activeCount} active</span>
              <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">{inactiveCount} inactive</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200/80 bg-white/80 px-3 py-2 text-sm font-semibold text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              Show inactive
            </label>
            <button
              onClick={openCreate}
              className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
            >
              Create Category
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-28 animate-pulse rounded-2xl bg-gray-200/70 dark:bg-white/10" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200/80 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr className="border-b border-gray-200/80 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Sub-categories</th>
                <th className="px-3 py-3">Slug</th>
                <th className="px-3 py-3">Active</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const subCategories = subCategoryMap[category.id] ?? [];
                const isActive = category.isActive !== false;
                return (
                  <tr key={category.id} className="border-b border-gray-100/90 align-top transition-colors hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-gray-900 dark:text-white">{category.name}</p>
                      {category.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{category.description}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      {subCategories.length > 0 ? (
                        <div className="flex max-w-[360px] flex-wrap gap-1.5">
                          {subCategories.slice(0, 6).map((sub) => (
                            <span
                              key={sub.id}
                              className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-200"
                            >
                              {sub.name}
                            </span>
                          ))}
                          {subCategories.length > 6 ? (
                            <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:border-white/10 dark:bg-white/10 dark:text-gray-300">
                              +{subCategories.length - 6}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No active sub-categories</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{category.slug ?? '—'}</td>
                    <td className="px-3 py-3">
                      <span className="group relative inline-flex items-center" aria-label={isActive ? 'Active' : 'Inactive'}>
                        <span className={`h-3 w-3 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span className="pointer-events-none absolute left-5 rounded-md bg-gray-900 px-2 py-1 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openEdit(category)}
                          className="rounded-lg bg-indigo-100 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-200 dark:hover:bg-indigo-500/30"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(category)}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                            isActive
                              ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-200 dark:hover:bg-rose-500/30'
                              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:hover:bg-emerald-500/30'
                          }`}
                        >
                          {isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-gray-500 dark:text-gray-400">
                    No categories found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Category" size="sm">
        {formBody(handleSaveCreate, false)}
      </Modal>

      <Modal open={!!editingCategory} onClose={() => setEditingCategory(null)} title={`Edit ${editingCategory?.name ?? 'Category'}`} size="sm">
        {formBody(handleSaveEdit, true)}
      </Modal>

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title}
        message={confirmAction?.message}
        isDestructive={confirmAction?.isDestructive}
        isLoading={confirmLoading}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};

export default AdminTaxonomyPage;
