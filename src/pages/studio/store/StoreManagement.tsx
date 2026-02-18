import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import type { RootState } from '@/store';
import { getStoreStatus, type StoreStatusResponse } from '@/api/StoreApi';
import StoreProductsPanel from '@/components/studio/store/StoreProductsPanel';
import { brandApi } from '@/api/BrandApi';
import MediaRenderer from '@/components/media/MediaRenderer';
import useSignedFileUrl from '@/hooks/useSignedFileUrl';
import { clearStoreOpenPending, isStoreOpenPending, resolveStoreSetupDestination, sleep } from '@/utils/storeSetup';
import {
  Eye,
} from 'lucide-react';

export default function StoreManagement() {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.user.profile);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StoreStatusResponse | null>(null);
  const [overview, setOverview] = useState<any>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsOpen] = useState(true);
  const [analyticsCollapsed, setAnalyticsCollapsed] = useState(true);
  const [layoutMode, setLayoutMode] = useState(false);
  const [draftCollections, setDraftCollections] = useState<any[]>([]);
  const [draftCollectionsLoading, setDraftCollectionsLoading] = useState(false);

  const avatarInitial = user?.profileImage ?? user?.profileImageFile?.s3Url ?? null;
  const { url: avatarUrl } = useSignedFileUrl(user?.profileImageId, avatarInitial);

  const brandName = useMemo(() => {
    if (status?.profile?.name) return status.profile.name;
    if (user?.brandFullName) return user.brandFullName;
    const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
    return fullName || user?.username || 'Your Store';
  }, [status?.profile?.name, user?.brandFullName, user?.firstName, user?.lastName, user?.username]);

  const brandDescription = useMemo(() => {
    return (
      status?.profile?.description ||
      status?.profile?.tagline ||
      user?.brandDescription ||
      'Showcase your collection, manage products, and track performance.'
    );
  }, [status?.profile?.description, status?.profile?.tagline, user?.brandDescription]);

  const brandLocation = useMemo(() => {
    if (user?.companyLocation) return user.companyLocation;
    const bits = [user?.brandCity, user?.brandState, user?.brandCountry].filter(Boolean);
    return bits.length ? bits.join(', ') : null;
  }, [user?.companyLocation, user?.brandCity, user?.brandState, user?.brandCountry]);

  const kpis = overview?.kpis || {};
  const recentOrders = overview?.recentOrders || [];

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(val || 0);
  const formatNumber = (val: number) => {
    if (!val) return '0';
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return String(val);
  };

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setLoading(true);
        let s = await getStoreStatus();

        if (!s?.isStoreOpen && isStoreOpenPending()) {
          for (let attempt = 0; attempt < 5; attempt += 1) {
            await sleep(500);
            try {
              const retryStatus = await getStoreStatus();
              s = retryStatus;
              if (retryStatus?.isStoreOpen) {
                break;
              }
            } catch {
              // Keep trying while in pending-open grace period.
            }
          }
        }

        if (!mounted) return;
        setStatus(s);

        if (s?.isStoreOpen) {
          clearStoreOpenPending();
        }

        if (s?.profile == null) {
          if (isStoreOpenPending()) {
            return;
          }
          navigate('/studio/store/setup', { replace: true });
          return;
        }

        if (!s?.isStoreOpen) {
          if (isStoreOpenPending()) {
            return;
          }

          navigate(resolveStoreSetupDestination(), { replace: true });
        }
      } catch (e) {
        const code = (e as any)?.response?.status;
        if (code === 404) {
          if (isStoreOpenPending()) {
            return;
          }
          navigate('/studio/store/setup', { replace: true });
          return;
        }
        toast.error('Failed to load store status');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!user?.id) return;
      setOverviewLoading(true);
      try {
        const [overviewData, analyticsData] = await Promise.all([
          brandApi.getDashboardOverview(user.id),
          brandApi.getDashboardAnalytics(user.id, '7d'),
        ]);
        if (!mounted) return;
        setOverview(overviewData);
        setAnalytics(analyticsData);
      } catch (error) {
        if (!mounted) return;
        setOverview({
          kpis: {
            totalRevenue: 0,
            totalOrders: 0,
            conversionRate: 0,
            storeViews: 0,
            reviewScore: 0,
            reviewCount: 0,
          },
          recentOrders: [],
          store: {
            name: brandName,
            slug: user?.username || 'your-store',
            isLive: status?.isStoreOpen ?? false,
          },
        });
        setAnalytics({ salesChart: [] });
      } finally {
        if (mounted) setOverviewLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [brandName, status?.isStoreOpen, user?.id, user?.username]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!user?.id) return;
      setDraftCollectionsLoading(true);
      try {
        const drafts = await brandApi.getMyDraftCollections();
        if (!mounted) return;
        setDraftCollections(drafts || []);
      } catch (error) {
        if (!mounted) return;
        setDraftCollections([]);
      } finally {
        if (mounted) setDraftCollectionsLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  if (loading) {
    return (
      <div className="animate-in fade-in duration-300">
        <div className="h-8 w-48 bg-gray-200/80 dark:bg-white/10 rounded mb-3 animate-pulse" />
        <div className="h-4 w-96 bg-gray-200/80 dark:bg-white/10 rounded animate-pulse" />
        <div className="mt-6 h-72 rounded-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 animate-pulse" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="rounded-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-6">
        <div className="text-gray-900 dark:text-white font-semibold">Store</div>
        <div className="text-gray-600 dark:text-gray-400 text-sm mt-1">Unable to load store status.</div>
      </div>
    );
  }

  // If store isn't open, we already redirected to the setup flow.
  if (!status.isStoreOpen) {
    if (isStoreOpenPending()) {
      return (
        <div className="rounded-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-6">
          <div className="text-gray-900 dark:text-white font-semibold">Finalizing Store</div>
          <div className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            Your store is being activated. This usually takes a few seconds.
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* ═══ Compact Brand Bar ═══ */}
      <div className="sticky top-0 z-30">
        <div className="backdrop-blur-xl bg-white/90 dark:bg-[#111118]/90 border border-gray-200/60 dark:border-white/10 rounded-2xl px-4 py-3 shadow-lg">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl border-2 border-white dark:border-white/10 shadow-md">
              {avatarUrl ? (
                <MediaRenderer
                  kind="image"
                  src={avatarUrl}
                  alt={brandName}
                  fit="cover"
                  className="h-full w-full"
                  mediaClassName="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-600 text-sm font-bold text-white">
                  {brandName.charAt(0) || 'S'}
                </div>
              )}
            </div>

            {/* Brand name + tagline */}
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold text-gray-900 dark:text-white truncate leading-tight">{brandName}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate leading-tight mt-0.5">{brandDescription}</p>
            </div>

            {/* Emoji feature badges with hover tooltips */}
            <div className="hidden sm:flex items-center gap-1">
              {/* Reviews */}
              <div className="relative group">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-default text-sm">
                  {kpis.reviewScore ? '⭐' : '☆'}
                </span>
                <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] font-medium px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg">
                  {kpis.reviewScore
                    ? `${kpis.reviewScore.toFixed(1)} (${kpis.reviewCount || 0} reviews)`
                    : 'No reviews yet'}
                </span>
              </div>

              {/* Location */}
              {brandLocation && (
                <div className="relative group">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-default text-sm">📍</span>
                  <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] font-medium px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg">
                    {brandLocation}
                  </span>
                </div>
              )}

              {/* Shipping */}
              <div className="relative group">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-default text-sm">🚚</span>
                <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] font-medium px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg">
                  Ships Nationwide
                </span>
              </div>

              {/* Verification */}
              <div className="relative group">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-default text-sm">
                  {user?.isEmailVerified ? '✅' : '⏳'}
                </span>
                <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] font-medium px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg">
                  {user?.isEmailVerified ? 'Verified Seller' : 'Verification Pending'}
                </span>
              </div>

              {/* Buyer Protection */}
              <div className="relative group">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-default text-sm">🛡️</span>
                <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] font-medium px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg">
                  Buyer Protection
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-gray-200 dark:bg-white/10 hidden sm:block" />

            {/* Live badge */}
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              status?.isStoreOpen
                ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-500/30'
                : 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-500/30'
            }`}>
              <span className="text-xs">{status?.isStoreOpen ? '🟢' : '🟡'}</span>
              {status?.isStoreOpen ? 'Live' : 'Draft'}
            </div>

            {/* Preview as visitor */}
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="relative group flex-shrink-0 h-9 w-9 rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-white/10 hover:text-purple-600 dark:hover:text-purple-400 hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-sm"
              aria-label="Preview as visitor"
            >
              <Eye className="w-4 h-4" />
              <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] font-medium px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg">
                Preview as visitor
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {[
          {
            label: 'Orders',
            value: formatNumber(kpis.totalOrders),
            meta: 'Last 30 days',
          },
          {
            label: 'Revenue',
            value: formatCurrency(kpis.totalRevenue),
            meta: 'Last 30 days',
          },
          {
            label: 'Page Views',
            value: formatNumber(kpis.storeViews),
            meta: 'Last 30 days',
          },
          {
            label: 'Conversion',
            value: `${kpis.conversionRate || 0}%`,
            meta: 'Shop conversion',
          },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-white/5 p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {card.label}
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{card.value}</div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{card.meta}</div>
          </div>
        ))}
      </div>

      <StoreProductsPanel
        layoutMode={layoutMode}
        onToggleLayoutMode={() => setLayoutMode((prev) => !prev)}
        draftCollections={draftCollections}
        draftCollectionsLoading={draftCollectionsLoading}
      />

      {analyticsOpen && analyticsCollapsed && (
        <button
          type="button"
          onClick={() => setAnalyticsCollapsed(false)}
          className="fixed right-6 bottom-20 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-2xl"
          aria-label="Open analytics panel"
        >
          📊 Analytics
          <span className="text-xs font-semibold text-green-200">● Live</span>
        </button>
      )}

      {analyticsOpen && !analyticsCollapsed && (
        <aside className="fixed right-6 top-24 bottom-6 z-40 w-[320px] max-w-[90vw] rounded-2xl border border-gray-200 dark:border-white/10 bg-white/95 dark:bg-white/5 shadow-2xl overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Analytics</h3>
              <p className="text-xs text-gray-500">Live store performance</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-green-600">● Live</span>
              <button
                type="button"
                onClick={() => setAnalyticsCollapsed(true)}
                className="text-sm text-gray-500 hover:text-gray-800"
              >
                ▾
              </button>
            </div>
          </div>

          <div className="px-5 pb-5 space-y-6">
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
              <div className="text-xs font-semibold text-gray-500">Store Views (7d)</div>
              <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {formatNumber(kpis.storeViews)}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Top Performing</h4>
              {Array.isArray(overview?.topProducts) && overview.topProducts.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {overview.topProducts.slice(0, 3).map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-lg border border-gray-200">
                        {item.thumbnail ? (
                          <MediaRenderer kind="image" src={item.thumbnail} alt={item.name} className="h-full w-full" mediaClassName="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs text-gray-500">No Image</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">{formatNumber(item.views || 0)} views</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-500">No top products yet.</p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Orders</h4>
              {recentOrders.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {recentOrders.slice(0, 3).map((order: any) => (
                    <div key={order.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-gray-900 dark:text-white">#{order.id}</p>
                        <p className="text-xs text-gray-500">{order.items?.length || 0} items</p>
                      </div>
                      <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-600">{order.status || 'Paid'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-500">No recent orders yet.</p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Revenue (7 days)</h4>
              <div className="mt-3 space-y-2">
                {(analytics?.salesChart || []).slice(-7).map((entry: any) => (
                  <div key={entry.date} className="flex items-center justify-between text-xs text-gray-500">
                    <span>{entry.date}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(entry.amount || 0)}
                    </span>
                  </div>
                ))}
                {(!analytics?.salesChart || analytics.salesChart.length === 0) && (
                  <p className="text-xs text-gray-500">No revenue data yet.</p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAnalyticsCollapsed(true)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Close Analytics
            </button>
          </div>
        </aside>
      )}

      {overviewLoading && (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 text-sm text-gray-500">
          Loading store stats…
        </div>
      )}
    </div>
  );
}
