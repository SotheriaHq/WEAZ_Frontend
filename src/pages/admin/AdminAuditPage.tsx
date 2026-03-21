import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAuditApi } from '@/api/AdminApi';
import type { AdminAuditLog } from '@/types/admin';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { unwrapApiResponse } from '@/types/auth';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';

/* ------------------------------------------------------------------ */
/*  Human-readable helpers                                             */
/* ------------------------------------------------------------------ */

const humanAction = (action: string): string => {
  const map: Record<string, string> = {
    ADMIN_BRAND_VERIFY: 'Brand Verified',
    ADMIN_BRAND_REJECT: 'Brand Rejected',
    ADMIN_BRAND_SUSPEND: 'Brand Suspended',
    ADMIN_BRAND_UNSUSPEND: 'Brand Unsuspended',
    ADMIN_BRAND_STORE_OVERRIDE: 'Store Override Applied',
    ADMIN_USER_SUSPEND: 'User Suspended',
    ADMIN_USER_UNSUSPEND: 'User Unsuspended',
    ADMIN_USER_DEACTIVATE: 'User Deactivated',
    ADMIN_USER_NOTIFY: 'User Notified',
    ADMIN_USER_DATA_WIPE: 'User Data Wiped',
    ADMIN_PRODUCT_MODERATE: 'Product Moderated',
    ADMIN_COLLECTION_MODERATE: 'Content Moderated',
    ADMIN_VERIFICATION_CLAIM: 'Verification Claimed',
    ADMIN_VERIFICATION_NOTE_CREATE: 'Verification Note Added',
    ADMIN_VERIFICATION_NOTE_UPDATE: 'Verification Note Updated',
    ADMIN_VERIFICATION_NOTE_DELETE: 'Verification Note Deleted',
    ADMIN_PAYOUT_PROCESS: 'Payout Processed',
    ADMIN_DISPUTE_RESOLVE: 'Dispute Resolved',
    ADMIN_TAG_BAN: 'Tag Banned',
    ADMIN_TAG_UNBAN: 'Tag Unbanned',
    ADMIN_TAG_ALIAS: 'Tag Aliased',
    ADMIN_FEATURED_ADD: 'Item Featured',
    ADMIN_FEATURED_REMOVE: 'Item Unfeatured',
  };
  if (map[action]) return map[action];
  return action
    .replace(/^ADMIN_/, '')
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
};

const actionBadgeColor = (action: string) => {
  if (action.includes('VERIFY') || action.includes('UNSUSPEND') || action.includes('REPUBLISH'))
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400';
  if (action.includes('SUSPEND') || action.includes('REJECT') || action.includes('DELETE') || action.includes('WIPE'))
    return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400';
  if (action.includes('MODERATE') || action.includes('UNPUBLISH'))
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400';
  if (action.includes('NOTE') || action.includes('CLAIM'))
    return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400';
  return 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300';
};

const targetRoute = (log: AdminAuditLog): string => {
  const t = (log.targetType || '').toLowerCase();
  if (t === 'user') return '/admin/users';
  if (t === 'brand') return '/admin/brands';
  if (t === 'collection') return '/admin/content?tab=designs';
  if (t === 'product') return '/admin/content?tab=products';
  return '/admin/audit';
};

const humanTargetType = (type: string | null): string => {
  if (!type) return '';
  const map: Record<string, string> = {
    User: 'User',
    Brand: 'Brand',
    Collection: 'Design / Collection',
    Product: 'Product',
  };
  return map[type] || type;
};

/** Render state diff as human-readable key-value pairs instead of raw JSON */
const renderState = (state: Record<string, unknown> | null): React.ReactNode => {
  if (!state) return <span className="text-gray-400 dark:text-gray-500 italic">No data</span>;
  const entries = Object.entries(state);
  if (entries.length === 0) return <span className="text-gray-400 dark:text-gray-500 italic">Empty</span>;

  return (
    <div className="space-y-1.5">
      {entries.map(([key, value]) => {
        const label = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/_/g, ' ')
          .replace(/^\w/, (c) => c.toUpperCase())
          .trim();

        let display: React.ReactNode;
        if (value === null || value === undefined) {
          display = <span className="text-gray-400 italic">none</span>;
        } else if (typeof value === 'boolean') {
          display = value ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Yes</span>
          ) : (
            <span className="text-rose-600 dark:text-rose-400 font-semibold">No</span>
          );
        } else if (typeof value === 'object' && Array.isArray(value)) {
          display = (
            <span className="text-gray-700 dark:text-gray-200">
              {value.length === 0 ? 'None' : value.map((v) => {
                if (typeof v === 'object' && v !== null) {
                  const obj = v as Record<string, unknown>;
                  return obj.label || obj.code || obj.name || JSON.stringify(v);
                }
                return String(v);
              }).join(', ')}
            </span>
          );
        } else if (typeof value === 'object') {
          const obj = value as Record<string, unknown>;
          display = (
            <span className="text-gray-700 dark:text-gray-200">
              {obj.label || obj.code || obj.name || obj.message || JSON.stringify(value)}
            </span>
          );
        } else {
          display = <span className="text-gray-700 dark:text-gray-200">{String(value)}</span>;
        }

        return (
          <div key={key} className="flex items-baseline gap-2">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 shrink-0 min-w-[100px]">
              {label}:
            </span>
            <span className="text-[12px] break-words">{display}</span>
          </div>
        );
      })}
    </div>
  );
};

