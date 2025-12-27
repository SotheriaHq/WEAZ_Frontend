import React, { useEffect } from 'react';
import { Users, Clock, History, XCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { fetchPatches, respondToPatch } from '../../../features/patchesSlice';
import MediaRenderer from '@/components/media/MediaRenderer';

const PatchesSettings: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = (searchParams.get('filter') as 'pending' | 'active' | 'history') || 'pending';
  const dispatch = useDispatch<AppDispatch>();
  
  // Fix: UserState has 'profile', not 'user'
  const { profile: user } = useSelector((state: RootState) => state.user);
  const { pending, active, history, loading } = useSelector((state: RootState) => state.patches);

  useEffect(() => {
    if (user?.id) {
      if (filter === 'pending') {
        dispatch(fetchPatches({ brandId: user.id, status: 'PENDING' }));
      } else if (filter === 'active') {
        dispatch(fetchPatches({ brandId: user.id, status: 'ACCEPTED' }));
      } else {
        dispatch(fetchPatches({ brandId: user.id, status: 'REJECTED' }));
      }
    }
  }, [dispatch, user?.id, filter]);

  const setActiveTab = (tab: 'pending' | 'active' | 'history') => {
    setSearchParams({ tab: 'patches', filter: tab });
  };

  const handleAccept = (patchId: string) => {
    dispatch(respondToPatch({ patchId, action: 'ACCEPTED' }));
  };

  const handleReject = (patchId: string) => {
    dispatch(respondToPatch({ patchId, action: 'REJECTED' }));
  };

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
            <Clock className="w-4 h-4" />
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
            <Users className="w-4 h-4" />
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
            <History className="w-4 h-4" />
            History
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading patches...</div>
          ) : (
            <>
              {filter === 'pending' && (
                <div className="space-y-4">
                  {pending.length === 0 && <p className="text-gray-500 text-center">No pending requests.</p>}
                  {pending.map((patch) => (
                    <div key={patch.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-white/10">
                      <div className="flex items-center gap-4">
                        <div className="max-h-10 max-w-10 rounded-full overflow-y-auto">
                          {patch.partner.profileImage ? (
                            <MediaRenderer
                              kind="image"
                              src={patch.partner.profileImage}
                              alt=""
                              maxHeightClassName="max-h-10"
                              maxWidthClassName="max-w-10"
                              className="rounded-full"
                              mediaClassName="rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">{patch.partner.brandFullName || patch.partner.username}</h3>
                          <p className="text-sm text-gray-500">
                            {new Date(patch.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <button onClick={() => handleAccept(patch.id)} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700">
                           Accept
                         </button>
                         <button onClick={() => handleReject(patch.id)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
                           Decline
                         </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {filter === 'active' && (
                <div className="space-y-4">
                  {active.length === 0 && <p className="text-gray-500 text-center">No active patches.</p>}
                  {active.map((patch) => (
                    <div key={patch.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-white/10">
                      <div className="flex items-center gap-4">
                        <div className="max-h-10 max-w-10 rounded-full overflow-y-auto">
                          {patch.partner.profileImage ? (
                            <MediaRenderer
                              kind="image"
                              src={patch.partner.profileImage}
                              alt=""
                              maxHeightClassName="max-h-10"
                              maxWidthClassName="max-w-10"
                              className="rounded-full"
                              mediaClassName="rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">{patch.partner.brandFullName || patch.partner.username}</h3>
                          <p className="text-sm text-gray-500">Patched since {new Date(patch.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <button className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/10 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20">
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {filter === 'history' && (
                <div className="space-y-4">
                  {history.length === 0 && <p className="text-gray-500 text-center">No history.</p>}
                  {history.map((patch) => (
                    <div key={patch.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-white/10 opacity-75">
                      <div className="flex items-center gap-4">
                        <div className="max-h-10 max-w-10 rounded-full overflow-y-auto">
                          {patch.partner.profileImage ? (
                            <MediaRenderer
                              kind="image"
                              src={patch.partner.profileImage}
                              alt=""
                              maxHeightClassName="max-h-10"
                              maxWidthClassName="max-w-10"
                              className="rounded-full"
                              mediaClassName="rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">{patch.partner.brandFullName || patch.partner.username}</h3>
                          <p className="text-sm text-gray-500">
                            {patch.status} • {new Date(patch.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        {patch.status === 'REJECTED' ? <XCircle className="w-4 h-4" /> : <History className="w-4 h-4" />}
                        {patch.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatchesSettings;
