import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { adminUsersApi } from '@/api/AdminApi';
import type { AdminUser } from '@/types/admin';
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

const ALL_PERMISSIONS = [
  'users.read',
  'users.update',
  'users.deactivate',
  'users.role.assign_admin',
  'users.role.assign_user',
  'users.data_export',
  'users.data_wipe',
  'brands.read',
  'brands.verify',
  'brands.suspend',
  'brands.store_read',
  'brands.store_verify',
  'brands.store_override',
  'products.read',
  'products.moderate',
  'collections.read',
  'collections.moderate',
  'featured.manage',
  'taxonomy.read',
  'taxonomy.write',
  'taxonomy.suggestions.moderate',
  'tags.read',
  'tags.moderate',
  'measurements.read',
  'measurements.review',
  'payouts.read',
  'payouts.process',
  'disputes.read',
  'disputes.resolve',
  'moderation.read',
  'moderation.write',
  'messaging.read',
  'messaging.moderate',
  'audit.read',
  'notifications.send',
  'system.settings.write',
  'system.sla.read',
  'system.sla.write',
  'system.data_retention.write',
  'system.feature_flags.write',
  'permissions.manage',
] as const;

type PermissionCode = (typeof ALL_PERMISSIONS)[number];

const UserManageModal: React.FC<Props> = ({ user, open, onClose, onUpdated }) => {
  const { isSuperAdmin, hasPermission } = useAdminPermissions();
  const [loading, setLoading] = useState(false);
  const [securityGate, setSecurityGate] = useState({
    actorEmail: '',
    actorUserIdConfirm: '',
    targetUserIdConfirm: '',
  });
  const [tempCredential, setTempCredential] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [livePermissions, setLivePermissions] = useState<string[]>([]);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    isDestructive: boolean;
    action: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    setLivePermissions(user?.permissions?.map((p) => p.permissionCode) ?? []);
  }, [user?.id, user?.permissions]);

  const currentPerms = useMemo(() => new Set(livePermissions), [livePermissions]);

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
  const isDeleted = user.status === 'DEACTIVATED';
  const isAdminTarget = user.role === 'Admin';

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
        const response = await adminUsersApi.forcePasswordReset(user.id);
        const payload = (response.data as any)?.data ?? response.data;
        if (payload?.temporaryPassword) {
          setTempCredential({
            email: payload.email ?? user.email,
            temporaryPassword: payload.temporaryPassword,
          });
          setShowPassword(false);
        }
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

  const handleDeleteAdminUser = () => {
    setConfirmAction({
      title: 'Delete admin user account?',
      message:
        'This permanently deletes the admin account and related personal data. This cannot be undone.',
      isDestructive: true,
      action: async () => {
        await adminUsersApi.deleteAdminUser(user.id);
        toast.success('Admin user deleted');
        onUpdated();
        onClose();
      },
    });
  };

  const handleRestoreDeletedAdmin = () => {
    setConfirmAction({
      title: 'Restore deleted admin?',
      message:
        'This restores the admin account to active status and re-enables access. Continue?',
      isDestructive: false,
      action: async () => {
        await adminUsersApi.updateStatus(user.id, 'ACTIVE', 'Restored by SuperAdmin from deleted state');
        toast.success('Admin restored successfully');
        onUpdated();
        onClose();
      },
    });
  };

  const handlePermanentDeleteAdmin = () => {
    setConfirmAction({
      title: 'Permanently delete this admin?',
      message:
        'Permanent delete cannot be reversed. This will remove the deactivated admin record from the database.',
      isDestructive: true,
      action: async () => {
        await adminUsersApi.permanentlyDeleteAdminUser(user.id);
        toast.success('Admin permanently deleted');
        onUpdated();
        onClose();
      },
    });
  };

  const handleReissueTemporaryPassword = async () => {
    if (!securityGate.actorEmail || !securityGate.actorUserIdConfirm || !securityGate.targetUserIdConfirm) {
      toast.error('All verification fields are required');
      return;
    }

    setLoading(true);
    try {
      const response = await adminUsersApi.reissueTempPassword(user.id, {
        actorEmail: securityGate.actorEmail,
        actorUserIdConfirm: securityGate.actorUserIdConfirm,
        targetUserIdConfirm: securityGate.targetUserIdConfirm,
      });
      const payload = (response.data as any)?.data ?? response.data;
      setTempCredential({
        email: payload.email,
        temporaryPassword: payload.temporaryPassword,
      });
      setShowPassword(false);
      toast.success('Temporary password reissued');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reissue temporary password');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = async (perm: PermissionCode) => {
    const newPerms = new Set(currentPerms);
    if (newPerms.has(perm)) {
      newPerms.delete(perm);
    } else {
      newPerms.add(perm);
    }
    setLoading(true);
    try {
      await adminUsersApi.updatePermissions(user.id, Array.from(newPerms));
      setLivePermissions(Array.from(newPerms));
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
      <Modal
        open={open}
        onClose={onClose}
        title=""
        size="lg"
        scope="viewport"
        glassBackdrop
        backdropStyle="light"
        className="border border-white/45 bg-white/72 backdrop-blur-2xl shadow-[0_30px_80px_-28px_rgba(15,23,42,0.55)] dark:border-white/15 dark:bg-slate-900/70"
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-200/80 bg-gradient-to-br from-white to-gray-50 px-4 py-4 dark:border-white/10 dark:from-white/10 dark:to-white/5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-sm font-bold text-white shadow-md">
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
              {isSuperAdmin && isAdminTarget && isDeleted && (
                <>
                  <button
                    onClick={handleRestoreDeletedAdmin}
                    className={`${actionButtonClass} bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:hover:bg-emerald-500/30`}
                  >
                    <span>♻️</span>
                    Restore Admin
                  </button>
                  <button
                    onClick={handlePermanentDeleteAdmin}
                    className={`${actionButtonClass} bg-rose-600 text-white hover:bg-rose-700`}
                  >
                    <span>🗑️</span>
                    Delete Permanently
                  </button>
                </>
              )}

              {hasPermission('USERS_DEACTIVATE') && user.status === 'ACTIVE' && (
                <button
                  onClick={() => handleStatusChange('SUSPENDED')}
                  className={`${actionButtonClass} bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:hover:bg-amber-500/30`}
                >
                  <span>🟡</span>
                  Suspend
                </button>
              )}
              {hasPermission('USERS_DEACTIVATE') && user.status === 'SUSPENDED' && (
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
              {isSuperAdmin && !isDeleted && (
                <button
                  onClick={handleRoleChange}
                  className={`${actionButtonClass} bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-500/20 dark:text-violet-200 dark:hover:bg-violet-500/30`}
                >
                  <span>🔁</span>
                  {user.role === 'SuperAdmin' ? 'Demote to Admin' : 'Promote to SuperAdmin'}
                </button>
              )}
              {isSuperAdmin && user.role === 'Admin' && !isDeleted && (
                <button
                  onClick={handleForcePasswordReset}
                  className={`${actionButtonClass} bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20`}
                >
                  <span>🔐</span>
                  Force Password Reset
                </button>
              )}
              {isSuperAdmin && user.role === 'Admin' && !isDeleted && (
                <button
                  onClick={handleDeleteAdminUser}
                  className={`${actionButtonClass} bg-rose-600 text-white hover:bg-rose-700`}
                >
                  <span>🗑️</span>
                  Delete Admin User
                </button>
              )}
            </div>
          </div>

          {isSuperAdmin && user.role === 'Admin' && !isDeleted && (
            <div className="rounded-2xl border border-gray-200/80 bg-white px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Temporary Password Reissue</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Current passwords are never viewable. Reissue a temporary password after SuperAdmin verification.
              </p>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="email"
                  value={securityGate.actorEmail}
                  onChange={(e) => setSecurityGate((prev) => ({ ...prev, actorEmail: e.target.value }))}
                  placeholder="Confirm your SuperAdmin email"
                  className="rounded-lg border border-gray-200/80 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-black/20"
                />
                <input
                  type="text"
                  value={securityGate.actorUserIdConfirm}
                  onChange={(e) => setSecurityGate((prev) => ({ ...prev, actorUserIdConfirm: e.target.value }))}
                  placeholder="Confirm your SuperAdmin user ID"
                  className="rounded-lg border border-gray-200/80 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-black/20"
                />
              </div>
              <input
                type="text"
                value={securityGate.targetUserIdConfirm}
                onChange={(e) => setSecurityGate((prev) => ({ ...prev, targetUserIdConfirm: e.target.value }))}
                placeholder="Confirm target admin user ID"
                className="mt-2 w-full rounded-lg border border-gray-200/80 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-black/20"
              />

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => void handleReissueTemporaryPassword()}
                  disabled={loading}
                  className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
                >
                  Reissue Temporary Password
                </button>
              </div>

              {tempCredential && (
                <div className="mt-3 rounded-xl border border-amber-200/70 bg-amber-50/70 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-200">One-time temporary credential</p>
                  <p className="mt-1 text-[11px] text-amber-700/90 dark:text-amber-200/90">Share securely and force user to rotate immediately.</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <input
                      readOnly
                      value={showPassword ? tempCredential.temporaryPassword : '••••••••••••••••'}
                      className="rounded-lg border border-amber-200/80 bg-white/90 px-3 py-2 text-xs text-slate-900 dark:border-amber-500/25 dark:bg-slate-900/60 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="rounded-lg border border-amber-300 bg-white/80 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-white dark:border-amber-500/30 dark:bg-slate-900/60 dark:text-amber-200"
                    >
                      {showPassword ? 'Hide' : 'Reveal'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(tempCredential.temporaryPassword);
                          toast.success('Temporary password copied');
                        } catch {
                          toast.error('Unable to copy password');
                        }
                      }}
                      className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

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

          {isSuperAdmin && user.role === 'Admin' && !isDeleted && (
            <div className="rounded-2xl border border-gray-200/80 bg-white px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Permissions</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Grant or revoke admin capabilities.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                      Granted
                    </h4>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                      {ALL_PERMISSIONS.filter((perm) => currentPerms.has(perm)).length}
                    </span>
                  </div>
                  <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                    {ALL_PERMISSIONS.filter((perm) => currentPerms.has(perm)).map((perm) => (
                      <label
                        key={perm}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-emerald-200/70 bg-white/75 px-2.5 py-1.5 text-xs dark:border-emerald-500/25 dark:bg-black/20"
                      >
                        <span className="truncate text-gray-800 dark:text-gray-100">{perm}</span>
                        <input
                          type="checkbox"
                          checked={true}
                          onChange={() => void handlePermissionToggle(perm)}
                          disabled={loading}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600"
                        />
                      </label>
                    ))}
                    {ALL_PERMISSIONS.filter((perm) => currentPerms.has(perm)).length === 0 && (
                      <p className="text-xs text-emerald-700/80 dark:text-emerald-200/80">No permissions granted.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-black/20">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                      Available
                    </h4>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-white/15 dark:text-slate-200">
                      {ALL_PERMISSIONS.filter((perm) => !currentPerms.has(perm)).length}
                    </span>
                  </div>
                  <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                    {ALL_PERMISSIONS.filter((perm) => !currentPerms.has(perm)).map((perm) => (
                      <label
                        key={perm}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-white/80 px-2.5 py-1.5 text-xs dark:border-white/10 dark:bg-black/25"
                      >
                        <span className="truncate text-gray-700 dark:text-gray-200">{perm}</span>
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => void handlePermissionToggle(perm)}
                          disabled={loading}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600"
                        />
                      </label>
                    ))}
                  </div>
                </div>
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
