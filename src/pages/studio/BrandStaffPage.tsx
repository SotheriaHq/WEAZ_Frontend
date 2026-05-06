import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { brandStaffApi, type BrandStaffInvite, type BrandStaffMember } from '@/api/BrandStaffApi';
import type { RootState } from '@/store';
import type { BrandMemberRole, BrandMemberStatus } from '@/types/auth';
import { canManageStaff, getActiveBrandId } from '@/lib/brandAccess';

const ROLE_OPTIONS: Array<{ value: BrandMemberRole; label: string; description: string }> = [
  { value: 'MANAGER', label: 'Manager', description: 'Catalog, orders, messages, settings' },
  { value: 'CATALOG_MANAGER', label: 'Catalog manager', description: 'Catalog creation and maintenance' },
  { value: 'ORDER_MANAGER', label: 'Order manager', description: 'Order reads and updates' },
  { value: 'SUPPORT_AGENT', label: 'Support agent', description: 'Messages and order reads' },
  { value: 'VIEWER', label: 'Viewer', description: 'Read-only catalog and order visibility' },
];

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  REMOVED: 'Removed',
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return String(message[0] ?? fallback);
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
};

const formatIdentity = (member: BrandStaffMember) => {
  const name = [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
  return name || member.username || member.email || member.userId;
};

const BrandStaffPage: React.FC = () => {
  const user = useSelector((state: RootState) => state.user.profile);
  const brandId = getActiveBrandId(user);
  const canManage = canManageStaff(user, brandId);
  const [members, setMembers] = useState<BrandStaffMember[]>([]);
  const [invites, setInvites] = useState<BrandStaffInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<BrandMemberRole>('MANAGER');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [latestInviteToken, setLatestInviteToken] = useState<string | null>(null);

  const pendingInvites = useMemo(
    () => invites.filter((invite) => invite.status === 'PENDING'),
    [invites],
  );

  const load = useCallback(async () => {
    if (!brandId || !canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await brandStaffApi.list(brandId);
      setMembers(response.members);
      setInvites(response.invites);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load staff.'));
    } finally {
      setLoading(false);
    }
  }, [brandId, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!brandId || busyKey) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error('Enter an email address.');
      return;
    }

    setBusyKey('invite');
    setLatestInviteToken(null);
    try {
      const invite = await brandStaffApi.invite(brandId, { email: normalizedEmail, role });
      setEmail('');
      setRole('MANAGER');
      if (invite.inviteToken) setLatestInviteToken(invite.inviteToken);
      toast.success('Staff invite created.');
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to invite staff.'));
    } finally {
      setBusyKey(null);
    }
  };

  const updateMemberStatus = async (memberId: string, status: BrandMemberStatus) => {
    if (!brandId || busyKey) return;
    setBusyKey(`${memberId}:${status}`);
    try {
      await brandStaffApi.updateStatus(brandId, memberId, status);
      toast.success('Staff status updated.');
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to update staff status.'));
    } finally {
      setBusyKey(null);
    }
  };

  const updateMemberRole = async (memberId: string, nextRole: BrandMemberRole) => {
    if (!brandId || busyKey) return;
    setBusyKey(`${memberId}:role`);
    try {
      await brandStaffApi.updateRole(brandId, memberId, nextRole);
      toast.success('Staff role updated.');
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to update staff role.'));
    } finally {
      setBusyKey(null);
    }
  };

  const cancelInvite = async (inviteId: string) => {
    if (!brandId || busyKey) return;
    setBusyKey(`${inviteId}:cancel`);
    try {
      await brandStaffApi.cancelInvite(brandId, inviteId);
      toast.success('Invite cancelled.');
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to cancel invite.'));
    } finally {
      setBusyKey(null);
    }
  };

  if (!brandId || !canManage) {
    return (
      <div className="rounded-2xl border border-dashed border-black/10 bg-white/80 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
        You do not have permission to manage staff. Ask the brand owner for access.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-black/10 bg-white/85 p-5 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-950 dark:text-white">Brand staff</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Invite team members and control who can work inside this brand.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="rounded-lg border border-black/10 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">
            Refresh
          </button>
        </div>

        <form onSubmit={handleInvite} className="mt-5 grid gap-3 lg:grid-cols-[1fr_260px_auto]">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="staff@example.com"
            className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-slate-950"
          />
          <UniversalSelect
            value={role}
            onChange={(value) => setRole(value as BrandMemberRole)}
            options={ROLE_OPTIONS}
            optionAllowWrap
            selectedAllowWrap
          />
          <button type="submit" disabled={busyKey === 'invite'} className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            Invite
          </button>
        </form>

        {latestInviteToken ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
            Invite token: <span className="break-all font-mono">{latestInviteToken}</span>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-black/10 bg-white/85 p-5 dark:border-white/10 dark:bg-white/[0.04]">
        <h2 className="text-base font-semibold text-slate-950 dark:text-white">Team members</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-black/10 text-sm dark:divide-white/10">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {loading ? (
                <tr><td className="px-3 py-4 text-slate-500" colSpan={4}>Loading staff...</td></tr>
              ) : members.length === 0 ? (
                <tr><td className="px-3 py-4 text-slate-500" colSpan={4}>No staff members yet.</td></tr>
              ) : members.map((member) => (
                <tr key={member.id}>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-slate-900 dark:text-white">{formatIdentity(member)}</div>
                    <div className="text-xs text-slate-500">{member.email}</div>
                  </td>
                  <td className="px-3 py-3">
                    {member.role === 'OWNER' ? (
                      <span className="text-sm font-semibold">Owner</span>
                    ) : (
                      <UniversalSelect
                        value={member.role}
                        onChange={(value) => void updateMemberRole(member.id, value as BrandMemberRole)}
                        options={ROLE_OPTIONS}
                        disabled={Boolean(busyKey)}
                        optionCompact
                      />
                    )}
                  </td>
                  <td className="px-3 py-3">{STATUS_LABELS[member.status] ?? member.status}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {member.status !== 'ACTIVE' ? (
                        <button type="button" onClick={() => void updateMemberStatus(member.id, 'ACTIVE')} className="rounded-lg border px-2.5 py-1 text-xs font-semibold">
                          Reactivate
                        </button>
                      ) : member.role !== 'OWNER' ? (
                        <button type="button" onClick={() => void updateMemberStatus(member.id, 'SUSPENDED')} className="rounded-lg border px-2.5 py-1 text-xs font-semibold">
                          Suspend
                        </button>
                      ) : null}
                      {member.role !== 'OWNER' && member.status !== 'REMOVED' ? (
                        <button type="button" onClick={() => void updateMemberStatus(member.id, 'REMOVED')} className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600">
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white/85 p-5 dark:border-white/10 dark:bg-white/[0.04]">
        <h2 className="text-base font-semibold text-slate-950 dark:text-white">Pending invites</h2>
        <div className="mt-3 space-y-2">
          {pendingInvites.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/10 px-3 py-4 text-sm text-slate-500 dark:border-white/10">
              No pending invites.
            </div>
          ) : pendingInvites.map((invite) => (
            <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 px-3 py-3 dark:border-white/10">
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">{invite.email}</div>
                <div className="text-xs text-slate-500">{STATUS_LABELS[invite.status]} · {invite.role}</div>
              </div>
              <button type="button" onClick={() => void cancelInvite(invite.id)} className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600">
                Cancel
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default BrandStaffPage;
