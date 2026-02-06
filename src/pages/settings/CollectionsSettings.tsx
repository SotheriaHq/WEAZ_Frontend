import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { brandApi } from '@/api/BrandApi';
import { toast } from 'sonner';
import SettingsSidebar from '@/components/settings/SettingsSidebar';
import { ImageWithFallback } from '@/components/ImageWithFallback';

interface AccessItem {
  id?: string;
  collectionId: string;
  title: string;
  viewer?: { 
    id: string; 
    username?: string | null; 
    firstName?: string | null;
    lastName?: string | null;
    profileImage?: string | null; 
    profileImageId?: string | null;
    profileImageFile?: { id: string; s3Url: string } | null;
  } | null;
  brand?: { 
    id: string; 
    name?: string | null; 
    profileImage?: string | null; 
    profileImageId?: string | null;
    profileImageFile?: { id: string; s3Url: string } | null;
  } | null;
  coverUrl?: string | null;
  itemCount?: number;
  state: 'PENDING' | 'APPROVED' | 'REVOKED' | 'NONE';
  createdAt?: string;
}

const CollectionsSettings: React.FC = () => {
  const me = useSelector((s: RootState) => s.user.profile);
  const brandId = me?.id;
  const isBrand = me?.type === 'BRAND';
  
  // Brand tabs: requests (pending) | approved
  // User tabs: myRequests (all statuses) | myAccess (granted)
  const [tab, setTab] = useState<'requests' | 'approved' | 'myRequests' | 'myAccess'>(
    isBrand ? 'requests' : 'myRequests'
  );
  
  const [pending, setPending] = useState<AccessItem[]>([]);
  const [approved, setApproved] = useState<AccessItem[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [myAccess, setMyAccess] = useState<any[]>([]);
  
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

  const refresh = useCallback(async () => {
    if (!brandId) return;
    
    setLoading(true);
    try {
      if (isBrand) {
        // Brand view: manage incoming requests
        if (tab === 'requests') {
          const res = await brandApi.listBrandAccessRequests(brandId, { status: 'pending', q: debouncedSearch || undefined, page, pageSize });
          setPending(res.items as any);
          setTotalCount(res.totalCount || 0);
        } else if (tab === 'approved') {
          const res = await brandApi.listBrandAccessRequests(brandId, { status: 'approved', q: debouncedSearch || undefined, page, pageSize });
          setApproved(res.items as any);
          setTotalCount(res.totalCount || 0);
        }
      } else {
        // Regular user view: manage own requests
        if (tab === 'myRequests') {
          const res = await brandApi.listMyAccessRequests({ page, pageSize });
          console.log('[CollectionsSettings] myRequests data:', res.items);
          setMyRequests(res.items);
          setTotalCount(res.totalCount || 0);
        } else if (tab === 'myAccess') {
          const res = await brandApi.listMyGrantedAccesses({ page, pageSize });
          console.log('[CollectionsSettings] myAccess data:', res.items);
          setMyAccess(res.items);
          setTotalCount(res.totalCount || 0);
        }
      }
    } catch (e: any) {
      console.error('Failed to load data:', e);
      toast.error('Failed to load data');
      
      // Clear data on error
      setPending([]);
      setApproved([]);
      setMyRequests([]);
      setMyAccess([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [brandId, isBrand, tab, debouncedSearch, page, pageSize]);

  useEffect(() => { setPage(1); }, [tab]);
  useEffect(() => { void refresh(); }, [refresh]);

  const items = useMemo(() => {
    if (isBrand) {
      return tab === 'requests' ? pending : approved;
    } else {
      return tab === 'myRequests' ? myRequests : myAccess;
    }
  }, [isBrand, tab, pending, approved, myRequests, myAccess]);

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

  // User actions
  const cancelRequest = async (requestId: string) => {
    try {
      await brandApi.cancelAccessRequest(requestId);
      toast.success('Request cancelled');
      void refresh();
    } catch {
      toast.error('Failed to cancel request');
    }
  };

  const revokeMyAccessAction = async (accessId: string) => {
    try {
      await brandApi.revokeMyAccess(accessId);
      toast.success('Access revoked');
      void refresh();
    } catch {
      toast.error('Failed to revoke access');
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#000000]">
      {/* Settings Sidebar */}
      <SettingsSidebar active="collections" onSelect={() => {}} />

      {/* Content area with proper spacing */}
      <div className="min-h-screen pt-16 pb-10 px-4 md:pl-[300px] lg:pl-[344px]">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Collections Access</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {isBrand ? 'Manage access requests for your private collections' : 'Manage your private collection access'}
            </p>
          </div>
          
      <div className="mb-4 inline-flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700" role="tablist" aria-label="Collections access tabs">
        {isBrand ? (
          <>
            {[{k:'requests',label:'Pending Requests'},{k:'approved',label:'Approved'}].map((opt:any) => (
              <button key={opt.k} role="tab" aria-selected={tab===opt.k} onClick={() => setTab(opt.k)} className={`px-4 py-1.5 text-sm font-medium transition-colors ${tab===opt.k?'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white':'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{opt.label}</button>
            ))}
          </>
        ) : (
          <>
            {[{k:'myRequests',label:'My Requests'},{k:'myAccess',label:'My Access'}].map((opt:any) => (
              <button key={opt.k} role="tab" aria-selected={tab===opt.k} onClick={() => setTab(opt.k)} className={`px-4 py-1.5 text-sm font-medium transition-colors ${tab===opt.k?'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white':'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{opt.label}</button>
            ))}
          </>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by user or collection"
          aria-label="Search access requests"
          className="threadly-search-input flex-1 min-w-0"
        />
        <div className="flex items-center gap-2" aria-label="Pagination size selector">
          <label htmlFor="pageSize" className="text-sm text-gray-600 dark:text-gray-300">Per page</label>
          <select id="pageSize" value={pageSize} onChange={(e)=>{ setPageSize(parseInt(e.target.value,10)); setPage(1); }} className="select-threadly px-2 py-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
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
          {items.map((it) => {
            // Determine display info based on brand vs user view
            let displayName: string;
            let collectionTitle: string;
            let itemKey: string;

            if (isBrand) {
              // Brand view: show viewer info and collection title
              displayName = it.viewer?.username || it.viewer?.id || 'Unknown';
              collectionTitle = it.collection?.title || 'Untitled';
              itemKey = `${it.collectionId}:${it.viewer?.id}`;
            } else {
              // User view: show brand info and collection title
              displayName = it.brand?.name || 'Unknown Brand';
              collectionTitle = it.title || 'Untitled';
              itemKey = it.id || `${it.collectionId}:${Math.random()}`;
            }
            
            const statusBadge = !isBrand && (tab === 'myRequests') && (
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                it.state === 'APPROVED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                it.state === 'PENDING' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
              }`}>
                {it.state}
              </span>
            );

            // Get profile image for display
            let profileImageUrl: string | null;
            let profileImageFileId: string | null;
            let fallbackName: string;

            if (isBrand) {
              // Brand view: show viewer's info
              profileImageUrl = it.viewer?.profileImage || it.viewer?.profileImageFile?.s3Url || null;
              profileImageFileId = it.viewer?.profileImageId || it.viewer?.profileImageFile?.id || null;
              fallbackName = it.viewer?.firstName && it.viewer?.lastName 
                ? `${it.viewer.firstName} ${it.viewer.lastName}`
                : (it.viewer?.username || displayName);
            } else {
              // User view: show brand's info
              profileImageUrl = it.brand?.profileImage || it.brand?.profileImageFile?.s3Url || null;
              profileImageFileId = it.brand?.profileImageId || it.brand?.profileImageFile?.id || null;
              fallbackName = it.brand?.name || displayName;
            }

            return (
              <div key={itemKey} role="listitem" className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-white/5 backdrop-blur">
                <div className="flex items-center gap-3">
                  {/* User/Brand Profile Avatar - Square Design */}
                  <div className="w-10 h-10 flex-shrink-0">
                    <ImageWithFallback
                      src={profileImageUrl}
                      fileId={profileImageFileId}
                      alt={displayName}
                      fallbackName={fallbackName}
                      fit="cover"
                      className="w-full h-full object-cover"
                      containerClassName="w-full h-full"
                      rounded="md"
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">
                      {collectionTitle}
                      {statusBadge}
                    </div>
                    <div className="text-xs text-gray-500">{displayName}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isBrand ? (
                    // Brand actions
                    tab === 'requests' ? (
                      <>
                        <button className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => approveOne(it)}>Approve</button>
                        <button className="text-xs px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700" onClick={() => rejectOne(it)}>Reject</button>
                      </>
                    ) : (
                      <button className="text-xs px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700" onClick={() => revokeOne(it)}>Revoke</button>
                    )
                  ) : (
                    // User actions
                    tab === 'myRequests' ? (
                      it.state === 'PENDING' && (
                        <button className="text-xs px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700" onClick={() => cancelRequest(it.id)}>Cancel</button>
                      )
                    ) : (
                      <button className="text-xs px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700" onClick={() => revokeMyAccessAction(it.id)}>Revoke</button>
                    )
                  )}
                </div>
              </div>
            );
          })}
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
