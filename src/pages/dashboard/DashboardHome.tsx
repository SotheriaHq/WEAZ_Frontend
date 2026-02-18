import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { brandApi } from '@/api/BrandApi';
import { getDraftExpiryStats, type DraftExpiryStats } from '@/api/collectionUploads';
import { getStoreStatus } from '@/api/StoreApi';
import MediaRenderer from '@/components/media/MediaRenderer';
import useSignedFileUrl from '@/hooks/useSignedFileUrl';
import { DraftExpiryStats as DraftExpiryStatsComponent } from '@/components/collections/DraftExpiryComponents';
import { 
  TrendingUp, 
  TrendingDown,
  ShoppingCart,
  ShoppingBag, 
  AlertCircle, 
  DollarSign,
  Eye,
  UserPlus,
  Shirt,
  Star,
  Percent,
  Wallet,
  Plus,
  Layers,
  Wand2,
  Ticket,
  ExternalLink,
  AlertTriangle,
  Camera,
  CreditCard,
  Bell,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

/**
 * Dashboard Home (Screen 2.1)
 * Glassmorphism design with metrics grid, quick actions, activity feed
 */
const DashboardHome: React.FC = () => {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.user.profile);
  const [overview, setOverview] = useState<any>(null);
  const [, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'7d' | '30d' | 'ytd'>('30d');
  const [draftStats, setDraftStats] = useState<DraftExpiryStats | null>(null);
  const [storeOpenStatus, setStoreOpenStatus] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (user?.id) {
          const [overviewData, analyticsData, draftStatsData] = await Promise.all([
            brandApi.getDashboardOverview(user.id),
            brandApi.getDashboardAnalytics(user.id, range),
            getDraftExpiryStats().catch(() => null),
          ]);
          const statusData = await getStoreStatus().catch(() => null);
          setOverview(overviewData);
          setAnalytics(analyticsData);
          setDraftStats(draftStatsData);
          setStoreOpenStatus(statusData?.isStoreOpen ?? null);
        } else {
          throw new Error('No user ID');
        }
      } catch (error) {
        console.warn('Failed to fetch dashboard data, using demo data', error);
        // Demo/empty state data
        setOverview({
          kpis: {
            totalRevenue: 0,
            totalOrders: 0,
            conversionRate: 0,
            avgOrderValue: 0,
            storeViews: 0,
            patches: 0,
            activeProducts: 0,
            reviewScore: 0,
            reviewCount: 0,
          },
          currency: 'NGN',
          store: {
            name: user?.brandFullName || 'Store',
            slug: user?.username || 'your-store',
            logoUrl: null,
            isLive: false,
          },
          actionRequired: [],
          recentActivity: [],
          recentOrders: [],
          storeHealth: {
            score: 0,
            responseTime: 0,
            inventory: 0,
            reviews: 0,
          }
        });
        setAnalytics({
          salesChart: []
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id, user?.brandFullName, user?.username, range]);

  const kpis = overview?.kpis || {};
  const store = overview?.store || {};
  const displayStoreName = store.name || user?.brandFullName || 'Store';
  const logoInitial =
    user?.profileImage ?? user?.profileImageFile?.s3Url ?? store.logoUrl ?? null;
  const { url: resolvedLogoUrl } = useSignedFileUrl(user?.profileImageId ?? null, logoInitial);
  const resolvedIsLive =
    storeOpenStatus ??
    (typeof store?.isStoreOpen === 'boolean' ? store.isStoreOpen : null) ??
    (typeof store?.isLive === 'boolean' ? store.isLive : null) ??
    (typeof (user as any)?.isStoreOpen === 'boolean' ? (user as any).isStoreOpen : false);
  const storeHealth = overview?.storeHealth || { score: 0, responseTime: 0, inventory: 0, reviews: 0 };
  const actionRequired = overview?.actionRequired || [];
  const recentActivity = overview?.recentActivity || [];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(val);
  };

  const formatNumber = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toString();
  };

  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Store Header Card */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
        <div className="px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 overflow-hidden rounded-xl border border-gray-200 dark:border-white/10 flex items-center justify-center">
              {resolvedLogoUrl ? (
                <MediaRenderer
                  kind="image"
                  src={resolvedLogoUrl}
                  alt={displayStoreName}
                  className="h-full w-full"
                  mediaClassName="h-full w-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                  {displayStoreName.charAt(0) || 'S'}
                </div>
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                {displayStoreName}
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                  resolvedIsLive 
                    ? 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/20'
                    : 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${resolvedIsLive ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  {resolvedIsLive ? 'LIVE' : 'DRAFT'}
                </span>
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                threadly.com/{store.slug || user?.username || 'your-store'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/studio/store')}
              className="px-4 py-2 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              View Store
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Overview</h2>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as any)}
            className="select-threadly bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-600 dark:text-gray-300 px-3 py-1.5 focus:outline-none focus:border-purple-500"
          >
            <option value="30d">Last 30 Days</option>
            <option value="7d">This Week</option>
            <option value="ytd">Today</option>
          </select>
        </div>

        {/* Metrics Grid - 8 cards in 2 rows */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Revenue"
            value={formatCurrency(kpis.totalRevenue || 0)}
            icon={<DollarSign className="w-4 h-4" />}
            iconBg="bg-green-500/10"
            iconColor="text-green-500"
            trend="+12%"
            trendUp
          />
          <MetricCard
            title="Orders"
            value={(kpis.totalOrders || 0).toString()}
            icon={<ShoppingCart className="w-4 h-4" />}
            iconBg="bg-blue-500/10"
            iconColor="text-blue-500"
            subtitle="Avg. 5.2/day"
          />
          <MetricCard
            title="Conversion Rate"
            value={`${kpis.conversionRate || 0}%`}
            icon={<Percent className="w-4 h-4" />}
            iconBg="bg-purple-500/10"
            iconColor="text-purple-500"
            trend="-0.4%"
            trendUp={false}
          />
          <MetricCard
            title="Avg Order Value"
            value={formatCurrency(kpis.avgOrderValue || 0)}
            icon={<Wallet className="w-4 h-4" />}
            iconBg="bg-orange-500/10"
            iconColor="text-orange-500"
            trend="+5%"
            trendUp
          />
          <MetricCard
            title="Store Views"
            value={formatNumber(kpis.storeViews || 0)}
            icon={<Eye className="w-4 h-4" />}
            iconBg="bg-pink-500/10"
            iconColor="text-pink-500"
            subtitle="Unique visitors"
          />
          <MetricCard
            title="Patches"
            value={formatNumber(kpis.patches || 0)}
            icon={<UserPlus className="w-4 h-4" />}
            iconBg="bg-indigo-500/10"
            iconColor="text-indigo-500"
            trend="+89 this week"
            trendUp
          />
          <MetricCard
            title="Active Products"
            value={(kpis.activeProducts || 0).toString()}
            icon={<Shirt className="w-4 h-4" />}
            iconBg="bg-teal-500/10"
            iconColor="text-teal-500"
            subtitle={kpis.activeProducts > 0 ? "3 low stock" : "Add products"}
          />
          <MetricCard
            title="Reviews"
            value={kpis.reviewScore ? `${kpis.reviewScore} / 5.0` : "0"}
            icon={<Star className="w-4 h-4" />}
            iconBg="bg-yellow-500/10"
            iconColor="text-yellow-500"
            subtitle={kpis.reviewCount ? `Based on ${kpis.reviewCount} reviews` : "No reviews yet"}
          />
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickActionButton
            icon={<Plus className="w-5 h-5" />}
            label="Add Product"
            baseColor="bg-purple-500/20 text-purple-500"
            hoverColor="hover:bg-purple-500/10 hover:border-purple-500/30"
            onClick={() => navigate('/studio/store/products/new')}
          />
          <QuickActionButton
            icon={<Layers className="w-5 h-5" />}
            label="Create Collection"
            baseColor="bg-blue-500/20 text-blue-500"
            hoverColor="hover:bg-blue-500/10 hover:border-blue-500/30"
            onClick={() => navigate('/studio/store/collections/new')}
          />
          <QuickActionButton
            icon={<Wand2 className="w-5 h-5" />}
            label="Style a Look"
            baseColor="bg-pink-500/20 text-pink-500"
            hoverColor="hover:bg-pink-500/10 hover:border-pink-500/30"
            onClick={() => navigate('/profile/collections/create')}
          />
          <QuickActionButton
            icon={<Ticket className="w-5 h-5" />}
            label="Create Promo"
            baseColor="bg-green-500/20 text-green-500"
            hoverColor="hover:bg-green-500/10 hover:border-green-500/30"
          />
        </div>
      </section>

      {/* Split Layout: Activity & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity Feed */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-white/10 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
            <Link to="/studio?tab=orders" className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300">
              View All
            </Link>
          </div>

          {recentActivity.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-gray-900 dark:text-white font-medium mb-1">No activity yet</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Orders, patches, and reviews will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((item: any, idx: number) => (
                <ActivityItem key={idx} {...item} />
              ))}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Action Required */}
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-white/10 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-purple-500" />
              Action Required
            </h2>
            
            {actionRequired.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No pending actions 🎉
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {actionRequired.map((action: any, idx: number) => (
                  <AlertItem key={idx} {...action} />
                ))}
              </div>
            )}
          </div>

          {/* Store Health */}
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Store Health</h2>
              <a href="#" className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300">
                Improve Score
              </a>
            </div>

            <div className="flex items-center gap-6">
              {/* Circular Progress */}
              <div className="relative w-24 h-24 flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="48" cy="48" r="40" stroke="rgba(128,128,128,0.1)" strokeWidth="8" fill="none" />
                  <circle 
                    cx="48" cy="48" r="40" 
                    stroke={storeHealth.score >= 70 ? '#10b981' : storeHealth.score >= 40 ? '#f59e0b' : '#ef4444'} 
                    strokeWidth="8" fill="none"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * (storeHealth.score || 0) / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{storeHealth.score || 0}</span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">
                    {storeHealth.score >= 70 ? 'Good' : storeHealth.score >= 40 ? 'Fair' : 'Low'}
                  </span>
                </div>
              </div>

              {/* Progress Bars */}
              <div className="flex-1 space-y-3">
                <HealthBar label="Response Time" value={storeHealth.responseTime || 0} color="green" />
                <HealthBar label="Inventory" value={storeHealth.inventory || 0} color="yellow" />
                <HealthBar label="Reviews" value={storeHealth.reviews || 0} color="blue" />
              </div>
            </div>
          </div>

          {/* Draft Expiry Stats */}
          {draftStats && draftStats.totalDrafts > 0 && (
            <DraftExpiryStatsComponent
              total={draftStats.totalDrafts}
              expiringSoon={draftStats.expiringIn7Days}
              expiringToday={draftStats.expiringToday}
              onViewAll={() => navigate('/studio/collections?filter=drafts')}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Metric Card Component
const MetricCard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  trend?: string;
  trendUp?: boolean;
  subtitle?: string;
}> = ({ title, value, icon, iconBg, iconColor, trend, trendUp, subtitle }) => (
  <div className="bg-white dark:bg-[#1a1a1a] p-5 rounded-xl border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-all hover:-translate-y-0.5 cursor-pointer shadow-sm">
    <div className="flex justify-between items-start mb-2">
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center ${iconColor}`}>
        {icon}
      </div>
    </div>
    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{value}</h3>
    {trend && (
      <p className={`text-xs flex items-center gap-1 ${trendUp ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
        {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {trend}
        <span className="text-gray-400 dark:text-gray-500 ml-1">vs last month</span>
      </p>
    )}
    {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>}
  </div>
);

// Quick Action Button
const QuickActionButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  baseColor: string;
  hoverColor: string;
  onClick?: () => void;
}> = ({ icon, label, baseColor, hoverColor, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`group bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 p-4 rounded-xl flex flex-col items-center justify-center gap-3 transition-all hover:-translate-y-0.5 ${hoverColor}`}
  >
    <div className={`w-10 h-10 rounded-full ${baseColor} flex items-center justify-center transition-colors group-hover:scale-110`}>
      {icon}
    </div>
    <span className="text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
      {label}
    </span>
  </button>
);

