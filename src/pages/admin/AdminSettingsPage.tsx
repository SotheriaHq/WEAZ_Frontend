import React, { useEffect, useState, useCallback } from 'react';
import { adminSlaApi, adminFeatureFlagsApi } from '@/api/AdminApi';
import type { AdminSlaConfig, FeatureFlag } from '@/types/admin';

const AdminSettingsPage: React.FC = () => {
  const [slaConfigs, setSlaConfigs] = useState<AdminSlaConfig[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'sla' | 'flags'>('sla');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [slaRes, flagsRes] = await Promise.all([
        adminSlaApi.list(),
        adminFeatureFlagsApi.list(),
      ]);
      setSlaConfigs(Array.isArray(slaRes.data) ? slaRes.data : []);
      setFeatureFlags(Array.isArray(flagsRes.data) ? flagsRes.data : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleFlag = async (id: string) => {
    try {
      await adminFeatureFlagsApi.toggle(id);
      fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to toggle feature flag');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">⚙️ Settings</h1>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('sla')}
          className={`px-4 py-2 text-sm rounded-lg transition ${tab === 'sla' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
        >
          SLA Config
        </button>
        <button
          onClick={() => setTab('flags')}
          className={`px-4 py-2 text-sm rounded-lg transition ${tab === 'flags' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
        >
          Feature Flags
        </button>
      </div>

      {error && <div className="text-red-500 text-sm">{error}</div>}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : tab === 'sla' ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">SLA Configurations</h2>
          {slaConfigs.length === 0 ? (
            <div className="text-gray-500 text-sm">No SLA configs defined. Create one to set response targets.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500">
                    <th className="py-3 px-3">Area</th>
                    <th className="py-3 px-3">Target Hours</th>
                    <th className="py-3 px-3">Active</th>
                    <th className="py-3 px-3">Created By</th>
                    <th className="py-3 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {slaConfigs.map((config) => (
                    <tr key={config.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2.5 px-3 font-medium">{config.area}</td>
                      <td className="py-2.5 px-3">{config.targetHours}h</td>
                      <td className="py-2.5 px-3">{config.isActive ? '🟢 Yes' : '🔴 No'}</td>
                      <td className="py-2.5 px-3 text-gray-500">{config.createdBy?.email ?? '—'}</td>
                      <td className="py-2.5 px-3">
                        <button className="text-primary hover:underline text-xs">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Feature Flags</h2>
          {featureFlags.length === 0 ? (
            <div className="text-gray-500 text-sm">No feature flags defined.</div>
          ) : (
            <div className="space-y-2">
              {featureFlags.map((flag) => (
                <div
                  key={flag.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200/50 dark:border-gray-700/50 bg-white/60 dark:bg-white/5"
                >
                  <div>
                    <div className="font-mono text-sm font-medium text-gray-900 dark:text-white">{flag.key}</div>
                    {flag.description && (
                      <div className="text-xs text-gray-500 mt-0.5">{flag.description}</div>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggleFlag(flag.id)}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition ${
                      flag.enabled
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {flag.enabled ? '🟢 Enabled' : '⚪ Disabled'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminSettingsPage;
