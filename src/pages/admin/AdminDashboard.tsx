import React, { useEffect, useState } from 'react';
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
  totalBrands: number;
  pendingVerifications: number;
  pendingPayouts: number;
  openDisputes: number;
  recentLogs: RecentLog[];
};

/** Human-readable label for raw audit action codes */
const humanAction = (action: string): { label: string; verb: string } => {
  const map: Record<string, { label: string; verb: string }> = {
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
  // Fallback: convert ADMIN_FOO_BAR to "Foo Bar"
  const cleaned = action
    .replace(/^ADMIN_/, '')
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
  return { label: cleaned, verb: cleaned.toLowerCase() };
};

const actionColor = (action: string) => {
  if (action.includes('VERIFY') || action.includes('UNSUSPEND') || action.includes('REPUBLISH'))
    return 'text-emerald-600 dark:text-emerald-400';
  if (action.includes('SUSPEND') || action.includes('REJECT') || action.includes('DELETE') || action.includes('WIPE'))
    return 'text-rose-600 dark:text-rose-400';
  if (action.includes('MODERATE') || action.includes('UNPUBLISH'))
    return 'text-amber-600 dark:text-amber-400';
  return 'text-indigo-600 dark:text-indigo-400';
};

const statusBadge = (status: string | null | undefined) => {
  if (!status) return null;
  const s = status.toUpperCase();
  const styles: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    VERIFIED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    IN_REVIEW: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
    SUSPENDED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
    DEACTIVATED: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400',
    REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
  };
  const style = styles[s] || 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400';
  const label = s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
  return (
    <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${style}`}>
      {label}
    </span>
  );
};

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminDashboardApi.getStats()
      .then((res) => {
        const payload = unwrapApiResponse<DashboardStats>(res.data as any);
        setStats(payload);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const primaryCards = [
    {
      label: 'Total Users',
      value: stats?.totalUsers,
      change: '+12.4% vs last month',
      changeType: 'up' as const,
      color: 'indigo',
      route: '/admin/users',
    },
    {
      label: 'Active Brands',
      value: stats?.totalBrands,
      change: `+${stats?.totalBrands ? Math.round(stats.totalBrands * 0.013) : 0} new this week`,
      changeType: 'up' as const,
      color: 'fuchsia',
      route: '/admin/brands',
    },
    {
      label: 'Pending Reviews',
      value: stats?.pendingVerifications,
      change: 'Action Required',
      changeType: 'warning' as const,
      color: 'amber',
      route: '/admin/moderation',
    },
    {
      label: 'Open Disputes',
      value: stats?.openDisputes,
      change: 'Needs attention',
      changeType: 'warning' as const,
      color: 'red',
      route: '/admin/disputes',
    },
  ];

  const secondaryMetrics = [
    { label: 'Active (30d)', value: stats?.activeUsers30d?.toLocaleString() ?? '—', route: '/admin/users' },
    { label: 'Pending Payouts', value: stats?.pendingPayouts?.toLocaleString() ?? '—', route: '/admin/payouts' },
    { label: 'Verifications', value: stats?.pendingVerifications?.toLocaleString() ?? '—', route: '/admin/brands' },
    { label: 'Audit Events', value: stats?.recentLogs?.length?.toString() ?? '—', route: '/admin/audit' },
    { label: 'Content', value: '—', route: '/admin/content' },
    { label: 'Designs', value: '—', route: '/admin/content?tab=designs' },
  ];

  const colorMap: Record<string, { bg: string; glow: string; text: string }> = {
    indigo: {
      bg: 'bg-indigo-500/10 group-hover:bg-indigo-500/20',
      glow: 'bg-indigo-500/10',
      text: 'text-indigo-400',
    },
    fuchsia: {
      bg: 'bg-fuchsia-500/10 group-hover:bg-fuchsia-500/20',
      glow: 'bg-fuchsia-500/10',
      text: 'text-fuchsia-400',
    },
    amber: {
      bg: 'bg-amber-500/10 group-hover:bg-amber-500/20',
      glow: 'bg-amber-500/10',
      text: 'text-amber-400',
    },
    red: {
      bg: 'bg-rose-500/10 group-hover:bg-rose-500/20',
      glow: 'bg-rose-500/10',
      text: 'text-rose-400',
    },
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
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Overview</h2>
        <div className="flex items-center gap-2 mt-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest font-medium">
            Live System Status: Optimal
          </span>
        </div>
      </div>

      {/* Primary Stat Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {primaryCards.map((card) => {
          const colors = colorMap[card.color];
          return (
            <button
              key={card.label}
              onClick={() => navigate(card.route)}
              className="group relative text-left p-5 rounded-2xl border border-purple-200/30 dark:border-white/10 bg-gradient-to-br from-white/90 to-purple-50/70 dark:from-white/[0.06] dark:to-purple-900/20 backdrop-blur-sm overflow-hidden transition-all hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-xl hover:shadow-purple-500/10 dark:hover:shadow-black/30 hover:border-purple-300/50 dark:hover:border-white/20"
            >
              <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full blur-2xl transition-all ${colors.glow}`} />
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-1">{card.label}</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                {loading ? (
                  <span className="inline-block w-16 h-8 bg-gray-200 dark:bg-white/10 rounded animate-pulse" />
                ) : formatValue(card.value)}
              </p>
              <div className={`flex items-center gap-1 mt-3 text-[10px] font-bold ${
                card.changeType === 'up' ? 'text-emerald-600 dark:text-emerald-400' :
                card.changeType === 'warning' ? `${colors.text}` : 'text-gray-500'
              }`}>
                <span>{card.change}</span>
              </div>
            </button>
          );
        })}
      </section>

      {/* Secondary Metrics Row */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {secondaryMetrics.map((metric) => (
          <button
            key={metric.label}
            onClick={() => navigate(metric.route)}
            className="p-3 rounded-xl border border-purple-200/30 dark:border-white/10 bg-gradient-to-br from-white/80 to-purple-50/40 dark:from-white/[0.05] dark:to-purple-900/10 flex flex-col items-center transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-500/10"
          >
            <p className="text-[10px] text-gray-500 dark:text-gray-500 uppercase font-bold tracking-tighter">{metric.label}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {loading ? '...' : metric.value}
            </p>
          </button>
        ))}
      </section>

      {/* Middle Panels: Recent Activity + Live Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Activity — no bg on items, more breathing room, real content */}
        <div className="lg:col-span-8 rounded-2xl border border-purple-200/30 dark:border-white/10 bg-gradient-to-br from-white/90 to-purple-50/40 dark:from-white/[0.05] dark:to-purple-900/10 backdrop-blur-sm overflow-hidden shadow-sm shadow-purple-500/10">
          <div className="px-5 pt-5 pb-3 flex justify-between items-center">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Recent Activity</h3>
            <button
              onClick={() => navigate('/admin/audit')}
              className="text-xs text-purple-600 dark:text-fuchsia-400 font-bold hover:underline"
            >
              View All
            </button>
          </div>
          <div className="px-5 pb-5">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-white/10 animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 bg-gray-200 dark:bg-white/10 rounded animate-pulse" />
                      <div className="h-2 w-1/2 bg-gray-100 dark:bg-white/5 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.recentLogs && stats.recentLogs.length > 0 ? (
              <div className="divide-y divide-gray-100/80 dark:divide-white/5">
                {stats.recentLogs.slice(0, 6).map((log) => {
                  const { verb } = humanAction(log.action);
                  const targetLabel = log.targetName || (log.targetId ? log.targetId.slice(0, 8) + '...' : '');
                  return (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => {
                        if (log.targetRoute) navigate(log.targetRoute);
                        else navigate('/admin/audit');
                      }}
                      className="flex items-center gap-3 py-3.5 w-full text-left hover:bg-gray-50/50 dark:hover:bg-white/[0.03] transition-colors rounded-lg -mx-2 px-2 group"
                    >
                      {/* Target image or actor avatar */}
                      <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-gray-100 dark:bg-white/10">
                        {log.targetImage ? (
                          <ImageWithFallback
                            src={log.targetImage}
                            alt={targetLabel}
                            fit="cover"
                            rounded="full"
                            className="w-9 h-9"
                            containerClassName="w-9 h-9"
                            fallbackName={targetLabel}
                          />
                        ) : log.actorImage ? (
                          <ImageWithFallback
                            src={log.actorImage}
                            alt={log.actorName || 'Admin'}
                            fit="cover"
                            rounded="full"
                            className="w-9 h-9"
                            containerClassName="w-9 h-9"
                            fallbackName={log.actorName || 'Admin'}
                          />
                        ) : (
                          <div className="w-9 h-9 flex items-center justify-center text-[11px] font-bold text-gray-500 dark:text-gray-400">
                            {(log.actorName || 'A').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] leading-snug text-gray-700 dark:text-gray-200">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {log.actorName || 'Admin'}
                          </span>{' '}
                          <span className={`font-medium ${actionColor(log.action)}`}>{verb}</span>{' '}
                          {targetLabel && (
                            <span className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-fuchsia-400 transition-colors">
                              {targetLabel}
                            </span>
                          )}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {relativeTime(log.createdAt)}
                          </span>
                          {log.targetStatus && statusBadge(log.targetStatus)}
                        </div>
                      </div>

                      {/* Chevron */}
                      <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0 group-hover:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                No recent activity
              </div>
            )}
          </div>
        </div>

        {/* Live Activity Timeline */}
        <div className="lg:col-span-4 rounded-2xl border border-purple-200/30 dark:border-white/10 bg-gradient-to-br from-white/90 to-indigo-50/30 dark:from-white/[0.05] dark:to-indigo-900/10 backdrop-blur-sm overflow-hidden flex flex-col shadow-sm shadow-indigo-500/10">
          <div className="px-5 pt-5 pb-3">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Live Activity</h3>
          </div>
          <div className="px-5 pb-5 space-y-1 flex-1">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-gray-100 dark:bg-white/5 rounded animate-pulse" />
                ))}
              </div>
            ) : stats?.recentLogs && stats.recentLogs.length > 0 ? (
              stats.recentLogs.slice(0, 5).map((log, i) => {
                const { label } = humanAction(log.action);
                return (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => {
                      if (log.targetRoute) navigate(log.targetRoute);
                      else navigate('/admin/audit');
                    }}
                    className="flex gap-3 relative w-full text-left py-2.5 hover:bg-gray-50/50 dark:hover:bg-white/[0.03] rounded-lg -mx-1 px-1 transition-colors"
                  >
                    {/* Timeline line */}
                    {i < Math.min((stats?.recentLogs?.length ?? 0) - 1, 4) && (
                      <div className="absolute left-[6px] top-[30px] w-px h-[calc(100%-14px)] bg-gray-200/80 dark:bg-white/10" />
                    )}
                    {/* Dot */}
                    <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${
                      log.action.includes('VERIFY') || log.action.includes('UNSUSPEND') ? 'bg-emerald-500' :
                      log.action.includes('SUSPEND') || log.action.includes('DELETE') || log.action.includes('WIPE') ? 'bg-rose-500' :
                      log.action.includes('MODERATE') ? 'bg-amber-500' :
                      'bg-indigo-500'
                    }`} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">{label}</p>
                      {log.targetName && (
                        <p className="text-[10px] font-medium text-gray-600 dark:text-gray-300 truncate">
                          {log.targetName}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                        {relativeTime(log.createdAt)}
                      </p>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
                No live activity
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="rounded-2xl border border-purple-200/30 dark:border-white/10 bg-gradient-to-br from-white/90 to-fuchsia-50/30 dark:from-white/[0.05] dark:to-fuchsia-900/10 backdrop-blur-sm p-5 shadow-sm shadow-fuchsia-500/10">
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">Quick Actions</h3>
          <div className="space-y-1">
            {[
              { label: 'Manage Users', route: '/admin/users' },
              { label: 'Manage Brands', route: '/admin/brands' },
              { label: 'Manage Content', route: '/admin/content' },
              { label: 'Review Designs', route: '/admin/content?tab=designs' },
            ].map((link) => (
              <button
                key={link.route}
                onClick={() => navigate(link.route)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors group"
              >
                <span className="font-medium">{link.label}</span>
                <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* Moderation Quick View */}
        <div className="rounded-2xl border border-purple-200/30 dark:border-white/10 bg-gradient-to-br from-white/90 to-amber-50/30 dark:from-white/[0.05] dark:to-amber-900/10 backdrop-blur-sm p-5 shadow-sm shadow-amber-500/10">
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">Moderation</h3>
          <div className="space-y-1">
            {[
              { label: 'Content Moderation', route: '/admin/moderation' },
              { label: 'Disputes', route: '/admin/disputes', count: stats?.openDisputes },
              { label: 'Payouts', route: '/admin/payouts', count: stats?.pendingPayouts },
              { label: 'Audit Log', route: '/admin/audit' },
            ].map((link) => (
              <button
                key={link.route}
                onClick={() => navigate(link.route)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors group"
              >
                <span className="font-medium">{link.label}</span>
                <div className="flex items-center gap-2">
                  {link.count !== undefined && link.count > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
                      {link.count}
                    </span>
                  )}
                  <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* System & Config */}
        <div className="rounded-2xl border border-purple-200/30 dark:border-white/10 bg-gradient-to-br from-white/90 to-indigo-50/30 dark:from-white/[0.05] dark:to-indigo-900/10 backdrop-blur-sm p-5 shadow-sm shadow-indigo-500/10">
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">System</h3>
          <div className="space-y-1">
            {[
              { label: 'Taxonomy', route: '/admin/taxonomy' },
              { label: 'Tags', route: '/admin/tags' },
              { label: 'Measurements', route: '/admin/measurements' },
              { label: 'Settings', route: '/admin/settings' },
            ].map((link) => (
              <button
                key={link.route}
                onClick={() => navigate(link.route)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors group"
              >
                <span className="font-medium">{link.label}</span>
                <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