// Activity Item
const ActivityItem: React.FC<{
  type: 'order' | 'patch' | 'stock' | 'review';
  title: string;
  description: string;
  time: string;
  action?: string;
}> = ({ type, title, description, time, action }) => {
  const iconMap = {
    order: { icon: <ShoppingCart className="w-4 h-4" />, bg: 'bg-green-500/20', color: 'text-green-500' },
    patch: { icon: <UserPlus className="w-4 h-4" />, bg: 'bg-indigo-500/20', color: 'text-indigo-500' },
    stock: { icon: <AlertTriangle className="w-4 h-4" />, bg: 'bg-orange-500/20', color: 'text-orange-500' },
    review: { icon: <Star className="w-4 h-4" />, bg: 'bg-yellow-500/20', color: 'text-yellow-500' },
  };

  const { icon, bg, color } = iconMap[type] || iconMap.order;

  return (
    <div className="flex gap-4 items-start p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
      <div className={`w-10 h-10 rounded-full ${bg} ${color} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <p className="text-sm text-gray-900 dark:text-white font-medium">{title}</p>
          <span className="text-xs text-gray-400 dark:text-gray-500">{time}</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        {action && (
          <button className="mt-2 text-xs bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 px-2 py-1 rounded text-gray-700 dark:text-white transition-colors">
            {action}
          </button>
        )}
      </div>
    </div>
  );
};

// Alert Item
const AlertItem: React.FC<{
  type: 'error' | 'warning' | 'info';
  title: string;
  description: string;
}> = ({ type, title, description }) => {
  const styles = {
    error: { bg: 'bg-red-500/10', border: 'border-red-500/20', icon: <AlertCircle className="w-4 h-4" />, color: 'text-red-500' },
    warning: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: <Camera className="w-4 h-4" />, color: 'text-orange-500' },
    info: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: <CreditCard className="w-4 h-4" />, color: 'text-blue-500' },
  };

  const { bg, border, icon, color } = styles[type];

  return (
    <div className={`${bg} border ${border} rounded-lg p-3 flex gap-3 items-start`}>
      <span className={`${color} mt-0.5`}>{icon}</span>
      <div>
        <p className="text-sm text-gray-900 dark:text-white font-medium">{title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
      </div>
    </div>
  );
};

// Health Bar
const HealthBar: React.FC<{ label: string; value: number; color: 'green' | 'yellow' | 'blue' }> = ({ label, value, color }) => {
  const colors = {
    green: 'bg-green-500 text-green-500',
    yellow: 'bg-yellow-500 text-yellow-500',
    blue: 'bg-blue-500 text-blue-500',
  };
  const [bgColor, textColor] = colors[color].split(' ');

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500 dark:text-gray-400">{label}</span>
        <span className={textColor}>{value}%</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-1.5">
        <div className={`${bgColor} h-1.5 rounded-full`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
};

export default DashboardHome;
