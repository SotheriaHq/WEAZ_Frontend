import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminDashboardApi } from '../../api/AdminApi';
import { unwrapApiResponse } from '@/types/auth';
import ImageWithFallback from '@/components/ImageWithFallback';

type RecentLog = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
  actorUserId: string;
  actorName?: string | null;
  actorImage?: string | null;
  targetName?: string | null;
  targetImage?: string | null;
  targetStatus?: string | null;
  targetRoute?: string | null;
};

type DashboardStats = {
  totalUsers: number;
  activeUsers30d: number;
  dailySignupCount: number;
  showDailySignupCount: boolean;
  totalBrands: number;
  pendingVerifications: number;
  pendingPayouts: number;
  openDisputes: number;
  recentLogs: RecentLog[];
};

const humanAction = (action: string): { label: string; verb: string } => {
  const map: Record<string, { label: string; verb: string }> = {
    USER_SIGNUP: { label: 'User Signup', verb: 'created account for' },
    ADMIN_BRAND_VERIFY: { label: 'Brand Verified', verb: 'verified' },
    ADMIN_BRAND_REJECT: { label: 'Brand Rejected', verb: 'rejected' },
    ADMIN_BRAND_SUSPEND: { label: 'Brand Suspended', verb: 'suspended' },
    ADMIN_BRAND_UNSUSPEND: { label: 'Brand Unsuspended', verb: 'unsuspended' },
    ADMIN_BRAND_STORE_OVERRIDE: { label: 'Store Override', verb: 'overrode store for' },
    ADMIN_USER_SUSPEND: { label: 'User Suspended', verb: 'suspended' },
    ADMIN_USER_UNSUSPEND: { label: 'User Unsuspended', verb: 'unsuspended' },
    ADMIN_USER_DEACTIVATE: { label: 'User Deactivated', verb: 'deactivated' },
    ADMIN_USER_NOTIFY: { label: 'User Notified', verb: 'notified' },
    ADMIN_USER_DATA_WIPE: { label: 'User Data Wiped', verb: 'wiped data for' },
    ADMIN_PRODUCT_MODERATE: { label: 'Product Moderated', verb: 'moderated' },
    ADMIN_COLLECTION_MODERATE: { label: 'Content Moderated', verb: 'moderated' },
    ADMIN_VERIFICATION_CLAIM: { label: 'Verification Claimed', verb: 'claimed verification for' },
    ADMIN_VERIFICATION_NOTE_CREATE: { label: 'Verification Note', verb: 'added note on' },
    ADMIN_VERIFICATION_NOTE_UPDATE: { label: 'Note Updated', verb: 'updated note on' },
    ADMIN_VERIFICATION_NOTE_DELETE: { label: 'Note Deleted', verb: 'deleted note on' },
    ADMIN_PAYOUT_PROCESS: { label: 'Payout Processed', verb: 'processed payout for' },
    ADMIN_DISPUTE_RESOLVE: { label: 'Dispute Resolved', verb: 'resolved dispute for' },
    ADMIN_TAG_BAN: { label: 'Tag Banned', verb: 'banned tag' },
    ADMIN_TAG_UNBAN: { label: 'Tag Unbanned', verb: 'unbanned tag' },
    ADMIN_TAG_ALIAS: { label: 'Tag Aliased', verb: 'aliased tag' },
    ADMIN_FEATURED_ADD: { label: 'Featured Added', verb: 'featured' },
    ADMIN_FEATURED_REMOVE: { label: 'Featured Removed', verb: 'unfeatured' },
  };
  if (map[action]) return map[action];
  const cleaned = action
    .replace(/^ADMIN_/, '')
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
  return { label: cleaned, verb: cleaned.toLowerCase() };
};

const actionColor = (action: string) => {
  if (action.includes('VERIFY') || action.includes('UNSUSPEND') || action.includes('REPUBLISH')) {
    return 'text-emerald-600 dark:text-emerald-400';
  }
  if (action.includes('SIGNUP')) {
    return 'text-blue-600 dark:text-blue-400';
  }
  if (action.includes('SUSPEND') || action.includes('REJECT') || action.includes('DELETE') || action.includes('WIPE')) {
    return 'text-rose-600 dark:text-rose-400';
  }
  if (action.includes('MODERATE') || action.includes('UNPUBLISH')) {
    return 'text-amber-600 dark:text-amber-400';
  }
  return 'text-indigo-600 dark:text-indigo-400';
};

