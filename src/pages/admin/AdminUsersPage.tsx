import React, { useEffect, useState, useCallback } from 'react';
import { adminUsersApi } from '@/api/AdminApi';
import type { AdminUser } from '@/types/admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';

const STATUS_EMOJI: Record<string, string> = {
  ACTIVE: '🟢',
  SUSPENDED: '🟡',
  DEACTIVATED: '🔴',
};

const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { hasPermission, isSuperAdmin } = useAdminPermissions();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      const res = await adminUsersApi.list(params);
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">👤 Users</h1>
        {isSuperAdmin && (
          <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition">
            + Create Admin
          </button>
        )}
      </div>

      <input
        type="text"
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
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
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Name</th>
                <th className="py-3 px-3">Email</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Created</th>
                {hasPermission('USERS_WRITE') && <th className="py-3 px-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="py-2.5 px-3">{STATUS_EMOJI[user.status] ?? '⚪'} {user.status}</td>
                  <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-white">{user.firstName} {user.lastName}</td>
                  <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">{user.email}</td>
                  <td className="py-2.5 px-3">{user.role}</td>
                  <td className="py-2.5 px-3 text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                  {hasPermission('USERS_WRITE') && (
                    <td className="py-2.5 px-3">
                      <button className="text-primary hover:underline text-xs">Manage</button>
                    </td>
                  )}
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;
