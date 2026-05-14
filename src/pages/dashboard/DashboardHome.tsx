import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import type { RootState } from '@/store';
import { brandApi } from '@/api/BrandApi';
import { getDraftExpiryStats, type DraftExpiryStats } from '@/api/collectionUploads';
import { getStoreStatus } from '@/api/StoreApi';
import MediaRenderer from '@/components/media/MediaRenderer';
import { Select } from '@/components/ui/Select';
import { useEmbeddedSurface } from '@/hooks/useEmbeddedSurface';
import useSignedFileUrl from '@/hooks/useSignedFileUrl';
import { getAvatarFallback } from '@/utils/profileImage';
import { DraftExpiryStats as DraftExpiryStatsComponent } from '@/components/collections/DraftExpiryComponents';
import StudioPageSkeleton from '@/components/studio/StudioPageSkeleton';
import { normalizeNotification } from '@/utils/notificationAdapter';
import { determineNotificationRoute } from '@/utils/notificationRouting';

type ActivityTone = 'order' | 'patch' | 'stock' | 'review';

type ActivityItemViewModel = {
  id: string;
  type: ActivityTone;
  category: string;
  title: string;
  description: string;
  time: string;
  action?: string;
  route?: string;
};

const stripHtml = (value?: string | null) =>
  String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeBrandDashboardRoute = (route?: string | null) => {
  if (!route) return undefined;

  if (route.startsWith('/studio/messages')) {
    return route.replace('/studio/messages', '/messages');
  }

  if (route.startsWith('/orders')) {
    const [, search = ''] = route.split('?');
    return `/studio?tab=orders${search ? `&${search}` : ''}`;
  }

  return route;
};

const buildDashboardReturnQuery = () => {
  const params = new URLSearchParams();
  params.set('returnTo', '/studio?tab=dashboard');
  params.set('returnLabel', 'Back to dashboard');
  return params.toString();
};

const deriveActivityTone = (item: any): ActivityTone => {
  const haystack = [
    item?.type,
    item?.title,
    item?.description,
    item?.route,
  ]
    .map((value) => String(value || '').toUpperCase())
    .join(' ');

  if (haystack.includes('REVIEW')) return 'review';
  if (
    haystack.includes('STOCK') ||
    haystack.includes('INVENTORY') ||
    haystack.includes('LOW_STOCK') ||
    haystack.includes('OUT_OF_STOCK')
  ) {
    return 'stock';
  }
  if (
    haystack.includes('MESSAGE') ||
    haystack.includes('PATCH') ||
    haystack.includes('FOLLOW')
  ) {
    return 'patch';
  }
  return 'order';
};

const getActivityCategoryLabel = (tone: ActivityTone) => {
  switch (tone) {
    case 'patch':
      return 'Messages';
    case 'stock':
      return 'Inventory';
    case 'review':
      return 'Reviews';
    default:
      return 'Orders';
  }
};

