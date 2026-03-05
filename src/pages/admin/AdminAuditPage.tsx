import React, { useEffect, useState, useCallback } from 'react';
import { adminAuditApi } from '@/api/AdminApi';
import type { AdminAuditLog } from '@/types/admin';

const AdminAuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (actionFilter) params.action = actionFilter;
      const res = await adminAuditApi.list(params);
      setLogs(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">📋 Audit Log</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">Immutable record of all admin actions. Read-only.</p>

      <input
        type="text"
        placeholder="Filter by action type..."
        value={actionFilter}
        onChange={(e) => setActionFilter(e.target.value)}
        className="w-full max-w-md px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
      />

      {error && <div className="text-red-500 text-sm">{error}</div>}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Admin</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Target</th>
                <th className="py-3 px-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <React.Fragment key={log.id}>
                  <tr
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <td className="py-2.5 px-3 text-gray-500">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="py-2.5 px-3">{log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : log.actorUserId}</td>
                    <td className="py-2.5 px-3 font-mono text-xs">{log.action}</td>
                    <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">{log.targetType} {log.targetId ? `(${log.targetId.slice(0, 8)}...)` : ''}</td>
                    <td className="py-2.5 px-3 text-xs text-primary">
                      {expandedId === log.id ? '▼ Collapse' : '▶ Expand'}
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 bg-gray-50 dark:bg-gray-900/30">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <div className="font-semibold text-gray-500 mb-1">Previous State</div>
                            <pre className="bg-white dark:bg-gray-800 p-2 rounded text-xs overflow-auto max-h-32">
                              {log.previousState ? JSON.stringify(log.previousState, null, 2) : '—'}
                            </pre>
                          </div>
                          <div>
                            <div className="font-semibold text-gray-500 mb-1">New State</div>
                            <pre className="bg-white dark:bg-gray-800 p-2 rounded text-xs overflow-auto max-h-32">
                              {log.newState ? JSON.stringify(log.newState, null, 2) : '—'}
                            </pre>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-500">IP:</span> {log.ipAddress ?? '—'}
                          </div>
                          <div>
                            <span className="font-semibold text-gray-500">User Agent:</span>{' '}
                            <span className="truncate">{log.userAgent ?? '—'}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">No audit logs found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminAuditPage;
