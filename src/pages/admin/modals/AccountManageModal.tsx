import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AdminInsightPanel from '@/components/admin/AdminInsightPanel';
import { adminUsersApi, adminBrandsApi } from '@/api/AdminApi';
import type { AdminUser, AdminBrand, AdminBrandOverview } from '@/types/admin';
import { unwrapApiResponse } from '@/types/auth';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { toast } from 'sonner';

/**
 * Unified account lifecycle modal for the admin Users console.
 *
 * A brand account IS a user (`type === 'BRAND'`), so this one modal manages the
 * full lifecycle of shoppers, brands, and admins. It fetches the rich
 * `getById` payload (suspension/deactivation reasons + timestamps, brand,
 * permissions) so the surface is never limited to the lean list row, and — for
 * brand accounts — adds store open/close, brand suspend, and a jump into the
 * verification review. Supersedes the old thin BrandDetailModal.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  /** Seed for a shopper/admin row. */
  seedUser?: AdminUser | null;
  /** Seed for a brand row (its owner is the managed account). */
  seedBrand?: AdminBrand | null;
}

/** Rich shape returned by `GET /admin/users/:id` (superset of the list row). */
type AccountDetail = Omit<AdminUser, 'permissions'> & {
  mustResetPassword?: boolean;
  adminSuspendedAt?: string | null;
  adminSuspendedReason?: string | null;
  deactivatedAt?: string | null;
  deactivatedReason?: string | null;
  brand?: { id: string; name: string | null; isStoreOpen?: boolean } | null;
  permissions?: string[] | { permissionCode: string }[];
};

