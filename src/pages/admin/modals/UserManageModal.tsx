import React, { useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { adminUsersApi } from '@/api/AdminApi';
import type { AdminUser, AdminPermissionCode } from '@/types/admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { toast } from 'sonner';

interface Props {
  user: AdminUser | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

const STATUS_META: Record<
  string,
  { emoji: string; label: string; chipClass: string }
> = {
  ACTIVE: {
    emoji: '🟢',
    label: 'Active',
    chipClass:
      'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  },
  SUSPENDED: {
    emoji: '🟡',
    label: 'Suspended',
    chipClass:
      'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  },
  DEACTIVATED: {
    emoji: '🔴',
    label: 'Inactive',
    chipClass:
      'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
  },
};

const SEEDED_USER_EMAILS = new Set(
  [
    'brand@example.com',
    'adminoversee@test.com',
    ...(String(import.meta.env.VITE_SEEDED_USER_EMAILS || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)),
  ].filter(Boolean),
);

const ALL_PERMISSIONS: AdminPermissionCode[] = [
  'USERS_READ',
  'USERS_WRITE',
  'USERS_SUSPEND',
  'USERS_DEACTIVATE',
  'USERS_NOTIFY',
  'BRANDS_READ',
  'BRANDS_WRITE',
  'BRANDS_SUSPEND',
  'BRANDS_VERIFY',
  'BRANDS_STORE_OVERRIDE',
  'PRODUCTS_READ',
  'PRODUCTS_WRITE',
  'PRODUCTS_DELETE',
  'COLLECTIONS_READ',
  'COLLECTIONS_WRITE',
  'COLLECTIONS_DELETE',
  'TAXONOMY_READ',
  'TAXONOMY_WRITE',
  'TAGS_READ',
  'TAGS_WRITE',
  'MODERATION_READ',
  'MODERATION_REVIEW',
  'MODERATION_QUARANTINE',
  'MEASUREMENTS_READ',
  'MEASUREMENTS_REVIEW',
  'PAYOUTS_READ',
  'PAYOUTS_PROCESS',
  'DISPUTES_READ',
  'DISPUTES_RESOLVE',
  'AUDIT_READ',
  'SYSTEM_FEATURE_FLAGS',
  'SYSTEM_BREAK_GLASS',
  'SYSTEM_ROLE_ASSIGN',
  'SYSTEM_PERMISSION_ASSIGN',
  'SYSTEM_SLA_READ',
  'SYSTEM_SLA_WRITE',
  'SYSTEM_DATA_EXPORT',
  'SYSTEM_DATA_DELETE',
];

const UserManageModal: React.FC<Props> = ({ user, open, onClose, onUpdated }) => {
  const { isSuperAdmin, hasPermission } = useAdminPermissions();
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    isDestructive: boolean;
    action: () => Promise<void>;
  } | null>(null);

  const currentPerms = useMemo(
    () => new Set(user?.permissions?.map((p) => p.permissionCode) ?? []),
    [user?.permissions],
  );

  if (!user) return null;

  const displayName = `${user.firstName} ${user.lastName}`.trim() || user.email;
  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`
    .toUpperCase()
    .slice(0, 2);
  const statusMeta = STATUS_META[user.status] ?? {
    emoji: '⚪',
    label: user.status,
    chipClass:
      'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-white/10 dark:text-gray-300 dark:border-white/20',
  };
  const isSeededUser = SEEDED_USER_EMAILS.has(user.email.toLowerCase());

  const handleStatusChange = (status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED') => {
    const labels: Record<typeof status, string> = {
      ACTIVE: 'reactivate',
      SUSPENDED: 'suspend',
      DEACTIVATED: 'deactivate',
    };
    setConfirmAction({
      title: `${labels[status]} ${displayName}?`,
      message: `${user.email} will be set to ${status}.`,
      isDestructive: status !== 'ACTIVE',
      action: async () => {
        await adminUsersApi.updateStatus(user.id, status);
        toast.success(`User ${status.toLowerCase()} successfully`);
        onUpdated();
        onClose();
      },
    });
  };

  const handleRoleChange = () => {
    const newRole = user.role === 'SuperAdmin' ? 'Admin' : 'SuperAdmin';
    setConfirmAction({
      title: `Change role to ${newRole}?`,
      message: `${user.email} will ${newRole === 'SuperAdmin' ? 'gain' : 'lose'} SuperAdmin privileges.`,
      isDestructive: newRole === 'Admin',
      action: async () => {
        await adminUsersApi.updateRole(user.id, newRole);
        toast.success(`Role updated to ${newRole}`);
        onUpdated();
        onClose();
      },
    });
  };

  const handleForcePasswordReset = () => {
    setConfirmAction({
      title: 'Force password reset?',
      message: `${user.email} will be logged out and required to set a new password.`,
      isDestructive: true,
      action: async () => {
        await adminUsersApi.forcePasswordReset(user.id);
        toast.success('Password reset forced');
        onUpdated();
      },
    });
  };

  const handleHardDeleteSeededUser = () => {
    setConfirmAction({
      title: 'Hard-delete seeded user?',
      message:
        'This permanently removes the seeded user account. This cannot be undone.',
      isDestructive: true,
      action: async () => {
        await adminUsersApi.hardDeleteSeeded(user.id);
        toast.success('Seeded user hard-deleted');
        onUpdated();
        onClose();
      },
    });
  };

  const handlePermissionToggle = async (perm: AdminPermissionCode) => {
    const newPerms = new Set(currentPerms);
    if (newPerms.has(perm)) {
      newPerms.delete(perm);
    } else {
      newPerms.add(perm);
    }
    setLoading(true);
    try {
      await adminUsersApi.updatePermissions(user.id, Array.from(newPerms));
      toast.success('Permissions updated');
      onUpdated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update permissions');
    } finally {
      setLoading(false);
    }
  };

  const executeConfirm = async () => {
    if (!confirmAction) return;
    setLoading(true);
    try {
      await confirmAction.action();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Action failed');
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  };

  const actionButtonClass =
    'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black';

  return (
    <>
      <Modal open={open} onClose={onClose} title="" size="lg">
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-200/80 bg-gradient-to-br from-white to-gray-50 px-4 py-4 dark:border-white/10 dark:from-white/10 dark:to-white/5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-600 text-sm font-bold text-white shadow-md">
                  {initials || 'U'}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-gray-900 dark:text-white">
                    {displayName}
                  </h2>
                  <p className="truncate text-sm text-gray-600 dark:text-gray-300">
                    {user.email}
                  </p>
                </div>
              </div>
              <div
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.chipClass}`}
              >
                <span>{statusMeta.emoji}</span>
                {statusMeta.label}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-200/80 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-black/20">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Username
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                  {user.username || '—'}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200/80 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-black/20">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Role
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                  {user.role}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200/80 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-black/20">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Created
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                  {new Date(user.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200/80 bg-white px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Actions</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Changes apply immediately and are audited.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {hasPermission('USERS_SUSPEND') && user.status === 'ACTIVE' && (
                <button
                  onClick={() => handleStatusChange('SUSPENDED')}
                  className={`${actionButtonClass} bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:hover:bg-amber-500/30`}
                >
                  <span>🟡</span>
                  Suspend
                </button>
              )}
              {hasPermission('USERS_SUSPEND') && user.status === 'SUSPENDED' && (
                <button
                  onClick={() => handleStatusChange('ACTIVE')}
                  className={`${actionButtonClass} bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:hover:bg-emerald-500/30`}
                >
                  <span>🟢</span>
                  Reactivate
                </button>
              )}
              {hasPermission('USERS_DEACTIVATE') && user.status !== 'DEACTIVATED' && (
                <button
                  onClick={() => handleStatusChange('DEACTIVATED')}
                  className={`${actionButtonClass} bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-200 dark:hover:bg-rose-500/30`}
                >
                  <span>🔴</span>
                  Deactivate
                </button>
              )}
              {isSuperAdmin && (
                <button
                  onClick={handleRoleChange}
                  className={`${actionButtonClass} bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-500/20 dark:text-violet-200 dark:hover:bg-violet-500/30`}
                >
                  <span>🔁</span>
                  {user.role === 'SuperAdmin' ? 'Demote to Admin' : 'Promote to SuperAdmin'}
                </button>
              )}
              {hasPermission('USERS_WRITE') && (
                <button
                  onClick={handleForcePasswordReset}
                  className={`${actionButtonClass} bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20`}
                >
                  <span>🔐</span>
                  Force Password Reset
                </button>
              )}
            </div>
          </div>

          {isSuperAdmin && isSeededUser && (
            <div className="rounded-2xl border border-rose-200/80 bg-rose-50/70 px-4 py-4 dark:border-rose-500/30 dark:bg-rose-500/10">
              <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                Seeded User Hard Delete
              </h3>
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-200/80">
                Use this only for seeded demo accounts.
              </p>
              <button
                onClick={handleHardDeleteSeededUser}
                className={`${actionButtonClass} mt-3 bg-rose-600 text-white hover:bg-rose-700`}
              >
                <span>🗑️</span>
                Hard Delete Seeded User
              </button>
            </div>
          )}

          {isSuperAdmin && user.role === 'Admin' && (
            <div className="rounded-2xl border border-gray-200/80 bg-white px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Permissions</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Grant or revoke admin capabilities.
              </p>
              <div className="mt-3 grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {ALL_PERMISSIONS.map((perm) => (
                  <label
                    key={perm}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200/80 bg-white px-2 py-1.5 text-xs dark:border-white/10 dark:bg-black/20"
                  >
                    <input
                      type="checkbox"
                      checked={currentPerms.has(perm)}
                      onChange={() => void handlePermissionToggle(perm)}
                      disabled={loading}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600"
                    />
                    <span className="text-gray-700 dark:text-gray-200">{perm}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title}
        message={confirmAction?.message}
        isDestructive={confirmAction?.isDestructive}
        isLoading={loading}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
};

export default UserManageModal;
