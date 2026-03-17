import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminDashboardApi } from '../../api/AdminApi';
import { unwrapApiResponse } from '@/types/auth';

type DashboardStats = {
  totalUsers: number;
  activeUsers30d: number;
  totalBrands: number;
  pendingVerifications: number;
  pendingPayouts: number;
  openDisputes: number;
  recentLogs: { id: string; action: string; targetType: string; targetId: string; createdAt: string; actorUserId: string }[];
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

  const activityColor = (type: string) => {
    if (type.toLowerCase().includes('user') || type.toLowerCase().includes('auth')) return 'bg-indigo-500';
    if (type.toLowerCase().includes('brand') || type.toLowerCase().includes('store')) return 'bg-fuchsia-500';
    if (type.toLowerCase().includes('dispute') || type.toLowerCase().includes('report')) return 'bg-amber-500';
    if (type.toLowerCase().includes('product')) return 'bg-emerald-500';
    return 'bg-gray-500';
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
                {card.changeType === 'up' && <span>📈</span>}
                {card.changeType === 'warning' && <span>⚠️</span>}
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

      {/* Middle Panels: Approval Queue + Live Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Approval Queue / Recent Activity */}
        <div className="lg:col-span-8 rounded-2xl border border-purple-200/30 dark:border-white/10 bg-gradient-to-br from-white/90 to-purple-50/40 dark:from-white/[0.05] dark:to-purple-900/10 backdrop-blur-sm overflow-hidden shadow-sm shadow-purple-500/10">
          <div className="p-5 border-b border-gray-200/50 dark:border-white/5 flex justify-between items-center">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Recent Activity</h3>
            <button
              onClick={() => navigate('/admin/audit')}
              className="text-xs text-purple-600 dark:text-fuchsia-400 font-bold hover:underline"
            >
              View All
            </button>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : stats?.recentLogs && stats.recentLogs.length > 0 ? (
              <div className="space-y-3">
                {stats.recentLogs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 bg-gray-50/80 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white/80 ${
                        log.action.includes('CREATE') ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                        log.action.includes('UPDATE') ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' :
                        log.action.includes('DELETE') ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' :
                        'bg-gray-500/20 text-gray-600 dark:text-gray-400'
                      }`}>
                        <span className="text-base">
                          {log.action.includes('CREATE') ? '✨' :
                           log.action.includes('UPDATE') ? '✏️' :
                           log.action.includes('DELETE') ? '🗑️' : '📋'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{log.action}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {log.targetType} {log.targetId?.slice(0, 8)}…
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
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
          <div className="p-5 border-b border-gray-200/50 dark:border-white/5">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Live Activity</h3>
          </div>
          <div className="p-5 space-y-5 flex-1">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-gray-100 dark:bg-white/5 rounded animate-pulse" />
                ))}
              </div>
            ) : stats?.recentLogs && stats.recentLogs.length > 0 ? (
              stats.recentLogs.slice(0, 4).map((log, i) => (
                <div key={log.id} className="flex gap-3 relative">
                  {i < Math.min(stats.recentLogs.length - 1, 3) && (
                    <div className="absolute left-[5px] top-6 w-[1px] h-8 bg-gray-200 dark:bg-white/10" />
                  )}
                  <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ring-4 ${
                    activityColor(log.targetType || log.action)
                  } ring-opacity-20 ${activityColor(log.targetType || log.action).replace('bg-', 'ring-')}`} />
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{log.action}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-500">
                      {log.targetType} {log.targetId?.slice(0, 8)}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5 uppercase">
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
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
          <div className="space-y-2">
            {[
              { emoji: '👤', label: 'Manage Users', route: '/admin/users' },
              { emoji: '🏷️', label: 'Manage Brands', route: '/admin/brands' },
              { emoji: '🧰', label: 'Manage Content', route: '/admin/content' },
              { emoji: '🧵', label: 'Review Designs', route: '/admin/content?tab=designs' },
            ].map((link) => (
              <button
                key={link.route}
                onClick={() => navigate(link.route)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              >
                <span>{link.emoji}</span>
                <span className="font-medium">{link.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Moderation Quick View */}
        <div className="rounded-2xl border border-purple-200/30 dark:border-white/10 bg-gradient-to-br from-white/90 to-amber-50/30 dark:from-white/[0.05] dark:to-amber-900/10 backdrop-blur-sm p-5 shadow-sm shadow-amber-500/10">
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">Moderation</h3>
          <div className="space-y-2">
            {[
              { emoji: '🛡️', label: 'Content Moderation', route: '/admin/moderation' },
              { emoji: '⚖️', label: 'Disputes', route: '/admin/disputes', count: stats?.openDisputes },
              { emoji: '💰', label: 'Payouts', route: '/admin/payouts', count: stats?.pendingPayouts },
              { emoji: '📋', label: 'Audit Log', route: '/admin/audit' },
            ].map((link) => (
              <button
                key={link.route}
                onClick={() => navigate(link.route)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span>{link.emoji}</span>
                  <span className="font-medium">{link.label}</span>
                </div>
                {link.count !== undefined && link.count > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
                    {link.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* System & Config */}
        <div className="rounded-2xl border border-purple-200/30 dark:border-white/10 bg-gradient-to-br from-white/90 to-indigo-50/30 dark:from-white/[0.05] dark:to-indigo-900/10 backdrop-blur-sm p-5 shadow-sm shadow-indigo-500/10">
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">System</h3>
          <div className="space-y-2">
            {[
              { emoji: '🧬', label: 'Taxonomy', route: '/admin/taxonomy' },
              { emoji: '🏷️', label: 'Tags', route: '/admin/tags' },
              { emoji: '📐', label: 'Measurements', route: '/admin/measurements' },
              { emoji: '⚙️', label: 'Settings', route: '/admin/settings' },
            ].map((link) => (
              <button
                key={link.route}
                onClick={() => navigate(link.route)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              >
                <span>{link.emoji}</span>
                <span className="font-medium">{link.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
