import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import type { RootState } from '@/store';
import { getStoreStatus, type StoreStatusResponse } from '@/api/StoreApi';
import StoreProductsPanel from '@/components/studio/store/StoreProductsPanel';
import { brandApi } from '@/api/BrandApi';
import MediaRenderer from '@/components/media/MediaRenderer';
import useSignedFileUrl from '@/hooks/useSignedFileUrl';
import {
  clearStoreOpenPending,
  isStoreOpenPending,
  resolveStoreSetupDestination,
  sleep,
} from '@/utils/storeSetup';
import {
  getAvatarFallback,
  resolveProfileImageSource,
} from '@/utils/profileImage';
import LazyEntityQrModal from '@/components/qr/LazyEntityQrModal';
import { buildStorefrontUrl } from '@/utils/publicLinks';
import type { VerificationStatusResponse } from '@/types/verification';
import StudioPageSkeleton from '@/components/studio/StudioPageSkeleton';

export default function StoreManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((state: RootState) => state.user.profile);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StoreStatusResponse | null>(null);
  const [verification, setVerification] = useState<VerificationStatusResponse | null>(null);
  const [overview, setOverview] = useState<any>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsOpen] = useState(true);
  const [analyticsCollapsed, setAnalyticsCollapsed] = useState(true);
  const [layoutMode, setLayoutMode] = useState(false);
  const [draftCollections, setDraftCollections] = useState<any[]>([]);
  const [draftCollectionsLoading, setDraftCollectionsLoading] = useState(false);
  const [showStoreQr, setShowStoreQr] = useState(false);

  const resolvedAvatar = useMemo(
    () =>
      resolveProfileImageSource({
        profileImage: user?.profileImage,
        profileImageId: user?.profileImageId,
        profileImageFile: user?.profileImageFile,
      }),
    [user?.profileImage, user?.profileImageFile, user?.profileImageId],
  );
  const { url: avatarUrl } = useSignedFileUrl(
    resolvedAvatar.fileId,
    resolvedAvatar.src,
  );
  const avatarFallback = useMemo(
    () =>
      getAvatarFallback(
        `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
        user?.username,
      ),
    [user?.firstName, user?.lastName, user?.username],
  );

  const brandName = useMemo(() => {
    if (status?.profile?.name) return status.profile.name;
    if (user?.brandFullName) return user.brandFullName;
    const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
    return fullName || user?.username || 'Your Store';
  }, [
    status?.profile?.name,
    user?.brandFullName,
    user?.firstName,
    user?.lastName,
    user?.username,
  ]);

  const brandDescription = useMemo(() => {
    return (
      status?.profile?.description ||
      status?.profile?.tagline ||
      user?.brandDescription ||
      'Showcase your collection, manage products, and track performance.'
    );
  }, [
    status?.profile?.description,
    status?.profile?.tagline,
    user?.brandDescription,
  ]);

  const brandLocation = useMemo(() => {
    if (user?.companyLocation) return user.companyLocation;
    const bits = [user?.brandCity, user?.brandState, user?.brandCountry].filter(
      Boolean,
    );
    return bits.length ? bits.join(', ') : null;
  }, [
    user?.companyLocation,
    user?.brandCity,
    user?.brandState,
    user?.brandCountry,
  ]);

  const kpis = overview?.kpis || {};
  const recentOrders = overview?.recentOrders || [];
  const routeSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const returnTo = routeSearchParams.get('returnTo');
  const returnLabel = routeSearchParams.get('returnLabel') || 'Back';
  const verificationStatus = verification?.verificationStatus ?? user?.verificationStatus ?? 'NOT_SUBMITTED';
  const verificationBadgeVisible = verification?.badgeState.verificationBadgeVisible ?? user?.verificationBadgeVisible ?? false;
  const verificationInProgress =
    verificationStatus === 'PENDING' ||
    verificationStatus === 'IN_REVIEW' ||
    verificationStatus === 'ADDITIONAL_INFO_REQUESTED';
  const verificationMarker = verificationBadgeVisible
    ? '✅'
    : verificationInProgress
      ? '⏳'
      : verificationStatus === 'REJECTED'
        ? '⚠️'
        : verificationStatus === 'CANCELLED'
          ? '🛑'
          : '🪪';
  const verificationLabel = verificationBadgeVisible
    ? 'Seller verified'
    : verificationInProgress
      ? 'Verification in progress'
      : verificationStatus === 'REJECTED'
        ? 'Verification needs attention'
        : verificationStatus === 'CANCELLED'
          ? 'Verification cancelled'
          : 'Open verification workspace';
  const showVerificationPrompt =
    verificationStatus === 'NOT_SUBMITTED' ||
    verificationStatus === 'REJECTED' ||
    verificationStatus === 'CANCELLED';
  const verificationPrompt = useMemo(() => {
    if (verificationStatus === 'REJECTED') {
      return {
        eyebrow: 'Verification review',
        title: 'Your previous verification attempt needs changes.',
        description:
          'Open the verification workspace to review the feedback and submit a corrected attempt.',
        primaryLabel: 'Review feedback',
      };
    }

    if (verificationStatus === 'CANCELLED') {
      return {
        eyebrow: 'Verification paused',
        title: 'Your verification request was cancelled.',
        description:
          'You can start a fresh attempt from the verification workspace whenever you are ready.',
        primaryLabel: 'Restart verification',
      };
    }

    return {
      eyebrow: 'Verify your brand',
      title: 'Your store is ready. Finish brand verification to start making sales.',
      description:
        'Complete verification to strengthen trust, unlock a better buyer experience, and make your store feel fully open for business.',
      primaryLabel: 'Open verification',
    };
  }, [verificationStatus]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(val || 0);
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
        const verificationRequest = user?.id
          ? brandApi.getVerificationStatus(user.id, { force: true }).catch(() => null)
          : Promise.resolve<VerificationStatusResponse | null>(null);
        let s = await getStoreStatus();

        if (!s?.isStoreOpen && isStoreOpenPending(user?.id)) {
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
          clearStoreOpenPending(user?.id);
        }

        if (s?.profile == null) {
          if (isStoreOpenPending(user?.id)) {
            return;
          }
          navigate('/studio/store/setup', { replace: true });
          return;
        }

        if (!s?.isStoreOpen) {
          if (isStoreOpenPending(user?.id)) {
            return;
          }

          navigate(resolveStoreSetupDestination(user?.id), { replace: true });
        }

        const verificationData = await verificationRequest;
        if (!mounted) return;

        setVerification(verificationData);
      } catch (e) {
        const code = (e as any)?.response?.status;
        if (code === 404) {
          if (isStoreOpenPending(user?.id)) {
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
  }, [navigate, user?.id]);

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
      } catch {
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
        const collections = await brandApi.getCollections(user.id, {
          visibility: 'all',
          scope: 'store',
        });
        const drafts = (collections || []).filter((collection: any) => {
          const status = String(collection?.status || '').toUpperCase();
          return status === 'DRAFT' && collection?.isSystemGenerated !== true;
        });
        if (!mounted) return;
        setDraftCollections(drafts || []);
      } catch {
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
    return <StudioPageSkeleton variant="dashboard" />;
  }

  if (!status) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white/70 p-6 dark:border-white/10 dark:bg-white/5">
        <div className="font-semibold text-gray-900 dark:text-white">Store</div>
        <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Unable to load store status.
        </div>
      </div>
    );
  }

  if (!status.isStoreOpen) {
    if (isStoreOpenPending(user?.id)) {
      return (
        <div className="rounded-2xl border border-gray-200 bg-white/70 p-6 dark:border-white/10 dark:bg-white/5">
          <div className="font-semibold text-gray-900 dark:text-white">
            Finalizing Store
          </div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Your store is being activated. This usually takes a few seconds.
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="animate-in fade-in space-y-8 duration-500">
      {returnTo ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(returnTo)}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-purple-300 hover:text-purple-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:border-purple-500/30 dark:hover:text-white"
          >
            <span aria-hidden="true">←</span>
            {returnLabel}
          </button>
        </div>
      ) : null}

      <div className="sticky top-0 z-30">
        <div className="rounded-2xl border border-gray-200/60 bg-white/90 px-4 py-3 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-[#111118]/90">
          <div className="flex items-center gap-4">
            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl border-2 border-white shadow-md dark:border-white/10">
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
                  {avatarFallback}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold leading-tight text-gray-900 dark:text-white">
                {brandName}
              </h1>
              <p className="mt-0.5 truncate text-xs leading-tight text-gray-500 dark:text-gray-400">
                {brandDescription}
              </p>
            </div>

            <div className="hidden items-center gap-1 sm:flex">
              <div className="group relative">
                <span className="inline-flex h-8 w-8 cursor-default items-center justify-center rounded-lg text-sm transition-colors hover:bg-gray-100 dark:hover:bg-white/10">
                  {kpis.reviewScore ? '⭐' : '☆'}
                </span>
                <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-100 dark:text-gray-900">
                  {kpis.reviewScore
                    ? `${kpis.reviewScore.toFixed(1)} (${kpis.reviewCount || 0} reviews)`
                    : 'No reviews yet'}
                </span>
              </div>

              {brandLocation ? (
                <div className="inline-flex max-w-[220px] items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                  <span aria-hidden="true">📍</span>
                  <span className="truncate" title={brandLocation}>
                    {brandLocation}
                  </span>
                </div>
              ) : null}

              <div className="group relative">
                <span className="inline-flex h-8 w-8 cursor-default items-center justify-center rounded-lg text-sm transition-colors hover:bg-gray-100 dark:hover:bg-white/10">
                  🚚
                </span>
                <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-100 dark:text-gray-900">
                  Ships Nationwide
                </span>
              </div>

              <button
                type="button"
                onClick={() => navigate('/studio/verification')}
                className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300"
                aria-label="Open verification workspace"
                title={verificationLabel}
              >
                <span>{verificationMarker}</span>
                <span className="max-w-[140px] truncate">{verificationLabel}</span>
              </button>

              <div className="group relative">
                <span className="inline-flex h-8 w-8 cursor-default items-center justify-center rounded-lg text-sm transition-colors hover:bg-gray-100 dark:hover:bg-white/10">
                  🛡️
                </span>
                <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-100 dark:text-gray-900">
                  Buyer Protection
                </span>
              </div>
            </div>

            <div className="hidden h-6 w-px bg-gray-200 dark:bg-white/10 sm:block" />

            <div
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                status.isStoreOpen
                  ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300'
                  : 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-300'
              }`}
            >
              <span className="text-xs">{status.isStoreOpen ? '🟢' : '🟡'}</span>
              {status.isStoreOpen ? 'Live' : 'Draft'}
            </div>

            <button
              type="button"
              onClick={() => setShowStoreQr(true)}
              className="group relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white/80 text-gray-600 shadow-sm transition-all hover:scale-105 hover:bg-emerald-50 hover:text-emerald-700 active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-emerald-300"
              aria-label="Open storefront QR code"
            >
              <span className="text-sm">🪪</span>
              <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-100 dark:text-gray-900">
                Storefront QR code
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="group relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white/80 text-gray-600 shadow-sm transition-all hover:scale-105 hover:bg-purple-50 hover:text-purple-600 active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-purple-400"
              aria-label="Preview as visitor"
            >
              <span className="text-sm">👁️</span>
              <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-100 dark:text-gray-900">
                Preview as visitor
              </span>
            </button>
          </div>
        </div>
      </div>

      {showVerificationPrompt ? (
        <section className="rounded-3xl border border-sky-200/80 bg-gradient-to-r from-sky-50 via-white to-indigo-50 p-5 shadow-sm dark:border-sky-500/20 dark:from-sky-500/10 dark:via-white/5 dark:to-indigo-500/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700 dark:text-sky-200">
                {verificationPrompt.eyebrow}
              </div>
              <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
                {verificationPrompt.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {verificationPrompt.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/studio/verification')}
                className="inline-flex items-center rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
              >
                {verificationPrompt.primaryLabel}
              </button>
              {verificationStatus === 'NOT_SUBMITTED' ? (
                <button
                  type="button"
                  onClick={() => navigate('/settings?tab=notifications')}
                  className="inline-flex items-center rounded-full border border-sky-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-white dark:border-sky-500/20 dark:bg-white/5 dark:text-sky-200"
                >
                  Manage reminders
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <StoreProductsPanel
        layoutMode={layoutMode}
        onToggleLayoutMode={() => setLayoutMode((prev) => !prev)}
        draftCollections={draftCollections}
        draftCollectionsLoading={draftCollectionsLoading}
      />

      <LazyEntityQrModal
        open={showStoreQr}
        onClose={() => setShowStoreQr(false)}
        title="Storefront QR Code"
        subtitle="Scan to open this storefront."
        url={buildStorefrontUrl({
          ownerId: user?.id,
          slug: overview?.store?.slug || user?.username,
          username: user?.username,
        })}
        downloadFileName="storefront-qr.png"
        logoUrl={avatarUrl || resolvedAvatar.src}
        logoFileId={resolvedAvatar.fileId}
      />

      {analyticsOpen && analyticsCollapsed ? (
        <button
          type="button"
          onClick={() => setAnalyticsCollapsed(false)}
          className="fixed bottom-24 right-3 z-40 flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-2xl sm:right-6 lg:bottom-20"
          aria-label="Open analytics panel"
        >
          📊 Analytics
          <span className="text-xs font-semibold text-green-200">● Live</span>
        </button>
      ) : null}

      {analyticsOpen && !analyticsCollapsed ? (
        <aside className="fixed inset-x-3 bottom-24 top-[88px] z-40 w-auto max-w-[94vw] overflow-y-auto rounded-2xl border border-gray-200 bg-white/95 shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-24 sm:w-[320px] sm:max-w-[90vw] dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Analytics
              </h3>
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

          <div className="space-y-6 px-5 pb-5">
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
              <div className="text-xs font-semibold text-gray-500">
                Store Views (7d)
              </div>
              <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {formatNumber(kpis.storeViews)}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Top Performing
              </h4>
              {Array.isArray(overview?.topProducts) &&
              overview.topProducts.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {overview.topProducts.slice(0, 3).map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-lg border border-gray-200">
                        {item.thumbnail ? (
                          <MediaRenderer
                            kind="image"
                            src={item.thumbnail}
                            alt={item.name}
                            className="h-full w-full"
                            mediaClassName="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs text-gray-500">
                            No Image
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatNumber(item.views || 0)} views
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-500">No top products yet.</p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Recent Orders
              </h4>
              {recentOrders.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {recentOrders.slice(0, 3).map((order: any) => (
                    <div key={order.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-gray-900 dark:text-white">
                          #{order.id}
                        </p>
                        <p className="text-xs text-gray-500">
                          {order.items?.length || 0} items
                        </p>
                      </div>
                      <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-600">
                        {order.status || 'Paid'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-500">No recent orders yet.</p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Revenue (7 days)
              </h4>
              <div className="mt-3 space-y-2">
                {(analytics?.salesChart || []).slice(-7).map((entry: any) => (
                  <div
                    key={entry.date}
                    className="flex items-center justify-between text-xs text-gray-500"
                  >
                    <span>{entry.date}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(entry.amount || 0)}
                    </span>
                  </div>
                ))}
                {!analytics?.salesChart || analytics.salesChart.length === 0 ? (
                  <p className="text-xs text-gray-500">No revenue data yet.</p>
                ) : null}
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
      ) : null}

      {overviewLoading ? (
        <div className="rounded-2xl border border-gray-200 bg-white/70 p-4 text-sm text-gray-500 dark:border-white/10 dark:bg-white/5">
          Loading store stats...
        </div>
      ) : null}
    </div>
  );
}