const STATUS_META: Record<string, { emoji: string; label: string; chipClass: string }> = {
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
    ...String(import.meta.env.VITE_SEEDED_USER_EMAILS || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
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
  'market.governance.read',
  'market.governance.write',
  'market.governance.release',
  'market.ranking.formula.write',
  'market.ranking.rollback',
  'market.suggestions.write',
  'notifications.send',
  'system.settings.write',
  'system.sla.read',
  'system.sla.write',
  'system.data_retention.write',
  'system.feature_flags.write',
  'permissions.manage',
] as const;

type PermissionCode = (typeof ALL_PERMISSIONS)[number];

const normalizePermissions = (
  value: string[] | { permissionCode: string }[] | undefined,
): string[] =>
  Array.isArray(value)
    ? value.map((entry) => (typeof entry === 'string' ? entry : entry.permissionCode))
    : [];

const actionButtonClass =
  'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-inherit dark:focus-visible:ring-offset-black';

/**
 * Query param that reopens this modal for a brand. It is written into the
 * history entry we leave behind before navigating to a store / order /
 * verification review, so pressing Back returns to the screen the admin was
 * actually on — the console with this brand open — instead of a bare list.
 */
export const BRAND_MANAGE_PARAM = 'manageBrand';

const VERIFICATION_META: Record<string, { emoji: string; label: string; tone: string }> = {
  NOT_SUBMITTED: { emoji: '⚪', label: 'Not submitted', tone: 'text-gray-500 dark:text-gray-400' },
  PENDING: { emoji: '🟡', label: 'Pending review', tone: 'text-amber-700 dark:text-amber-300' },
  IN_REVIEW: { emoji: '🔵', label: 'In review', tone: 'text-sky-700 dark:text-sky-300' },
  ADDITIONAL_INFO_REQUESTED: { emoji: '🟠', label: 'Info requested', tone: 'text-orange-700 dark:text-orange-300' },
  APPROVED: { emoji: '🟢', label: 'Approved', tone: 'text-emerald-700 dark:text-emerald-300' },
  REJECTED: { emoji: '🔴', label: 'Rejected', tone: 'text-rose-700 dark:text-rose-300' },
  CANCELLED: { emoji: '⚫', label: 'Cancelled', tone: 'text-gray-500 dark:text-gray-400' },
};

const REMINDER_LABELS: Record<string, string> = {
  ORDER_FULFILLMENT_REMINDER: 'Fulfilment reminder',
  ORDER_FULFILLMENT_OVERDUE: 'Fulfilment overdue',
  CUSTOM_ORDER_REVIEW_REQUIRED: 'Custom order needs review',
  CUSTOM_ORDER_STALE_STAGE_WARNING: 'Custom order stalled',
  CUSTOM_ORDER_ACCEPTANCE_SLA_RISK: 'Acceptance SLA at risk',
  CUSTOM_ORDER_ADMIN_REVIEW_TRIGGERED: 'Escalated to admin review',
};

const TRANSACTION_LABELS: Record<string, string> = {
  ORDER: '🛍️ Store order',
  CUSTOM_ORDER: '✂️ Custom order',
  PAYOUT: '🏦 Payout',
};

const formatMoney = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency || 'NGN',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || 'NGN'} ${amount.toLocaleString()}`;
  }
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : '—';

const humanize = (value: string) =>
  value.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());

const AccountManageModal: React.FC<Props> = ({
  open,
  onClose,
  onUpdated,
  seedUser,
  seedBrand,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSuperAdmin, hasPermission } = useAdminPermissions();

  const targetUserId = seedUser?.id ?? seedBrand?.owner?.id ?? null;
  const seedBrandId = seedBrand?.id ?? null;

  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [overview, setOverview] = useState<AdminBrandOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewFailed, setOverviewFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [securityGate, setSecurityGate] = useState({
    actorEmail: '',
    actorUserIdConfirm: '',
    targetUserIdConfirm: '',
  });
  const [tempCredential, setTempCredential] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [livePermissions, setLivePermissions] = useState<string[]>([]);
  const [suspendReason, setSuspendReason] = useState('');
  const [showBrandSuspendForm, setShowBrandSuspendForm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    isDestructive: boolean;
    action: () => Promise<void>;
  } | null>(null);

  // Fetch the rich detail whenever the modal opens for a target account.
  useEffect(() => {
    if (!open || !targetUserId) return;
    let mounted = true;
    setDetailLoading(true);
    setTempCredential(null);
    setShowBrandSuspendForm(false);
    setSuspendReason('');
    (async () => {
      try {
        const res = await adminUsersApi.getById(targetUserId);
        const payload = unwrapApiResponse<AccountDetail>(res.data as any);
        if (!mounted) return;
        setDetail(payload);
        setLivePermissions(normalizePermissions(payload.permissions));
      } catch {
        if (mounted) setDetail(null);
      } finally {
        if (mounted) setDetailLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open, targetUserId]);

  // Brand overview: storefront reachability, verification reviewability,
  // content counts, transactions, reminders and disputes in one read. Only
  // brand accounts have one, and `brandId` may only resolve after the detail
  // fetch when the modal was opened from the Shoppers/Team tabs.
  const overviewBrandId = seedBrandId ?? detail?.brand?.id ?? null;
  useEffect(() => {
    if (!open || !overviewBrandId) {
      setOverview(null);
      setOverviewFailed(false);
      return;
    }
    let mounted = true;
    setOverviewLoading(true);
    setOverviewFailed(false);
    (async () => {
      try {
        const res = await adminBrandsApi.getOverview(overviewBrandId);
        const payload = unwrapApiResponse<AdminBrandOverview>(res.data as any);
        if (mounted) setOverview(payload);
      } catch {
        // Fail open: the overview is enrichment, not a gate. Losing it must not
        // strip an admin of controls this modal has always offered.
        if (mounted) {
          setOverview(null);
          setOverviewFailed(true);
        }
      } finally {
        if (mounted) setOverviewLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open, overviewBrandId]);

  const currentPerms = useMemo(() => new Set(livePermissions), [livePermissions]);

  // Header falls back to the seed row while the detail is loading.
  const seedName = seedUser
    ? `${seedUser.firstName ?? ''} ${seedUser.lastName ?? ''}`.trim() || seedUser.email
    : seedBrand
      ? seedBrand.name ||
        `${seedBrand.owner?.firstName ?? ''} ${seedBrand.owner?.lastName ?? ''}`.trim() ||
        seedBrand.owner?.email ||
        'Account'
      : 'Account';
  const seedEmail = seedUser?.email ?? seedBrand?.owner?.email ?? '';

  const email = detail?.email ?? seedEmail;
  const displayName = detail
    ? `${detail.firstName ?? ''} ${detail.lastName ?? ''}`.trim() || detail.email
    : seedName;
  const initials =
    `${(detail?.firstName ?? seedUser?.firstName ?? seedBrand?.owner?.firstName ?? '')[0] ?? ''}${
      (detail?.lastName ?? seedUser?.lastName ?? seedBrand?.owner?.lastName ?? '')[0] ?? ''
    }`
      .toUpperCase()
      .slice(0, 2) || 'U';
  const status = detail?.status ?? seedUser?.status ?? (seedBrand?.owner?.status as AccountDetail['status']) ?? 'ACTIVE';
  const statusMeta = STATUS_META[status] ?? {
    emoji: '⚪',
    label: status,
    chipClass:
      'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-white/10 dark:text-gray-300 dark:border-white/20',
  };

  const isBrandAccount = detail?.type === 'BRAND' || Boolean(seedBrand);
  const brandId = seedBrandId ?? detail?.brand?.id ?? null;
  const brandName = seedBrand?.name ?? detail?.brand?.name ?? null;
  const isStoreOpen =
    overview?.brand.isStoreOpen ?? seedBrand?.isStoreOpen ?? detail?.brand?.isStoreOpen ?? false;

  const isSeededUser = email ? SEEDED_USER_EMAILS.has(email.toLowerCase()) : false;
  const isDeleted = status === 'DEACTIVATED';
  const role = detail?.role ?? seedUser?.role ?? 'User';
  const isAdminTarget = role === 'Admin';
  const canChangeRoles =
    isSuperAdmin && hasPermission('USERS_ROLE_ASSIGN_ADMIN') && hasPermission('USERS_ROLE_ASSIGN_USER');
  const canUpdateSensitiveUserAccess = isSuperAdmin && hasPermission('USERS_UPDATE');
  const canManagePermissions = isSuperAdmin && hasPermission('PERMISSIONS_MANAGE');
  const canWipeUserData = isSuperAdmin && hasPermission('USERS_DATA_WIPE');
  const canDeactivateAccounts = hasPermission('USERS_DEACTIVATE');
  const canStoreOverride = hasPermission('BRANDS_STORE_OVERRIDE');
  const canSuspendBrand = hasPermission('BRANDS_SUSPEND');
  const canReviewVerification = hasPermission('BRANDS_VERIFY');
  // Drill-through targets are permission-guarded routes; don't offer a link
  // that would bounce the admin back to the dashboard.
  const canViewOrders = hasPermission('PAYOUTS_READ');
  const canViewCustomOrders = hasPermission('MODERATION_READ');

  const requireTarget = (): string | null => {
    if (!targetUserId) {
      toast.error('No account selected');
      return null;
    }
    return targetUserId;
  };

  const handleStatusChange = (nextStatus: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED') => {
    const id = requireTarget();
    if (!id) return;
    const labels: Record<typeof nextStatus, string> = {
      ACTIVE: 'reactivate',
      SUSPENDED: 'suspend',
      DEACTIVATED: 'deactivate',
    };
    setConfirmAction({
      title: `${labels[nextStatus]} ${displayName}?`,
      message: `${email} will be set to ${nextStatus}.`,
      isDestructive: nextStatus !== 'ACTIVE',
      action: async () => {
        await adminUsersApi.updateStatus(id, nextStatus);
        toast.success(`Account ${nextStatus.toLowerCase()} successfully`);
        onUpdated();
        onClose();
      },
    });
  };

  const handleRoleChange = () => {
    const id = requireTarget();
    if (!id) return;
    const newRole = role === 'SuperAdmin' ? 'Admin' : 'SuperAdmin';
    setConfirmAction({
      title: `Change role to ${newRole}?`,
      message: `${email} will ${newRole === 'SuperAdmin' ? 'gain' : 'lose'} SuperAdmin privileges.`,
      isDestructive: newRole === 'Admin',
      action: async () => {
        await adminUsersApi.updateRole(id, newRole);
        toast.success(`Role updated to ${newRole}`);
        onUpdated();
        onClose();
      },
    });
  };

  const handleForcePasswordReset = () => {
    const id = requireTarget();
    if (!id) return;
    setConfirmAction({
      title: 'Force password reset?',
      message: `${email} will be logged out and required to set a new password.`,
      isDestructive: true,
      action: async () => {
        const response = await adminUsersApi.forcePasswordReset(id);
        const payload = (response.data as any)?.data ?? response.data;
        if (payload?.temporaryPassword) {
          setTempCredential({ email: payload.email ?? email, temporaryPassword: payload.temporaryPassword });
          setShowPassword(false);
        }
        toast.success('Password reset forced');
        onUpdated();
      },
    });
  };

  const handleHardDeleteSeededUser = () => {
    const id = requireTarget();
    if (!id) return;
    setConfirmAction({
      title: 'Hard-delete seeded user?',
      message: 'This permanently removes the seeded user account. This cannot be undone.',
      isDestructive: true,
      action: async () => {
        await adminUsersApi.hardDeleteSeeded(id);
        toast.success('Seeded user hard-deleted');
        onUpdated();
        onClose();
      },
    });
  };

  const handleDeleteAdminUser = () => {
    const id = requireTarget();
    if (!id) return;
    setConfirmAction({
      title: 'Delete admin user account?',
      message: 'This permanently deletes the admin account and related personal data. This cannot be undone.',
      isDestructive: true,
      action: async () => {
        await adminUsersApi.deleteAdminUser(id);
        toast.success('Admin user deleted');
        onUpdated();
        onClose();
      },
    });
  };

  const handleRestoreDeletedAdmin = () => {
    const id = requireTarget();
    if (!id) return;
    setConfirmAction({
      title: 'Restore deleted admin?',
      message: 'This restores the admin account to active status and re-enables access. Continue?',
      isDestructive: false,
      action: async () => {
        await adminUsersApi.updateStatus(id, 'ACTIVE', 'Restored by SuperAdmin from deleted state');
        toast.success('Admin restored successfully');
        onUpdated();
        onClose();
      },
    });
  };

  const handlePermanentDeleteAdmin = () => {
    const id = requireTarget();
    if (!id) return;
    setConfirmAction({
      title: 'Permanently delete this admin?',
      message: 'Permanent delete cannot be reversed. This will remove the deactivated admin record from the database.',
      isDestructive: true,
      action: async () => {
        await adminUsersApi.permanentlyDeleteAdminUser(id);
        toast.success('Admin permanently deleted');
        onUpdated();
        onClose();
      },
    });
  };

  const handleReissueTemporaryPassword = async () => {
    const id = requireTarget();
    if (!id) return;
    if (!securityGate.actorEmail || !securityGate.actorUserIdConfirm || !securityGate.targetUserIdConfirm) {
      toast.error('All verification fields are required');
      return;
    }
    setLoading(true);
    try {
      const response = await adminUsersApi.reissueTempPassword(id, {
        actorEmail: securityGate.actorEmail,
        actorUserIdConfirm: securityGate.actorUserIdConfirm,
        targetUserIdConfirm: securityGate.targetUserIdConfirm,
      });
      const payload = (response.data as any)?.data ?? response.data;
      setTempCredential({ email: payload.email, temporaryPassword: payload.temporaryPassword });
      setShowPassword(false);
      toast.success('Temporary password reissued');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reissue temporary password');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = async (perm: PermissionCode) => {
    const id = requireTarget();
    if (!id) return;
    const newPerms = new Set(currentPerms);
    if (newPerms.has(perm)) newPerms.delete(perm);
    else newPerms.add(perm);
    setLoading(true);
    try {
      await adminUsersApi.updatePermissions(id, Array.from(newPerms));
      setLivePermissions(Array.from(newPerms));
      toast.success('Permissions updated');
      onUpdated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update permissions');
    } finally {
      setLoading(false);
    }
  };

  // ── Brand-specific controls ──────────────────────────────────────────────
  const handleStoreToggle = () => {
    if (!brandId) return;
    const nextOpen = !isStoreOpen;
    setConfirmAction({
      title: `${nextOpen ? 'Open' : 'Close'} store for ${brandName ?? displayName}?`,
      message: `The store will be ${nextOpen ? 'visible to customers' : 'hidden from customers'}.`,
      isDestructive: !nextOpen,
      action: async () => {
        await adminBrandsApi.overrideStoreOpen(brandId, nextOpen);
        toast.success(`Store ${nextOpen ? 'opened' : 'closed'}`);
        onUpdated();
        onClose();
      },
    });
  };

  const handleBrandSuspend = async () => {
    if (!brandId) return;
    if (!suspendReason.trim()) {
      toast.error('Suspension reason is required');
      return;
    }
    setLoading(true);
    try {
      await adminBrandsApi.suspend(brandId, suspendReason.trim());
      toast.success('Brand suspended');
      setSuspendReason('');
      setShowBrandSuspendForm(false);
      onUpdated();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to suspend brand');
    } finally {
      setLoading(false);
    }
  };

  // ── Drill-through navigation ─────────────────────────────────────────────
  /**
   * Push the destination carrying the console URL as its `returnTo`.
   *
   * The console URL already holds `?manageBrand=<id>` while this modal is open,
   * so the entry we leave behind reopens the modal: browser Back, a swipe, or
   * the destination's own back link all land on the screen the admin was on —
   * this brand, still open — instead of some other list. Deliberately does NOT
   * call `onClose()`, which would strip that param from the entry we're leaving.
   */
  const navigateAway = useCallback(
    (to: string) => {
      const params = new URLSearchParams(location.search);
      if (brandId) params.set(BRAND_MANAGE_PARAM, brandId);
      const search = params.toString();
      const restoreTo = search ? `${location.pathname}?${search}` : location.pathname;
      navigate(to, {
        state: {
          returnTo: restoreTo,
          returnLabel: `Back to ${brandName ?? displayName}`,
        },
      });
    },
    [brandId, brandName, displayName, location.pathname, location.search, navigate],
  );

  const verificationStatus = overview?.verification.status ?? null;
  const verificationMeta = verificationStatus
    ? (VERIFICATION_META[verificationStatus] ?? {
        emoji: '⚪',
        label: humanize(verificationStatus),
        tone: 'text-gray-500 dark:text-gray-400',
      })
    : null;
  // Nothing was ever submitted → there is no review to open. A closed review
  // (approved/rejected/cancelled) still has a record worth reading, so it stays
  // reachable but is relabelled so the button never implies pending work.
  // When the overview itself failed we keep the button live rather than
  // stranding the admin behind a read that is only meant to inform.
  const canOpenVerification = Boolean(
    brandId &&
      !overviewLoading &&
      (overview ? overview.verification.hasSubmission : overviewFailed),
  );
  const verificationButtonLabel =
    overview && !overview.verification.isReviewOpen
      ? '🪪 View verification record'
      : '🪪 Open verification review';
  const verificationDisabledReason = overviewLoading
    ? 'Loading verification state…'
    : 'This brand has not submitted store verification yet.';

  const openVerificationReview = useCallback(() => {
    if (!brandId || !canOpenVerification) return;
    navigateAway(`/admin/brands/${brandId}/verification-review`);
  }, [brandId, canOpenVerification, navigateAway]);

  // The public storefront resolves by owner username and 404s while the store
  // is closed; the server returns null for the slug in that case. The local
  // fallback applies the same two conditions so the button is usable on the
  // first paint (and if the overview read fails) instead of dead.
  const ownerUsername =
    detail?.username || seedBrand?.owner?.username || seedUser?.username || null;
  const storefrontSlug =
    overview?.brand.storefrontSlug ?? (isStoreOpen ? ownerUsername : null);
  const openStorefront = useCallback(() => {
    if (!storefrontSlug) return;
    navigateAway(`/brand/${encodeURIComponent(storefrontSlug)}`);
  }, [navigateAway, storefrontSlug]);

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

  if (!open || !targetUserId) return null;

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
        className="border border-white/45 bg-white/[0.72] backdrop-blur-2xl shadow-[0_30px_80px_-28px_rgba(15,23,42,0.55)] dark:border-white/15 dark:bg-slate-900/70"
      >
        <div className="space-y-5">
          {/* Identity header */}
          <div className="rounded-2xl border border-gray-200/80 bg-gradient-to-br from-white to-gray-50 px-4 py-4 dark:border-white/10 dark:from-white/10 dark:to-white/5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-sm font-bold text-white shadow-md">
                  {initials}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-gray-900 dark:text-white">{displayName}</h2>
                  <p className="truncate text-sm text-gray-600 dark:text-gray-300">{email}</p>
                </div>
              </div>
              <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta.chipClass}`}>
                <span>{statusMeta.emoji}</span>
                {statusMeta.label}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-200/80 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-black/20">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Username</p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                  {detail?.username || seedUser?.username || seedBrand?.owner?.username || '—'}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200/80 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-black/20">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {isBrandAccount ? 'Account type' : 'Role'}
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                  {isBrandAccount ? 'Brand' : role}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200/80 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-black/20">
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Created</p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                  {detail?.createdAt ? new Date(detail.createdAt).toLocaleString() : detailLoading ? 'Loading…' : '—'}
                </p>
              </div>
            </div>

            {/* Lifecycle context — the reasons/timestamps the lean list omits. */}
            {(detail?.adminSuspendedReason || detail?.deactivatedReason) && (
              <div className="mt-3 space-y-1 rounded-xl border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                {detail?.adminSuspendedReason && (
                  <p>
                    <span className="font-semibold">Suspended:</span> {detail.adminSuspendedReason}
                    {detail.adminSuspendedAt ? ` · ${new Date(detail.adminSuspendedAt).toLocaleString()}` : ''}
                  </p>
                )}
                {detail?.deactivatedReason && (
                  <p>
                    <span className="font-semibold">Deactivated:</span> {detail.deactivatedReason}
                    {detail.deactivatedAt ? ` · ${new Date(detail.deactivatedAt).toLocaleString()}` : ''}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Account lifecycle actions */}
          <div className="rounded-2xl border border-gray-200/80 bg-white px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Account lifecycle</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Changes apply immediately and are audited.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {canWipeUserData && isAdminTarget && isDeleted && (
                <>
                  <button onClick={handleRestoreDeletedAdmin} className={`${actionButtonClass} bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:hover:bg-emerald-500/30`}>
                    <span>♻️</span> Restore Admin
                  </button>
                  <button onClick={handlePermanentDeleteAdmin} className={`${actionButtonClass} bg-rose-600 text-white hover:bg-rose-700`}>
                    <span>🗑️</span> Delete Permanently
                  </button>
                </>
              )}

              {/* Brands suspend via the reasoned brand control below, not the generic flip. */}
              {canDeactivateAccounts && status === 'ACTIVE' && !isBrandAccount && (
                <button onClick={() => handleStatusChange('SUSPENDED')} className={`${actionButtonClass} bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:hover:bg-amber-500/30`}>
                  <span>🟡</span> Suspend
                </button>
              )}
              {canDeactivateAccounts && status === 'SUSPENDED' && (
                <button onClick={() => handleStatusChange('ACTIVE')} className={`${actionButtonClass} bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:hover:bg-emerald-500/30`}>
                  <span>🟢</span> Reactivate
                </button>
              )}
              {canDeactivateAccounts && status !== 'DEACTIVATED' && (
                <button onClick={() => handleStatusChange('DEACTIVATED')} className={`${actionButtonClass} bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-200 dark:hover:bg-rose-500/30`}>
                  <span>🔴</span> Deactivate
                </button>
              )}
              {canChangeRoles && !isDeleted && !isBrandAccount && (role === 'SuperAdmin' || role === 'Admin') && (
                <button onClick={handleRoleChange} className={`${actionButtonClass} bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-500/20 dark:text-violet-200 dark:hover:bg-violet-500/30`}>
                  <span>🔁</span> {role === 'SuperAdmin' ? 'Demote to Admin' : 'Promote to SuperAdmin'}
                </button>
              )}
              {canUpdateSensitiveUserAccess && isAdminTarget && !isDeleted && (
                <button onClick={handleForcePasswordReset} className={`${actionButtonClass} bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20`}>
                  <span>🔐</span> Force Password Reset
                </button>
              )}
              {canWipeUserData && isAdminTarget && !isDeleted && (
                <button onClick={handleDeleteAdminUser} className={`${actionButtonClass} bg-rose-600 text-white hover:bg-rose-700`}>
                  <span>🗑️</span> Delete Admin User
                </button>
              )}
            </div>
          </div>

          {/* Brand storefront controls. Rendered for every brand account —
              "View store" opens a public page and needs no extra grant; the
              override/suspend/verify buttons keep their own permission gates. */}
          {isBrandAccount && brandId && (
            <div className="rounded-2xl border border-indigo-200/70 bg-indigo-50/50 px-4 py-4 dark:border-indigo-500/25 dark:bg-indigo-500/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">🏷️ Brand & storefront</h3>
                <div className="flex flex-wrap items-center gap-2">
                  {verificationMeta && (
                    <span className={`text-[11px] font-semibold ${verificationMeta.tone}`}>
                      {verificationMeta.emoji} {verificationMeta.label}
                    </span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isStoreOpen ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200'}`}>
                    {isStoreOpen ? '🟢 Store open' : '🔴 Store closed'}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={openStorefront}
                  disabled={!storefrontSlug}
                  title={
                    storefrontSlug
                      ? `Open ${brandName ?? displayName}'s public storefront`
                      : overviewLoading
                        ? 'Loading storefront state…'
                        : 'This brand has no open storefront to view.'
                  }
                  className={`${actionButtonClass} bg-violet-100 text-violet-800 hover:bg-violet-200 dark:bg-violet-500/15 dark:text-violet-200 dark:hover:bg-violet-500/25`}
                >
                  🛍️ View store
                </button>
                {canStoreOverride && (
                  <button onClick={handleStoreToggle} className={`${actionButtonClass} bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/25`}>
                    {isStoreOpen ? '🔴 Force close store' : '🟢 Force open store'}
                  </button>
                )}
                {canSuspendBrand && (
                  <button onClick={() => setShowBrandSuspendForm((v) => !v)} className={`${actionButtonClass} bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25`}>
                    🚫 Suspend brand
                  </button>
                )}
                {canReviewVerification && (
                  <button
                    onClick={openVerificationReview}
                    disabled={!canOpenVerification}
                    title={canOpenVerification ? undefined : verificationDisabledReason}
                    className={`${actionButtonClass} bg-sky-100 text-sky-800 hover:bg-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:hover:bg-sky-500/25`}
                  >
                    {verificationButtonLabel}
                  </button>
                )}
              </div>

              {showBrandSuspendForm && (
                <div className="mt-3 space-y-2 rounded-xl border border-rose-200 bg-white/70 p-3 dark:border-rose-500/25 dark:bg-black/20">
                  <label className="block text-xs font-semibold text-rose-700 dark:text-rose-300">Suspension reason</label>
                  <textarea
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm dark:border-rose-500/30 dark:bg-black/20 dark:text-white"
                    placeholder="Reason for suspension (required)…"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => void handleBrandSuspend()} disabled={loading || !suspendReason.trim()} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                      {loading ? 'Suspending…' : 'Confirm suspend'}
                    </button>
                    <button onClick={() => { setShowBrandSuspendForm(false); setSuspendReason(''); }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Brand insight panels — inline containers, each scrolling in place */}
          {isBrandAccount && brandId && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <AdminInsightPanel
                emoji="📦"
                title="Content"
                loading={overviewLoading && !overview}
                isEmpty={!overview}
                empty="Content counts unavailable."
                maxHeightClass="max-h-40"
              >
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                  {[
                    { label: 'Designs', value: overview?.content.designs, note: `${overview?.content.designsPublished ?? 0} live` },
                    { label: 'Products', value: overview?.content.products, note: `${overview?.content.productsLive ?? 0} live` },
                    { label: 'In review', value: overview?.content.productsInReview, note: `${overview?.content.productsDraft ?? 0} drafts` },
                    { label: 'Collections', value: overview?.content.storeCollections, note: `${overview?.content.posts ?? 0} posts` },
                  ].map((cell) => (
                    <div key={cell.label}>
                      <dt className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{cell.label}</dt>
                      <dd className="text-lg font-bold leading-tight text-gray-900 dark:text-white">{cell.value ?? 0}</dd>
                      <dd className="text-[11px] text-gray-500 dark:text-gray-400">{cell.note}</dd>
                    </div>
                  ))}
                </dl>
              </AdminInsightPanel>

              <AdminInsightPanel
                emoji="💳"
                title="Transactions"
                badge={overview ? overview.transactions.items.length : undefined}
                loading={overviewLoading && !overview}
                isEmpty={!overview?.transactions.items.length}
                empty="No paid orders or payouts yet."
                maxHeightClass="max-h-40"
              >
                {overview && (
                  <p className="mb-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                    <span className="text-emerald-700 dark:text-emerald-300">
                      {formatMoney(overview.transactions.grossInflow, overview.transactions.currency)} in
                    </span>
                    {' · '}
                    <span className="text-amber-700 dark:text-amber-300">
                      {formatMoney(overview.transactions.paidOut, overview.transactions.currency)} paid out
                    </span>
                  </p>
                )}
                <ul className="space-y-2">
                  {overview?.transactions.items.map((item) => {
                    const to = item.orderId
                      ? canViewOrders
                        ? `/admin/orders/${item.orderId}`
                        : null
                      : item.customOrderId
                        ? canViewCustomOrders
                          ? `/admin/custom-orders/${item.customOrderId}`
                          : null
                        : null;
                    return (
                      <li key={item.id} className="flex items-baseline justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-800 dark:text-gray-100">
                            {TRANSACTION_LABELS[item.kind] ?? item.kind} · {item.title}
                          </p>
                          <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                            {formatDate(item.occurredAt)} · {humanize(item.status)}
                            {item.reference ? ` · ${item.reference}` : ''}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={`font-bold ${item.direction === 'IN' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                            {item.direction === 'IN' ? '+' : '−'}
                            {formatMoney(item.amount, item.currency)}
                          </p>
                          {to && (
                            <button type="button" onClick={() => navigateAway(to)} className="text-[11px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                              View →
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </AdminInsightPanel>

              <AdminInsightPanel
                emoji="⏰"
                title="Order reminders sent"
                badge={overview ? overview.reminders.length : undefined}
                loading={overviewLoading && !overview}
                isEmpty={!overview?.reminders.length}
                empty="No fulfilment reminders have been sent to this brand."
                maxHeightClass="max-h-40"
              >
                <ul className="space-y-2">
                  {overview?.reminders.map((reminder) => {
                    const to = reminder.orderId
                      ? canViewOrders
                        ? `/admin/orders/${reminder.orderId}`
                        : null
                      : reminder.customOrderId
                        ? canViewCustomOrders
                          ? `/admin/custom-orders/${reminder.customOrderId}`
                          : null
                        : null;
                    return (
                      <li key={reminder.id} className="flex items-baseline justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-800 dark:text-gray-100">
                            {REMINDER_LABELS[reminder.type] ?? humanize(reminder.type)}
                          </p>
                          <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                            {formatDate(reminder.createdAt)}
                            {reminder.detail ? ` · ${humanize(reminder.detail)}` : ''}
                            {reminder.isRead ? '' : ' · unread'}
                          </p>
                        </div>
                        {to ? (
                          <button type="button" onClick={() => navigateAway(to)} className="shrink-0 text-[11px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                            View order →
                          </button>
                        ) : (
                          <span className="shrink-0 text-[11px] text-gray-400">No order link</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </AdminInsightPanel>

              <AdminInsightPanel
                emoji="⚖️"
                title="Disputes"
                badge={
                  overview
                    ? `${overview.disputes.filter((d) => d.isOpen).length} open / ${overview.disputes.length}`
                    : undefined
                }
                loading={overviewLoading && !overview}
                isEmpty={!overview?.disputes.length}
                empty="No disputes raised against this brand's orders."
                maxHeightClass="max-h-40"
              >
                <ul className="space-y-2">
                  {overview?.disputes.map((dispute) => {
                    const isCustom = dispute.targetType === 'CUSTOM_ORDER';
                    const to = isCustom
                      ? canViewCustomOrders
                        ? `/admin/custom-orders/${dispute.targetId}`
                        : null
                      : canViewOrders
                        ? `/admin/orders/${dispute.targetId}`
                        : null;
                    return (
                      <li key={dispute.id} className="flex items-baseline justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-800 dark:text-gray-100">
                            <span className={dispute.isOpen ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}>
                              {dispute.isOpen ? '🔴' : '🟢'} {humanize(dispute.status)}
                            </span>{' '}
                            · {isCustom ? 'Custom order' : 'Store order'}
                          </p>
                          <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                            {formatDate(dispute.createdAt)} · {dispute.description}
                          </p>
                        </div>
                        {to && (
                          <button type="button" onClick={() => navigateAway(to)} className="shrink-0 text-[11px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                            View order →
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </AdminInsightPanel>
            </div>
          )}

          {/* Temporary password reissue (admins) */}
          {canUpdateSensitiveUserAccess && isAdminTarget && !isDeleted && (
            <div className="rounded-2xl border border-gray-200/80 bg-white px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Temporary Password Reissue</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Current passwords are never viewable. Reissue a temporary password after SuperAdmin verification.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input type="email" value={securityGate.actorEmail} onChange={(e) => setSecurityGate((p) => ({ ...p, actorEmail: e.target.value }))} placeholder="Confirm your SuperAdmin email" className="rounded-lg border border-gray-200/80 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-black/20" />
                <input type="text" value={securityGate.actorUserIdConfirm} onChange={(e) => setSecurityGate((p) => ({ ...p, actorUserIdConfirm: e.target.value }))} placeholder="Confirm your SuperAdmin user ID" className="rounded-lg border border-gray-200/80 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-black/20" />
              </div>
              <input type="text" value={securityGate.targetUserIdConfirm} onChange={(e) => setSecurityGate((p) => ({ ...p, targetUserIdConfirm: e.target.value }))} placeholder="Confirm target admin user ID" className="mt-2 w-full rounded-lg border border-gray-200/80 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-black/20" />
              <div className="mt-3 flex items-center gap-2">
                <button onClick={() => void handleReissueTemporaryPassword()} disabled={loading} className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-60">
                  Reissue Temporary Password
                </button>
              </div>
              {tempCredential && (
                <div className="mt-3 rounded-xl border border-amber-200/70 bg-amber-50/70 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-200">One-time temporary credential</p>
                  <p className="mt-1 text-[11px] text-amber-700/90 dark:text-amber-200/90">Share securely and force user to rotate immediately.</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <input readOnly value={showPassword ? tempCredential.temporaryPassword : '••••••••••••••••'} className="rounded-lg border border-amber-200/80 bg-white/90 px-3 py-2 text-xs text-slate-900 dark:border-amber-500/25 dark:bg-slate-900/60 dark:text-slate-100" />
                    <button type="button" onClick={() => setShowPassword((p) => !p)} className="rounded-lg border border-amber-300 bg-white/80 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-white dark:border-amber-500/30 dark:bg-slate-900/60 dark:text-amber-200">
                      {showPassword ? 'Hide' : 'Reveal'}
                    </button>
                    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(tempCredential.temporaryPassword); toast.success('Temporary password copied'); } catch { toast.error('Unable to copy password'); } }} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700">
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Seeded user hard delete */}
          {canWipeUserData && isSeededUser && (
            <div className="rounded-2xl border border-rose-200/80 bg-rose-50/70 px-4 py-4 dark:border-rose-500/30 dark:bg-rose-500/10">
              <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-300">Seeded User Hard Delete</h3>
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-200/80">Use this only for seeded demo accounts.</p>
              <button onClick={handleHardDeleteSeededUser} className={`${actionButtonClass} mt-3 bg-rose-600 text-white hover:bg-rose-700`}>
                <span>🗑️</span> Hard Delete Seeded User
              </button>
            </div>
          )}

          {/* Admin permissions */}
          {canManagePermissions && isAdminTarget && !isDeleted && (
            <div className="rounded-2xl border border-gray-200/80 bg-white px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Permissions</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Grant or revoke admin capabilities.</p>
              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">Granted</h4>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                      {ALL_PERMISSIONS.filter((perm) => currentPerms.has(perm)).length}
                    </span>
                  </div>
                  <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                    {ALL_PERMISSIONS.filter((perm) => currentPerms.has(perm)).map((perm) => (
                      <label key={perm} className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-emerald-200/70 bg-white/75 px-2.5 py-1.5 text-xs dark:border-emerald-500/25 dark:bg-black/20">
                        <span className="truncate text-gray-800 dark:text-gray-100">{perm}</span>
                        <input type="checkbox" checked onChange={() => void handlePermissionToggle(perm)} disabled={loading} className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600" />
                      </label>
                    ))}
                    {ALL_PERMISSIONS.filter((perm) => currentPerms.has(perm)).length === 0 && (
                      <p className="text-xs text-emerald-700/80 dark:text-emerald-200/80">No permissions granted.</p>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-black/20">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Available</h4>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-white/15 dark:text-slate-200">
                      {ALL_PERMISSIONS.filter((perm) => !currentPerms.has(perm)).length}
                    </span>
                  </div>
                  <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                    {ALL_PERMISSIONS.filter((perm) => !currentPerms.has(perm)).map((perm) => (
                      <label key={perm} className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-white/80 px-2.5 py-1.5 text-xs dark:border-white/10 dark:bg-black/25">
                        <span className="truncate text-gray-700 dark:text-gray-200">{perm}</span>
                        <input type="checkbox" checked={false} onChange={() => void handlePermissionToggle(perm)} disabled={loading} className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600" />
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

export default AccountManageModal;