const relativeTime = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const AdminAuditPage: React.FC = () => {
  const navigate = useNavigate();
  const [actionFilter, setActionFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedFilter(actionFilter.trim()), 350);
    return () => window.clearTimeout(handle);
  }, [actionFilter]);

  const fetchPage = useCallback(
    async (cursor?: string, limit?: number) => {
      const params: Record<string, string> = {};
      if (debouncedFilter) params.action = debouncedFilter;
      if (cursor) params.cursor = cursor;
      if (limit) params.limit = String(limit);
      const res = await adminAuditApi.list(params);
      const data = unwrapApiResponse<{ items?: AdminAuditLog[]; nextCursor?: string } | AdminAuditLog[]>(
        res.data as any,
      );
      if (Array.isArray(data)) return { items: data };
      return { items: data.items ?? [], nextCursor: data.nextCursor };
    },
    [debouncedFilter],
  );

  const { items: logs, isLoading: loading, isLoadingMore, hasMore, error, sentinelRef } =
    useInfiniteScroll<AdminAuditLog>(fetchPage, { limit: 30 });

  return (
    <div className="space-y-6">
      <AdminBreadcrumb segments={[{ label: 'Audit Log' }]} />

      {/* Header */}
      <div className="rounded-2xl border border-purple-200/40 bg-gradient-to-br from-white/95 via-[#f8f3ff] to-[#efe6ff] p-5 shadow-md shadow-purple-500/10 dark:border-white/10 dark:from-white/10 dark:via-[#140c1d] dark:to-[#1a1026]">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Immutable record of all admin actions across the platform. Read-only.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search actions... (e.g. verify, suspend, moderate)"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full rounded-xl border border-gray-200/80 bg-white px-4 py-2.5 pl-10 text-sm text-gray-900 outline-none focus:border-purple-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <span className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1.5 text-xs font-semibold text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
            {logs.length} entries
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/50 bg-white/60 dark:border-white/10 dark:bg-white/[0.03] py-16 text-center">
          <p className="text-gray-400 dark:text-gray-500 text-sm">No audit logs found</p>
          {actionFilter && (
            <button
              type="button"
              onClick={() => setActionFilter('')}
              className="mt-2 text-xs text-purple-600 dark:text-fuchsia-400 font-semibold hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const isExpanded = expandedId === log.id;
            const actorLabel = log.actor
              ? `${log.actor.firstName} ${log.actor.lastName}`.trim()
              : log.actorUserId.slice(0, 8) + '...';

            return (
              <div
                key={log.id}
                className={`rounded-xl border transition-all ${
                  isExpanded
                    ? 'border-purple-300/60 dark:border-purple-500/30 shadow-sm'
                    : 'border-gray-200/60 dark:border-white/5 hover:border-gray-300/80 dark:hover:border-white/10'
                } bg-white/80 dark:bg-white/[0.03]`}
              >
                {/* Summary row */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 text-left"
                >
                  {/* Action badge */}
                  <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold ${actionBadgeColor(log.action)}`}>
                    {humanAction(log.action)}
                  </span>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">
                      <span className="font-semibold text-gray-900 dark:text-white">{actorLabel}</span>
                      {log.targetType && (
                        <>
                          {' '}on{' '}
                          <span className="font-medium text-gray-600 dark:text-gray-300">
                            {humanTargetType(log.targetType)}
                          </span>
                        </>
                      )}
                      {log.targetId && (
                        <span className="text-gray-400 dark:text-gray-500 text-[11px] ml-1">
                          ({log.targetId.slice(0, 8)})
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Time + expand indicator */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                      {relativeTime(log.createdAt)}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-white/5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      {/* Previous state */}
                      <div className="rounded-lg bg-gray-50/80 dark:bg-white/[0.03] p-3 border border-gray-100 dark:border-white/5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                          Before
                        </p>
                        {renderState(log.previousState)}
                      </div>

                      {/* New state */}
                      <div className="rounded-lg bg-purple-50/60 dark:bg-purple-500/5 p-3 border border-purple-100/60 dark:border-purple-500/10">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-2">
                          After
                        </p>
                        {renderState(log.newState)}
                      </div>
                    </div>

                    {/* Metadata row */}
                    <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-gray-100/60 dark:border-white/5 text-[11px] text-gray-400 dark:text-gray-500">
                      <span>
                        <span className="font-semibold text-gray-500 dark:text-gray-400">Date:</span>{' '}
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                      {log.ipAddress && (
                        <span>
                          <span className="font-semibold text-gray-500 dark:text-gray-400">IP:</span>{' '}
                          {log.ipAddress}
                        </span>
                      )}
                      {log.targetId && (
                        <button
                          type="button"
                          onClick={() => navigate(targetRoute(log))}
                          className="text-purple-600 dark:text-fuchsia-400 font-semibold hover:underline"
                        >
                          View {humanTargetType(log.targetType)}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {isLoadingMore && (
            <div className="text-center text-gray-500 text-sm py-4">Loading more...</div>
          )}
          {hasMore && <div ref={sentinelRef} />}
          {!hasMore && logs.length > 0 && (
            <div className="text-center text-gray-400 text-xs py-4">End of audit log</div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminAuditPage;
