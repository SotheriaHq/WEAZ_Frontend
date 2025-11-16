import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { brandApi } from '@/api/BrandApi';
import { toast } from 'react-toastify';
import SettingsSidebar from '@/components/settings/SettingsSidebar';

interface AccessItem {
  id?: string;
  collectionId: string;
  title: string;
  viewer?: { id: string; username?: string | null; profileImage?: string | null } | null;
  coverUrl?: string | null;
  itemCount?: number;
  state: 'PENDING' | 'APPROVED' | 'REVOKED' | 'NONE';
  createdAt?: string;
}

const CollectionsSettings: React.FC = () => {
  const me = useSelector((s: RootState) => s.user.profile);
  const brandId = me?.id;
  const [tab, setTab] = useState<'requests' | 'approved'>('requests');
  const [pending, setPending] = useState<AccessItem[]>([]);
  const [approved, setApproved] = useState<AccessItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // Debounce search
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);

  const refresh = async () => {
    if (!brandId) return;
    setLoading(true);
    try {
      if (tab === 'requests') {
        const res = await brandApi.listBrandAccessRequests(brandId, { status: 'pending', q: debouncedSearch || undefined, page, pageSize });
        setPending(res.items as any);
        setTotalCount(res.totalCount || 0);
      } else {
        const res = await brandApi.listBrandAccessRequests(brandId, { status: 'approved', q: debouncedSearch || undefined, page, pageSize });
        setApproved(res.items as any);
        setTotalCount(res.totalCount || 0);
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const message = e?.response?.data?.message;
      
      // Handle specific error cases
      if (status === 400 && message?.includes('user type BRAND')) {
        toast.error('This feature is only available for brand accounts');
      } else {
        toast.error('Failed to load access requests');
      }
      
      // Clear data on error
      setPending([]);
      setApproved([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setPage(1); }, [tab]);
  useEffect(() => { void refresh(); }, [brandId, tab, debouncedSearch, page, pageSize]);

  const items = useMemo(() => (tab === 'requests' ? pending : approved), [tab, pending, approved]);

  const approveOne = async (it: AccessItem) => {
    if (!brandId) return;
    try {
      await brandApi.brandUpdateAccess(brandId, it.collectionId, it.viewer?.id || '', 'APPROVED');
      toast.success('Approved');
      void refresh();
    } catch {
      toast.error('Failed to approve');
    }
  };

  const rejectOne = async (it: AccessItem) => {
    if (!brandId) return;
    try {
      await brandApi.brandRejectAccess(brandId, it.collectionId, it.viewer?.id || '');
      toast.success('Rejected – requester locked for 72h');
      void refresh();
    } catch {
      toast.error('Failed to reject');
    }
  };

  const revokeOne = async (it: AccessItem) => {
    if (!brandId) return;
    try {
      await brandApi.brandUpdateAccess(brandId, it.collectionId, it.viewer?.id || '', 'REVOKED');
      toast.success('Revoked');
      void refresh();
    } catch {
      toast.error('Failed to revoke');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Settings Sidebar */}
      <SettingsSidebar active="collections" onSelect={() => {}} />

      {/* Content area with proper spacing */}
      <div className="min-h-screen pt-20 pb-10 px-4 md:pl-[300px] lg:pl-[344px]">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Collections Access</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage access requests for your private collections</p>
          </div>
      <div className="mb-4 inline-flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700" role="tablist" aria-label="Collections access tabs">
        {[{k:'requests',label:'Pending Requests'},{k:'approved',label:'Approved'}].map((opt:any) => (
          <button key={opt.k} role="tab" aria-selected={tab===opt.k} onClick={() => setTab(opt.k)} className={`px-4 py-1.5 text-sm font-medium transition-colors ${tab===opt.k?'bg-purple-600 text-white':'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{opt.label}</button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by user or collection"
          aria-label="Search access requests"
          className="flex-1 min-w-0 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
        />
        <div className="flex items-center gap-2" aria-label="Pagination size selector">
          <label htmlFor="pageSize" className="text-sm text-gray-600 dark:text-gray-300">Per page</label>
          <select id="pageSize" value={pageSize} onChange={(e)=>{ setPageSize(parseInt(e.target.value,10)); setPage(1); }} className="px-2 py-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
            {[10,20,50].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-gray-500">No items</div>
      ) : (
        <div className="space-y-3" role="list" aria-label="Access items">
          {items.map((it) => (
            <div key={`${it.collectionId}:${it.viewer?.id ?? it.id ?? Math.random()}`} role="listitem" className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-white/5 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="w-16 h-12 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800">
                  {it.coverUrl ? <img src={it.coverUrl} alt={it.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">No cover</div>}
                </div>
                <div>
                  <div className="text-sm font-semibold">{it.title}</div>
                  <div className="text-xs text-gray-500">{it.viewer?.username || it.viewer?.id}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {tab === 'requests' ? (
                  <>
                    <button className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => approveOne(it)}>Approve</button>
                    <button className="text-xs px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700" onClick={() => rejectOne(it)}>Reject</button>
                  </>
                ) : (
                  <button className="text-xs px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700" onClick={() => revokeOne(it)}>Revoke</button>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700 mt-4">
            <div className="text-xs text-gray-600 dark:text-gray-300">{totalCount} results</div>
            <div className="flex items-center gap-2" role="navigation" aria-label="Pagination">
              <button
                className="px-2 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-700 disabled:opacity-50"
                onClick={()=> setPage(p => Math.max(1, p-1))}
                disabled={page<=1}
                aria-label="Previous page"
              >Prev</button>
              <div className="text-sm">Page {page}</div>
              <button
                className="px-2 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-700 disabled:opacity-50"
                onClick={()=> setPage(p => p+1)}
                disabled={items.length < pageSize}
                aria-label="Next page"
              >Next</button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default CollectionsSettings;