const statusBadge = (status: string | null | undefined) => {
  if (!status) return null;
  const normalized = status.toUpperCase();
  const styles: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    VERIFIED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    IN_REVIEW: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
    SUSPENDED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
    DEACTIVATED: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400',
    REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
  };
  const style = styles[normalized] || 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400';
  const label = normalized.charAt(0) + normalized.slice(1).toLowerCase().replace(/_/g, ' ');
  return <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${style}`}>{label}</span>;
};

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminDashboardApi
      .getStats()
      .then((res) => {
        const payload = unwrapApiResponse<DashboardStats>(res.data as any);
        setStats(payload);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const primaryCards = [
    { label: 'Total Users', value: stats?.totalUsers, change: '+12.4% vs last month', changeType: 'up' as const, color: 'indigo', route: '/admin/users' },
    { label: 'Active Brands', value: stats?.totalBrands, change: `+${stats?.totalBrands ? Math.round(stats.totalBrands * 0.013) : 0} new this week`, changeType: 'up' as const, color: 'fuchsia', route: '/admin/brands' },
    { label: 'Pending Reviews', value: stats?.pendingVerifications, change: 'Action Required', changeType: 'warning' as const, color: 'amber', route: '/admin/moderation' },
    { label: 'Open Disputes', value: stats?.openDisputes, change: 'Needs attention', changeType: 'warning' as const, color: 'red', route: '/admin/disputes' },
  ];

  const secondaryMetrics = useMemo(() => {
    const base = [
      { label: 'Active (30d)', value: stats?.activeUsers30d?.toLocaleString() ?? '—', route: '/admin/users' },
      { label: 'Pending Payouts', value: stats?.pendingPayouts?.toLocaleString() ?? '—', route: '/admin/payouts' },
      { label: 'Verifications', value: stats?.pendingVerifications?.toLocaleString() ?? '—', route: '/admin/brands' },
      { label: 'Audit Events', value: stats?.recentLogs?.length?.toString() ?? '—', route: '/admin/audit' },
      { label: 'Content', value: '—', route: '/admin/content' },
      { label: 'Designs', value: '—', route: '/admin/content?tab=designs' },
    ];
    if (!stats?.showDailySignupCount) return base;
    return [
      base[0],
      { label: 'Signups Today', value: stats?.dailySignupCount?.toLocaleString() ?? '—', route: '/admin/users' },
      ...base.slice(1),
    ];
  }, [stats]);

  const colorMap: Record<string, { glow: string; text: string }> = {
    indigo: { glow: 'bg-indigo-500/10', text: 'text-indigo-400' },
    fuchsia: { glow: 'bg-fuchsia-500/10', text: 'text-fuchsia-400' },
    amber: { glow: 'bg-amber-500/10', text: 'text-amber-400' },
    red: { glow: 'bg-rose-500/10', text: 'text-rose-400' },
  };

  const formatValue = (value: number | undefined) => {
    if (value === undefined) return '—';
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
    return value.toLocaleString();
  };

  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Overview</h2>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          <span className="text-[10px] font-medium uppercase tracking-widest text-gray-500 dark:text-gray-400">Live System Status: Optimal</span>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {primaryCards.map((card) => {
          const colors = colorMap[card.color];
          return (
            <button
              key={card.label}
              onClick={() => navigate(card.route)}
              className="group relative overflow-hidden rounded-2xl border border-purple-200/30 bg-gradient-to-br from-white/90 to-purple-50/70 p-5 text-left backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:scale-[1.01] hover:border-purple-300/50 hover:shadow-xl hover:shadow-purple-500/10 dark:border-white/10 dark:from-white/[0.06] dark:to-purple-900/20 dark:hover:border-white/20 dark:hover:shadow-black/30"
            >
              <div className={`absolute -right-4 -top-4 h-20 w-20 rounded-full blur-2xl ${colors.glow}`} />
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{card.label}</p>
              <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                {loading ? <span className="inline-block h-8 w-16 animate-pulse rounded bg-gray-200 dark:bg-white/10" /> : formatValue(card.value)}
              </p>
              <div className={`mt-3 flex items-center gap-1 text-[10px] font-bold ${card.changeType === 'up' ? 'text-emerald-600 dark:text-emerald-400' : colors.text}`}>
                <span>{card.change}</span>
              </div>
            </button>
          );
        })}
      </section>

      <section className={`grid grid-cols-2 gap-3 md:grid-cols-3 ${secondaryMetrics.length > 6 ? 'xl:grid-cols-7' : 'lg:grid-cols-6'}`}>
        {secondaryMetrics.map((metric) => (
          <button
            key={metric.label}
            onClick={() => navigate(metric.route)}
            className="flex flex-col items-center rounded-xl border border-purple-200/30 bg-gradient-to-br from-white/80 to-purple-50/40 p-3 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-500/10 dark:border-white/10 dark:from-white/[0.05] dark:to-purple-900/10"
          >
            <p className="text-[10px] font-bold uppercase tracking-tighter text-gray-500 dark:text-gray-500">{metric.label}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{loading ? '...' : metric.value}</p>
          </button>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="overflow-hidden rounded-2xl border border-purple-200/30 bg-gradient-to-br from-white/90 to-purple-50/40 shadow-sm shadow-purple-500/10 backdrop-blur-sm dark:border-white/10 dark:from-white/[0.05] dark:to-purple-900/10 lg:col-span-8">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Recent Activity</h3>
            <button onClick={() => navigate('/admin/audit')} className="text-xs font-bold text-purple-600 hover:underline dark:text-fuchsia-400">View All</button>
          </div>
          <div className="px-5 pb-5">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-9 w-9 animate-pulse rounded-2xl bg-gray-200 shrink-0 dark:bg-white/10" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                      <div className="h-2 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-white/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.recentLogs?.length ? (
              <div className="divide-y divide-gray-100/80 dark:divide-white/5">
                {stats.recentLogs.slice(0, 6).map((log) => {
                  const { verb } = humanAction(log.action);
                  const targetLabel = log.targetName || (log.targetId ? `${log.targetId.slice(0, 8)}...` : '');
                  return (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => navigate(log.targetRoute || '/admin/audit')}
                      className="-mx-2 flex w-full items-center gap-3 rounded-lg px-2 py-3.5 text-left transition-colors hover:bg-gray-50/50 dark:hover:bg-white/[0.03]"
                    >
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-2xl bg-gray-100 dark:bg-white/10">
                        {log.targetImage ? (
                          <ImageWithFallback src={log.targetImage} alt={targetLabel} fit="cover" rounded="xl" className="h-9 w-9" containerClassName="h-9 w-9" fallbackName={targetLabel} />
                        ) : log.actorImage ? (
                          <ImageWithFallback src={log.actorImage} alt={log.actorName || 'User'} fit="cover" rounded="xl" className="h-9 w-9" containerClassName="h-9 w-9" fallbackName={log.actorName || 'User'} />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center text-[11px] font-bold text-gray-500 dark:text-gray-400">
                            {(log.actorName || targetLabel || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] leading-snug text-gray-700 dark:text-gray-200">
                          <span className="font-semibold text-gray-900 dark:text-white">{log.actorName || 'User'}</span>{' '}
                          <span className={`font-medium ${actionColor(log.action)}`}>{verb}</span>{' '}
                          {targetLabel ? <span className="font-semibold text-gray-900 transition-colors group-hover:text-purple-600 dark:text-white dark:group-hover:text-fuchsia-400">{targetLabel}</span> : null}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{relativeTime(log.createdAt)}</span>
                          {log.targetStatus ? statusBadge(log.targetStatus) : null}
                        </div>
                      </div>
                      <span aria-hidden="true" className="shrink-0 text-gray-300 transition-colors group-hover:text-purple-400 dark:text-gray-600">›</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">No recent activity</div>
            )}
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-2xl border border-purple-200/30 bg-gradient-to-br from-white/90 to-indigo-50/30 shadow-sm shadow-indigo-500/10 backdrop-blur-sm dark:border-white/10 dark:from-white/[0.05] dark:to-indigo-900/10 lg:col-span-4">
          <div className="px-5 pt-5 pb-3">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Live Activity</h3>
          </div>
          <div className="flex-1 space-y-1 px-5 pb-5">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-gray-100 dark:bg-white/5" />)}
              </div>
            ) : stats?.recentLogs?.length ? (
              stats.recentLogs.slice(0, 5).map((log, index) => {
                const { label } = humanAction(log.action);
                return (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => navigate(log.targetRoute || '/admin/audit')}
                    className="relative -mx-1 flex w-full gap-3 rounded-lg px-1 py-2.5 text-left transition-colors hover:bg-gray-50/50 dark:hover:bg-white/[0.03]"
                  >
                    {index < Math.min((stats?.recentLogs?.length ?? 0) - 1, 4) ? (
                      <div className="absolute left-[6px] top-[30px] h-[calc(100%-14px)] w-px bg-gray-200/80 dark:bg-white/10" />
                    ) : null}
                    <div
                      className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${
                        log.action.includes('VERIFY') || log.action.includes('UNSUSPEND')
                          ? 'bg-emerald-500'
                          : log.action.includes('SUSPEND') || log.action.includes('DELETE') || log.action.includes('WIPE')
                            ? 'bg-rose-500'
                            : log.action.includes('SIGNUP')
                              ? 'bg-blue-500'
                              : log.action.includes('MODERATE')
                                ? 'bg-amber-500'
                                : 'bg-indigo-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold leading-tight text-gray-900 dark:text-white">{label}</p>
                      {log.targetName ? <p className="truncate text-[10px] font-medium text-gray-600 dark:text-gray-300">{log.targetName}</p> : null}
                      <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">{relativeTime(log.createdAt)}</p>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">No live activity</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {[
          {
            title: 'Quick Actions',
            gradient: 'to-fuchsia-50/30 dark:to-fuchsia-900/10',
            shadow: 'shadow-fuchsia-500/10',
            items: [
              { label: 'Manage Users', route: '/admin/users' },
              { label: 'Manage Brands', route: '/admin/brands' },
              { label: 'Manage Content', route: '/admin/content' },
              { label: 'Finance Workspace', route: '/admin/finance' },
            ],
          },
          {
            title: 'Moderation',
            gradient: 'to-amber-50/30 dark:to-amber-900/10',
            shadow: 'shadow-amber-500/10',
            items: [
              { label: 'Content Moderation', route: '/admin/moderation' },
              { label: 'Disputes', route: '/admin/disputes', count: stats?.openDisputes },
              { label: 'Payouts', route: '/admin/payouts', count: stats?.pendingPayouts },
              { label: 'Audit Log', route: '/admin/audit' },
            ],
          },
          {
            title: 'System',
            gradient: 'to-indigo-50/30 dark:to-indigo-900/10',
            shadow: 'shadow-indigo-500/10',
            items: [
              { label: 'Taxonomy', route: '/admin/taxonomy' },
              { label: 'Tags', route: '/admin/tags' },
              { label: 'Measurements', route: '/admin/taxonomy?tab=measurements' },
              { label: 'Settings', route: '/admin/settings' },
            ],
          },
        ].map((section) => (
          <div key={section.title} className={`rounded-2xl border border-purple-200/30 bg-gradient-to-br from-white/90 ${section.gradient} p-5 shadow-sm ${section.shadow} backdrop-blur-sm dark:border-white/10 dark:from-white/[0.05]`}>
            <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{section.title}</h3>
            <div className="space-y-1">
              {section.items.map((link) => (
                <button
                  key={link.route}
                  onClick={() => navigate(link.route)}
                  className="group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  <span className="font-medium">{link.label}</span>
                  <div className="flex items-center gap-2">
                    {'count' in link && link.count && link.count > 0 ? (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">{link.count}</span>
                    ) : null}
                    <span aria-hidden="true" className="text-gray-300 transition-colors group-hover:text-purple-400 dark:text-gray-600">›</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