function getRelativeTime(value?: string | null) {
  if (!value) return 'Just now';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'Just now';

  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

const DashboardHome: React.FC = () => {
  const navigate = useNavigate();
  const isEmbeddedMobile = useEmbeddedSurface() === 'mobile-app';
  const user = useSelector((state: RootState) => state.user.profile);
  const notificationItems = useSelector((state: RootState) => state.notifications.items);
  const [overview, setOverview] = useState<any>(null);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'7d' | '30d' | 'ytd'>('30d');
  const [draftStats, setDraftStats] = useState<DraftExpiryStats | null>(null);
  const [storeOpenStatus, setStoreOpenStatus] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (!user?.id) {
          throw new Error('No user ID');
        }

        const [overviewData, analyticsData, activityFeedData, draftStatsData, statusData] = await Promise.all([
          brandApi.getDashboardOverview(user.id),
          brandApi.getDashboardAnalytics(user.id, range),
          brandApi.getDashboardActivityFeed(user.id, 12),
          getDraftExpiryStats().catch(() => null),
          getStoreStatus().catch(() => null),
        ]);

        setOverview(overviewData);
        setAnalytics(analyticsData);
        setActivityFeed(Array.isArray(activityFeedData?.items) ? activityFeedData.items : []);
        setDraftStats(draftStatsData);
        setStoreOpenStatus(statusData?.isStoreOpen ?? null);
      } catch (error) {
        console.warn('Failed to fetch dashboard data, using demo data', error);
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
          },
        });
        setActivityFeed([]);
        setAnalytics({ salesChart: [] });
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [range, user?.brandFullName, user?.id, user?.username]);

  const kpis = overview?.kpis || {};
  const store = overview?.store || {};
  const displayStoreName = store.name || user?.brandFullName || 'Store';
  const logoInitial =
    user?.profileImage ?? user?.profileImageFile?.s3Url ?? store.logoUrl ?? null;
  const logoFileId = user?.profileImageId ?? user?.profileImageFile?.id ?? null;
  const { url: resolvedLogoUrl } = useSignedFileUrl(logoFileId, logoInitial);
  const resolvedIsLive =
    storeOpenStatus ??
    (typeof store?.isStoreOpen === 'boolean' ? store.isStoreOpen : null) ??
    (typeof store?.isLive === 'boolean' ? store.isLive : null) ??
    (typeof (user as any)?.isStoreOpen === 'boolean' ? (user as any).isStoreOpen : false);
  const storeHealth = overview?.storeHealth || { score: 0, responseTime: 0, inventory: 0, reviews: 0 };
  const actionRequired = overview?.actionRequired || [];

  const normalizedActionRequired = useMemo(() => {
    return actionRequired.map((item: any) => ({
      ...item,
      link: normalizeBrandDashboardRoute(item?.link),
    }));
  }, [actionRequired]);

  const notificationActivity = useMemo(() => {
    return (notificationItems || []).slice(0, 12).map((raw: any) => {
      const normalized = normalizeNotification(raw);
      const route = normalizeBrandDashboardRoute(determineNotificationRoute(normalized));
      const type = String(normalized.type || '').toUpperCase();

      let mappedType: ActivityTone = 'order';
      if (type.includes('MESSAGE') || type.includes('FOLLOW') || type.includes('PATCH')) mappedType = 'patch';
      if (type.includes('REVIEW')) mappedType = 'review';
      if (type.includes('LOW_STOCK') || type.includes('OUT_OF_STOCK')) mappedType = 'stock';

      return {
        id: normalized.id || undefined,
        type: mappedType,
        title: stripHtml(normalized.message || 'Recent update') || 'Recent update',
        description: normalized.actor
          ? `From ${normalized.actor.firstName || normalized.actor.username || 'system'}`
          : 'System update',
        createdAt: normalized.createdAt,
        time: getRelativeTime(normalized.createdAt),
        action: route ? 'Open' : undefined,
        route,
      };
    });
  }, [notificationItems]);

  const recentActivity = useMemo<ActivityItemViewModel[]>(() => {
    const source =
      (activityFeed.length
        ? activityFeed
        : overview?.recentActivity?.length
          ? overview.recentActivity
          : notificationActivity) || [];

    return source.map((item: any, index: number) => {
      const type = deriveActivityTone(item);
      const route = normalizeBrandDashboardRoute(item?.route);

      return {
        id: item?.id || `${type}-${index}`,
        type,
        category: getActivityCategoryLabel(type),
        title: stripHtml(item?.title || 'Recent update') || 'Recent update',
        description: stripHtml(item?.description || 'System update') || 'System update',
        time: item?.time || getRelativeTime(item?.createdAt),
        action: route ? item?.action || 'Open' : undefined,
        route,
      };
    });
  }, [activityFeed, notificationActivity, overview?.recentActivity]);

  const activitySummary = useMemo(() => {
    return recentActivity.reduce(
      (acc, item) => {
        const route = String(item.route || '');
        acc.total += 1;
        if (route.includes('/messages')) acc.messages += 1;
        else if (route.includes('custom-orders')) acc.customOrders += 1;
        else if (route.includes('order')) acc.orders += 1;
        else acc.updates += 1;
        return acc;
      },
      { total: 0, orders: 0, customOrders: 0, messages: 0, updates: 0 },
    );
  }, [recentActivity]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(val);

  const formatNumber = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toString();
  };

  const avatarFallback = getAvatarFallback(
    `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
    user?.username,
  );

  if (loading && !overview) {
    return <StudioPageSkeleton variant="dashboard" />;
  }

  return (
    <div className={`${isEmbeddedMobile ? 'space-y-4' : 'space-y-5 sm:space-y-8'} animate-in fade-in duration-500`}>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#1a1a1a]">
        <div className="flex flex-row items-center justify-between gap-3 px-3 py-3 sm:px-4 md:px-6 md:py-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 dark:border-white/10 sm:h-12 sm:w-12">
              {resolvedLogoUrl ? (
                <MediaRenderer
                  kind="image"
                  src={resolvedLogoUrl}
                  alt={displayStoreName}
                  className="h-full w-full"
                  mediaClassName="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-600 text-lg font-bold text-white">
                  {avatarFallback}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="flex min-w-0 flex-wrap items-center gap-2 text-base font-bold text-gray-900 dark:text-white sm:text-xl">
                <span className="min-w-0 truncate">{displayStoreName}</span>
                <span
                  className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium sm:px-2.5 sm:text-xs ${
                    resolvedIsLive
                      ? 'border-green-500/20 bg-green-500/20 text-green-600 dark:text-green-400'
                      : 'border-yellow-500/20 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      resolvedIsLive ? 'bg-green-500' : 'bg-yellow-500'
                    }`}
                  />
                  {resolvedIsLive ? 'LIVE' : 'DRAFT'}
                </span>
              </h1>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
                threadly.com/{store.slug || user?.username || 'your-store'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/studio/store')}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white/50 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:text-gray-900 dark:border-white/10 dark:bg-white/10 dark:text-gray-300 dark:hover:text-white sm:gap-2 sm:px-4 sm:text-sm"
          >
            <span aria-hidden="true">🏪</span>
            <span className="hidden min-[380px]:inline">View Store</span>
          </button>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Overview</h2>
          <Select
            variant="filter"
            aria-label="Select date range"
            value={range}
            onChange={(event) => setRange(event.target.value as '7d' | '30d' | 'ytd')}
            fullWidth={false}
          >
            <option value="30d">Last 30 Days</option>
            <option value="7d">This Week</option>
            <option value="ytd">Today</option>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
          <MetricCard
            title="Total Revenue"
            value={formatCurrency(kpis.totalRevenue || 0)}
            marker="💰"
            markerClassName="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            trend="+12%"
            trendUp
          />
          <MetricCard
            title="Orders"
            value={(kpis.totalOrders || 0).toString()}
            marker="📦"
            markerClassName="bg-blue-500/15 text-blue-600 dark:text-blue-400"
            subtitle="Avg. 5.2/day"
          />
          <MetricCard
            title="Conversion Rate"
            value={`${kpis.conversionRate || 0}%`}
            marker="📈"
            markerClassName="bg-violet-500/15 text-violet-600 dark:text-violet-400"
            trend="-0.4%"
            trendUp={false}
          />
          <MetricCard
            title="Avg Order Value"
            value={formatCurrency(kpis.avgOrderValue || 0)}
            marker="🧾"
            markerClassName="bg-orange-500/15 text-orange-600 dark:text-orange-400"
            trend="+5%"
            trendUp
          />
          <MetricCard
            title="Store Views"
            value={formatNumber(kpis.storeViews || 0)}
            marker="👀"
            markerClassName="bg-pink-500/15 text-pink-600 dark:text-pink-400"
            subtitle="Unique visitors"
          />
          <MetricCard
            title="Patches"
            value={formatNumber(kpis.patches || 0)}
            marker="🤝"
            markerClassName="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
            trend="+89 this week"
            trendUp
          />
          <MetricCard
            title="Active Products"
            value={(kpis.activeProducts || 0).toString()}
            marker="🪡"
            markerClassName="bg-cyan-500/15 text-cyan-600 dark:text-cyan-400"
            subtitle={kpis.activeProducts > 0 ? '3 low stock' : 'Add products'}
          />
          <MetricCard
            title="Reviews"
            value={kpis.reviewScore ? `${kpis.reviewScore} / 5.0` : '0'}
            marker="⭐"
            markerClassName="bg-amber-500/15 text-amber-600 dark:text-amber-400"
            subtitle={kpis.reviewCount ? `Based on ${kpis.reviewCount} reviews` : 'No reviews yet'}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white sm:mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4 lg:gap-4">
          <QuickActionButton
            marker="➕"
            label="Add Product"
            accentClassName="bg-purple-500/20 text-purple-500"
            hoverClassName="hover:bg-purple-500/10 hover:border-purple-500/30"
            onClick={() => navigate('/studio/store/products/new')}
          />
          <QuickActionButton
            marker="🗂️"
            label="Create Collection"
            accentClassName="bg-blue-500/20 text-blue-500"
            hoverClassName="hover:bg-blue-500/10 hover:border-blue-500/30"
            onClick={() => navigate('/studio/store/collections/new')}
          />
          <QuickActionButton
            marker="🎨"
            label="Style a Look"
            accentClassName="bg-pink-500/20 text-pink-500"
            hoverClassName="hover:bg-pink-500/10 hover:border-pink-500/30"
            onClick={() => navigate('/profile/collections/create')}
          />
          <QuickActionButton
            marker="🎟️"
            label="Create Promo"
            accentClassName="bg-green-500/20 text-green-500"
            hoverClassName="hover:bg-green-500/10 hover:border-green-500/30"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-[#1a1a1a] sm:p-4 lg:col-span-2 lg:min-h-[620px] lg:p-6">
          <div className="mb-3 flex items-center justify-between sm:mb-4 lg:mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
            <Link
              to="/studio?tab=orders"
              className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
            >
              View All
            </Link>
          </div>

          {recentActivity.length > 0 ? (
            <div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:mb-4">
              <ActivitySummaryPill label="All" value={activitySummary.total} />
              <ActivitySummaryPill label="Orders" value={activitySummary.orders + activitySummary.customOrders} />
              <ActivitySummaryPill label="Messages" value={activitySummary.messages} />
              <ActivitySummaryPill label="Updates" value={activitySummary.updates} />
            </div>
          ) : null}

          {recentActivity.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-6 text-center sm:py-8 lg:py-12">
              <div>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-2xl dark:bg-gray-800 sm:h-16 sm:w-16 sm:text-3xl">
                  <span aria-hidden="true">🗂️</span>
                </div>
                <h3 className="mb-1 font-medium text-gray-900 dark:text-white">No activity yet</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Orders, patches, and reviews will appear here
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden lg:max-h-[500px]">
              <div className="h-full overflow-y-auto pr-1 scrollbar-hide">
                <div className="space-y-2 pr-1 sm:space-y-3">
                  {recentActivity.map((item) => (
                    <ActivityItem
                      key={item.id}
                      {...item}
                      onAction={item.route ? () => navigate(item.route!) : undefined}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 lg:space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-[#1a1a1a] sm:p-4 lg:p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white lg:mb-4">
              <span aria-hidden="true">🔔</span>
              Action Required
            </h2>

            {normalizedActionRequired.length === 0 ? (
              <div className="py-3 text-center lg:py-6">
                <p className="text-sm text-gray-500 dark:text-gray-400">No pending actions 🎉</p>
              </div>
            ) : (
              <div className="space-y-3">
                {normalizedActionRequired.map((action: any, index: number) => (
                  <AlertItem key={`${action?.title || action?.message || 'action'}-${index}`} {...action} />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-[#1a1a1a] sm:p-4 lg:p-6">
            <div className="mb-3 flex items-center justify-between lg:mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Store Health</h2>
              <a
                href="#"
                className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
              >
                Improve Score
              </a>
            </div>

            <div className="flex items-center gap-4 lg:gap-6">
              <div className="relative h-20 w-20 flex-shrink-0 lg:h-24 lg:w-24">
                <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90 transform">
                  <circle cx="48" cy="48" r="40" stroke="rgba(128,128,128,0.1)" strokeWidth="8" fill="none" />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke={
                      storeHealth.score >= 70
                        ? '#10b981'
                        : storeHealth.score >= 40
                          ? '#f59e0b'
                          : '#ef4444'
                    }
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * (storeHealth.score || 0) / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-gray-900 dark:text-white lg:text-2xl">{storeHealth.score || 0}</span>
                  <span className="text-[10px] uppercase text-gray-500 dark:text-gray-400">
                    {storeHealth.score >= 70 ? 'Good' : storeHealth.score >= 40 ? 'Fair' : 'Low'}
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-3">
                <HealthBar label="Response Time" value={storeHealth.responseTime || 0} color="green" />
                <HealthBar label="Inventory" value={storeHealth.inventory || 0} color="yellow" />
                <HealthBar label="Reviews" value={storeHealth.reviews || 0} color="blue" />
              </div>
            </div>
          </div>

          {draftStats && draftStats.totalDrafts > 0 ? (
            <DraftExpiryStatsComponent
              total={draftStats.totalDrafts}
              expiringSoon={draftStats.expiringIn7Days}
              expiringToday={draftStats.expiringToday}
              onViewAll={() =>
                navigate(`/studio/store?view=collections&collectionStatus=draft&${buildDashboardReturnQuery()}`)
              }
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  title: string;
  value: string;
  marker: string;
  markerClassName: string;
  trend?: string;
  trendUp?: boolean;
  subtitle?: string;
}> = ({ title, value, marker, markerClassName, trend, trendUp, subtitle }) => (
  <div className="cursor-pointer rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 dark:border-white/10 dark:bg-[#1a1a1a] dark:hover:border-white/20 sm:p-4 lg:p-5">
    <div className="mb-1.5 flex items-start justify-between gap-2 lg:mb-2">
      <p className="min-w-0 text-xs font-medium leading-4 text-gray-500 dark:text-gray-400 sm:text-sm">{title}</p>
      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-sm sm:h-8 sm:w-8 sm:text-base ${markerClassName}`}>
        <span aria-hidden="true">{marker}</span>
      </div>
    </div>
    <h3 className="mb-1 truncate text-lg font-bold leading-6 text-gray-900 dark:text-white sm:text-xl lg:text-2xl">{value}</h3>
    {trend ? (
      <p
        className={`flex flex-wrap items-center gap-x-1 text-[11px] leading-4 sm:text-xs ${
          trendUp ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
        }`}
      >
        <span aria-hidden="true">{trendUp ? '↗' : '↘'}</span>
        {trend}
        <span className="text-gray-400 dark:text-gray-500 sm:ml-1">vs last month</span>
      </p>
    ) : null}
    {subtitle ? <p className="truncate text-[11px] leading-4 text-gray-400 dark:text-gray-500 sm:text-xs">{subtitle}</p> : null}
  </div>
);

const QuickActionButton: React.FC<{
  marker: string;
  label: string;
  accentClassName: string;
  hoverClassName: string;
  onClick?: () => void;
}> = ({ marker, label, accentClassName, hoverClassName, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`group flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white p-3 transition-all hover:-translate-y-0.5 dark:border-white/10 dark:bg-[#1a1a1a] sm:min-h-[92px] sm:gap-3 sm:p-4 ${hoverClassName}`}
  >
    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-base transition-colors group-hover:scale-110 sm:h-10 sm:w-10 sm:text-lg ${accentClassName}`}>
      <span aria-hidden="true">{marker}</span>
    </div>
    <span className="text-center text-xs font-medium leading-4 text-gray-600 group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-white sm:text-sm">
      {label}
    </span>
  </button>
);

const ActivitySummaryPill: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-2 py-1.5 text-center dark:border-white/10 dark:bg-white/[0.03] sm:px-3 sm:py-2">
    <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500 sm:tracking-[0.16em]">{label}</p>
    <p className="mt-0.5 text-base font-bold leading-5 text-gray-900 dark:text-white sm:mt-1 sm:text-lg">{value}</p>
  </div>
);

const ActivityItem: React.FC<ActivityItemViewModel & { onAction?: () => void }> = ({
  type,
  category,
  title,
  description,
  time,
  action,
  onAction,
}) => {
  const iconMap: Record<ActivityTone, { marker: string; bg: string; color: string }> = {
    order: { marker: '📦', bg: 'bg-green-500/20', color: 'text-green-500' },
    patch: { marker: '💬', bg: 'bg-indigo-500/20', color: 'text-indigo-500' },
    stock: { marker: '🪡', bg: 'bg-orange-500/20', color: 'text-orange-500' },
    review: { marker: '⭐', bg: 'bg-yellow-500/20', color: 'text-yellow-500' },
  };

  const { marker, bg, color } = iconMap[type] || iconMap.order;

  return (
    <div className="rounded-xl border border-gray-200/80 bg-gray-50/70 p-3 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.025] dark:hover:bg-white/[0.05] sm:rounded-2xl sm:p-4">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-base sm:h-11 sm:w-11 sm:rounded-2xl sm:text-lg ${bg} ${color}`}>
          <span aria-hidden="true">{marker}</span>
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400 sm:px-2.5 sm:py-1 sm:tracking-[0.16em]">
                  {category}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{time}</span>
              </div>
              <p className="mt-1.5 line-clamp-1 text-sm font-semibold text-gray-900 dark:text-white sm:mt-2">{title}</p>
            </div>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500 dark:text-gray-400 sm:mt-1.5">{description}</p>
          {action ? (
            <button
              type="button"
              onClick={onAction}
              className="mt-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 sm:mt-3"
            >
              {action}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const AlertItem: React.FC<{
  type?: string;
  title?: string;
  description?: string;
  message?: string;
  count?: number;
  link?: string;
  actionLabel?: string;
}> = ({ type, title, description, message, count, link, actionLabel }) => {
  const styles = {
    error: { bg: 'bg-red-500/10', border: 'border-red-500/20', icon: '⚠️', color: 'text-red-500' },
    warning: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: '📸', color: 'text-orange-500' },
    info: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: '💳', color: 'text-blue-500' },
  };

  const normalizedType = (() => {
    const rawType = (type ?? '').toUpperCase();
    if (rawType.includes('ERROR') || rawType.includes('FAILED')) return 'error';
    if (rawType.includes('INFO') || rawType.includes('PAYMENT')) return 'info';
    return 'warning';
  })() as keyof typeof styles;

  const { bg, border, icon, color } = styles[normalizedType];
  const derivedTitle = title?.trim() || message?.trim() || 'Action required';
  const derivedDescription = description?.trim() || (
    count
      ? `${count} ${count === 1 ? 'item needs' : 'items need'} attention.`
      : 'Review this item from your studio dashboard.'
  );

  const content = (
    <div className={`${bg} ${border} flex items-start gap-3 rounded-lg border p-3 transition-colors ${link ? 'hover:border-purple-300/40' : ''}`}>
      <span className={`${color} mt-0.5`} aria-hidden="true">{icon}</span>
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{derivedTitle}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{derivedDescription}</p>
        {link ? (
          <span className="mt-2 inline-flex text-xs font-medium text-purple-600 dark:text-purple-400">
            {actionLabel || 'Open'}
          </span>
        ) : null}
      </div>
    </div>
  );

  if (!link) {
    return content;
  }

  return (
    <Link to={link} className="block">
      {content}
    </Link>
  );
};

const HealthBar: React.FC<{
  label: string;
  value: number;
  color: 'green' | 'yellow' | 'blue';
}> = ({ label, value, color }) => {
  const colors = {
    green: 'bg-green-500 text-green-500',
    yellow: 'bg-yellow-500 text-yellow-500',
    blue: 'bg-blue-500 text-blue-500',
  };
  const [bgColor, textColor] = colors[color].split(' ');

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-gray-500 dark:text-gray-400">{label}</span>
        <span className={textColor}>{value}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-white/10">
        <div className={`${bgColor} h-1.5 rounded-full`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
};

export default DashboardHome;
