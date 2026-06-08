
import React, { Suspense, useEffect, lazy, useRef, useState } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, Navigate, useParams, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import SettingsHome from './pages/settings/SettingsHome';
import CollectionsSettings from './pages/settings/CollectionsSettings';
import SignupPage from './pages/SignUp';
import Success from './pages/Success';
import LoginPage from './pages/Login';
import AccountReactivationRequestPage from './pages/AccountReactivationRequestPage';
// Removed separate BrandPublic visitor page; unified profile view handles both owner & visitor modes
import ProtectedRoute, { RequireAuthenticated } from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';
import { AuthProvider } from './context/AuthContext';
import { DropdownManagerProvider } from './context/DropdownManagerContext';
import { BrandPatchProvider } from './context/BrandPatchContext';
import { ProfileLayout } from './components/catalog/ProfileLayout';
import RequireBrand from './components/RequireBrand';
import { Toaster } from 'sonner';
import ErrorPage from './pages/ErrorPage';
import LegacyStoreRedirect from './pages/store/LegacyStoreRedirect';
import OrderConfirmation from './pages/checkout/OrderConfirmation';
import PaymentReturnPage from './pages/checkout/PaymentReturnPage';
// Placeholder pages for features under development
import {
  NotFound,
  SubscriptionsPlaceholder,
  HistoryPlaceholder,
  WatchLaterPlaceholder,
  TrendingPlaceholder,
} from './pages/placeholders';
import ShopSetupWizardPage from './pages/studio/shop/ShopSetupWizardPage';
import ShopSetupEssentialsPage from './pages/studio/shop/ShopSetupEssentialsPage';
import StudioScaffold from './components/studio/StudioScaffold';
import StudioHandoffGate from './components/studio/StudioHandoffGate';
import RequireStoreSetup from './components/store/RequireStoreSetup';
import { BagFlowProvider } from './features/bagging/BagFlowProvider';
import {
  ProductAliasRedirect,
  ProfileAliasRedirect,
  StorefrontAliasRedirect,
} from './pages/redirects/PublicAliasRedirects';
import VerifiedBadgeMeaningPage from './pages/ui/VerifiedBadgeMeaningPage';
import { useDispatch } from 'react-redux';
import { useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store';
import { setViewportWidth } from '@/features/uiSlice';
import RequireAdmin from './components/admin/RequireAdmin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useEmbeddedSurface } from '@/hooks/useEmbeddedSurface';
import { ThemeBackendSync } from '@/components/theme/ThemeBackendSync';

const Market = lazy(() => import('./pages/Market'));
const CartDrawer = lazy(() => import('./components/designs/CartDrawer'));
const WishlistDrawer = lazy(() => import('./components/designs/WishlistDrawer'));
const GlobalModalRouter = lazy(() =>
  import('./components/modals/GlobalModalRouter').then((module) => ({
    default: module.GlobalModalRouter,
  })),
);
const MarketPlace = lazy(() => import('./pages/MarketPlace'));
const MarketSectionPage = lazy(() => import('./pages/MarketSectionPage'));
const SearchResultsPage = lazy(() => import('./pages/SearchResultsPage'));
const Profile = lazy(() => import('./pages/catalog/Catalog'));
const CreateDesignPage = lazy(() => import('./pages/catalog/CreateDesign'));
const DesignDetailsPage = lazy(() => import('./pages/catalog/DesignDetailsPage'));
const CollectionRouter = lazy(() => import('./pages/catalog/CollectionRouter'));
const ProductDetailsPage = lazy(() => import('./pages/catalog/ProductDetailsPage'));
const SizeChartsPage = lazy(() => import('./pages/size-charts/SizeChartsPage'));
const StudioHome = lazy(() => import('./pages/studio/StudioHome'));
const EditProduct = lazy(() => import('./pages/studio/products/EditProduct'));
const StoreManagement = lazy(() => import('./pages/studio/store/StoreManagement'));
const StoreVerificationPage = lazy(() => import('./pages/studio/store/StoreVerificationPage'));
const VerificationWizardPage = lazy(() => import('./pages/studio/store/VerificationWizardPage'));
const VerificationSubmittedPage = lazy(() => import('./pages/studio/store/VerificationSubmittedPage'));
const StoreCollectionCreate = lazy(() => import('./pages/studio/store/StoreCollectionCreate'));
const StudioCustomOrdersPage = lazy(() => import('./pages/studio/CustomOrdersPage'));
const StudioCustomOrderDetailPage = lazy(() => import('./pages/studio/StudioCustomOrderDetailPage'));
const BrandPayoutsPage = lazy(() => import('./pages/store/BrandPayoutsPage'));
const BrandStaffPage = lazy(() => import('./pages/studio/BrandStaffPage'));
const BrandStaffInvitePage = lazy(() => import('./pages/studio/BrandStaffInvitePage'));
const MyOrders = lazy(() => import('./pages/orders/MyOrders'));
const MyReviewsPage = lazy(() => import('./pages/account/MyReviewsPage'));
const OrderDetail = lazy(() => import('./pages/orders/OrderDetail'));
const CheckoutPage = lazy(() => import('./pages/checkout/CheckoutPage'));
const CustomOrderComposerPage = lazy(() => import('./pages/custom-orders/CustomOrderComposerPage'));
const CustomOrderCheckoutResumePage = lazy(() => import('./pages/custom-orders/CustomOrderCheckoutResumePage'));
const MessagingManagementPage = lazy(() => import('./pages/messages/MessagingManagementPage'));

// Admin pages — lazy loaded for code splitting
const AdminScaffold = lazy(() => import('./components/admin/AdminScaffold'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminBrandsPage = lazy(() => import('./pages/admin/AdminBrandsPage'));
const AdminVerificationQueuePage = lazy(() => import('./pages/admin/AdminVerificationQueuePage'));
const AdminBrandVerificationReviewPage = lazy(() => import('./pages/admin/AdminBrandVerificationReviewPage'));
const AdminContentManagementPage = lazy(() => import('./pages/admin/AdminContentManagementPage'));
const AdminContentReviewPage = lazy(() => import('./pages/admin/AdminContentReviewPage'));
const AdminTaxonomyPage = lazy(() => import('./pages/admin/AdminTaxonomyPage'));
const AdminTagsPage = lazy(() => import('./pages/admin/AdminTagsPage'));
const AdminFinancePage = lazy(() => import('./pages/admin/AdminFinancePage'));
const AdminSettlementPoliciesPage = lazy(() => import('./pages/admin/AdminSettlementPoliciesPage'));
const AdminPayoutsPage = lazy(() => import('./pages/admin/AdminPayoutsPage'));
const AdminOrderDetailPage = lazy(() => import('./pages/admin/AdminOrderDetailPage'));
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage'));
const AdminDisputesPage = lazy(() => import('./pages/admin/AdminDisputesPage'));
const AdminModerationPage = lazy(() => import('./pages/admin/AdminModerationPage'));
const AdminReviewsPage = lazy(() => import('./pages/admin/AdminReviewsPage'));
const AdminAuditPage = lazy(() => import('./pages/admin/AdminAuditPage'));
const AdminMonitoringPage = lazy(() => import('./pages/admin/AdminMonitoringPage'));
const AdminMarketGovernancePage = lazy(() => import('./pages/admin/AdminMarketGovernancePage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));
const AdminForceResetPasswordPage = lazy(() => import('./pages/admin/AdminForceResetPasswordPage'));
const AdminResetPasswordPage = lazy(() => import('./pages/admin/AdminResetPasswordPage'));
const AdminCustomOrdersPage = lazy(() => import('./pages/admin/AdminCustomOrdersPage'));
const AdminMessagingPage = lazy(() => import('./pages/admin/AdminMessagingPage'));

// Password reset pages — lazy loaded
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const EmailVerifyPage = lazy(() => import('./pages/EmailVerify'));
const ChangeEmailConfirmPage = lazy(() => import('./pages/ChangeEmailConfirmPage'));
const LegalIndexPage = lazy(() => import('./pages/legal/LegalIndexPage'));
const LegalDocumentPage = lazy(() => import('./pages/legal/LegalDocumentPage'));

const AppRouteFallback: React.FC = () => (
  /* Route chunk fallback that stays inside content flow instead of rendering
     a global full-screen overlay over navigation/chrome. */
  <div className="px-4 pb-8 pt-20 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="h-10 w-44 animate-pulse rounded-full bg-gray-200/90 dark:bg-gray-800/85" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-52 animate-pulse rounded-2xl bg-gray-200/90 dark:bg-gray-800/80"
          />
        ))}
      </div>
    </div>
  </div>
);

const StudioRouteFallback: React.FC = () => {
  const embeddedSurface = useEmbeddedSurface();
  const isEmbeddedMobile = embeddedSurface === 'mobile-app';

  return (
    <div
      className={`flex items-center justify-center bg-[color:var(--surface-primary)] px-5 text-center text-[color:var(--text-primary)] ${
        isEmbeddedMobile ? 'min-h-[calc(100dvh-8rem)]' : 'min-h-[420px]'
      }`}
    >
      <div className="w-full max-w-sm">
        <div
          className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[color:rgba(var(--brand-primary-rgb),0.22)] border-t-[color:var(--brand-primary)]"
          aria-hidden="true"
        />
        <div className="text-base font-semibold">Studio</div>
        <p className="mt-2 text-sm text-[color:var(--text-secondary)]">Loading workspace</p>
      </div>
    </div>
  );
};

const noopStudioSelect = () => {};

const StudioProtected: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <StudioHandoffGate>
    <RequireBrand>{children}</RequireBrand>
  </StudioHandoffGate>
);

const withRouteFallback = (element: React.ReactNode) => (
  <Suspense fallback={<AppRouteFallback />}>{element}</Suspense>
);

const withStudioContentFallback = (element: React.ReactNode) => (
  <Suspense fallback={<StudioRouteFallback />}>{element}</Suspense>
);

const withStudioRouteFallback = (
  active: string,
  element: React.ReactNode,
) => (
  <Suspense
    fallback={
      <StudioScaffold active={active} onSelect={noopStudioSelect}>
        <StudioRouteFallback />
      </StudioScaffold>
    }
  >
    {element}
  </Suspense>
);

const AdminProfileRouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const role = useSelector((state: RootState) => state.user.profile?.role);
  if (role === 'SuperAdmin' || role === 'Admin') {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
};

const RequireAdminPermission: React.FC<{
  permission?: string | string[];
  requireAll?: boolean;
  superAdminOnly?: boolean;
  children: React.ReactNode;
}> = ({ permission, requireAll = false, superAdminOnly = false, children }) => {
  const { isSuperAdmin, hasPermission } = useAdminPermissions();

  if (superAdminOnly && !isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const required = Array.isArray(permission)
    ? permission
    : permission
      ? [permission]
      : [];
  const allowed =
    required.length === 0 ||
    isSuperAdmin ||
    (requireAll
      ? required.every((code) => hasPermission(code))
      : required.some((code) => hasPermission(code)));

  if (allowed) {
    return <>{children}</>;
  }

  return <Navigate to="/admin" replace />;
};

/**
 * Root layout component that wraps all routes
 * Contains global overlays like CartDrawer and WishlistDrawer
 * that need Router context (useNavigate)
 */
const ViewportSync: React.FC<{ watchKey?: string }> = ({ watchKey }) => {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      dispatch(setViewportWidth(window.innerWidth));
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    const handleVisibility = () => {
      if (!document.hidden) {
        handleResize();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [dispatch]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      dispatch(setViewportWidth(window.innerWidth));
    }
  }, [dispatch, watchKey]);

  return null;
};

const RootLayout: React.FC = () => {
  const location = useLocation();
  const embeddedSurface = useEmbeddedSurface();
  const isEmbeddedMobile = embeddedSurface === 'mobile-app';
  const [showRouteIntentProgress, setShowRouteIntentProgress] = useState(false);
  const routeIntentTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;

      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }

      const nextUrl = new URL(href, window.location.origin);
      if (nextUrl.origin !== window.location.origin) return;

      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const next = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      if (next === current) return;

      setShowRouteIntentProgress(true);
      if (routeIntentTimeoutRef.current !== null) {
        window.clearTimeout(routeIntentTimeoutRef.current);
      }
      routeIntentTimeoutRef.current = window.setTimeout(() => {
        setShowRouteIntentProgress(false);
        routeIntentTimeoutRef.current = null;
      }, 1600);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      if (routeIntentTimeoutRef.current !== null) {
        window.clearTimeout(routeIntentTimeoutRef.current);
        routeIntentTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setShowRouteIntentProgress(false);
    if (routeIntentTimeoutRef.current !== null) {
      window.clearTimeout(routeIntentTimeoutRef.current);
      routeIntentTimeoutRef.current = null;
    }
  }, [location.pathname]);

  return (
    <BagFlowProvider>
      <>
        {showRouteIntentProgress && (
          <div className="pointer-events-none fixed inset-x-0 top-0 z-[2147483646] h-0.5 overflow-hidden">
            <div className="h-full w-full animate-pulse bg-gradient-to-r from-fuchsia-500 via-indigo-500 to-cyan-500" />
          </div>
        )}
        <ViewportSync watchKey={location.pathname} />
        {!isEmbeddedMobile ? (
          <Suspense fallback={null}>
            <CartDrawer />
            <WishlistDrawer />
            <GlobalModalRouter />
          </Suspense>
        ) : null}
        <Suspense fallback={<AppRouteFallback />}>
          <Outlet />
        </Suspense>
      </>
    </BagFlowProvider>
  );
};

const LegacyProductEditRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/studio/store/products/${id}/edit` : '/studio/store'} replace />;
};

const StudioRedirect: React.FC<{ to: string; preserveCurrentQuery?: boolean }> = ({ to, preserveCurrentQuery = false }) => {
  const location = useLocation();
  const currentParams = new URLSearchParams(location.search);
  if (currentParams.get('surface') !== 'mobile-app') {
    if (!preserveCurrentQuery) {
      return <Navigate to={to} replace />;
    }
    const [pathnameWithSearch, hash = ''] = to.split('#');
    const [pathname, search = ''] = pathnameWithSearch.split('?');
    const nextParams = new URLSearchParams(search);
    currentParams.forEach((value, key) => {
      if (!nextParams.has(key)) nextParams.set(key, value);
    });
    const query = nextParams.toString();
    return <Navigate to={`${pathname}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`} replace />;
  }

  const [pathnameWithSearch, hash = ''] = to.split('#');
  const [pathname, search = ''] = pathnameWithSearch.split('?');
  const nextParams = new URLSearchParams(search);
  if (preserveCurrentQuery) {
    currentParams.forEach((value, key) => {
      if (!nextParams.has(key)) nextParams.set(key, value);
    });
  }
  nextParams.set('surface', 'mobile-app');
  const currentTheme = currentParams.get('theme');
  if (currentTheme === 'light' || currentTheme === 'dark') {
    nextParams.set('theme', currentTheme);
  }
  const query = nextParams.toString();
  return <Navigate to={`${pathname}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`} replace />;
};

const DesignCreateAliasRedirect: React.FC = () => {
  const location = useLocation();
  return <Navigate to={`/profile/collections/create${location.search}${location.hash}`} replace />;
};

const DesignEditAliasRedirect: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();
  return (
    <Navigate
      to={id ? `/profile/collections/edit/${encodeURIComponent(id)}${location.search}${location.hash}` : '/profile/collections/create'}
      replace
    />
  );
};

const ProductEditAliasRedirect: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  return <StudioRedirect to={id ? `/studio/store/products/${encodeURIComponent(id)}/edit` : '/studio/store/products/new'} preserveCurrentQuery />;
};

const CollectionEditAliasRedirect: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const target = id
    ? `/studio/store/collections/new?collectionId=${encodeURIComponent(id)}&mode=edit`
    : '/studio/store/collections/new';
  return <StudioRedirect to={target} preserveCurrentQuery />;
};

const LegacyBuyerCustomOrdersRedirect: React.FC = () => {
  const { orderId } = useParams<{ orderId?: string }>();
  if (orderId) {
    return (
      <Navigate
        to={`/profile?tab=orders&kind=custom&orderId=${encodeURIComponent(orderId)}`}
        replace
      />
    );
  }
  return <Navigate to="/profile?tab=orders" replace />;
};

const profileChildren = [
  { index: true, element: withRouteFallback(<Profile />) },
  {
    path: 'collections',
    element: <RequireBrand />,
    children: [
      { path: 'create', element: withRouteFallback(<CreateDesignPage />) },
      { path: 'edit/:id', element: withRouteFallback(<CreateDesignPage />) },
    ],
  },
  { path: 'success', element: <Success /> },
  { path: 'settings', element: <SettingsHome /> },
  { path: 'settings/collections', element: <CollectionsSettings /> },
];

const router = createBrowserRouter([
  {
    // Root wrapper that provides Router context to global drawers
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: '/',
        element: <Layout />,
        children: [
          { index: true, element: withRouteFallback(<Market mode="designs" />) },
          { path: 'market', element: withRouteFallback(<Market mode="designs" />) },
          { path: 'market-place', element: withRouteFallback(<MarketPlace />) },
          { path: 'market/sections/:sectionKey', element: withRouteFallback(<MarketSectionPage />) },
          { path: 'search', element: withRouteFallback(<SearchResultsPage />) },
          { path: 'subscriptions', element: <SubscriptionsPlaceholder /> },
          { path: 'history', element: <HistoryPlaceholder /> },
          { path: 'watch-later', element: <WatchLaterPlaceholder /> },
          { path: 'trending', element: <TrendingPlaceholder /> },
          { path: 'size-charts', element: withRouteFallback(<SizeChartsPage />) },
          { path: 'help/verified-badge', element: <VerifiedBadgeMeaningPage /> },
          { path: 'legal', element: withRouteFallback(<LegalIndexPage />) },
          { path: 'terms', element: withRouteFallback(<LegalDocumentPage />) },
          { path: 'privacy', element: withRouteFallback(<LegalDocumentPage />) },
          { path: 'cookies', element: withRouteFallback(<LegalDocumentPage />) },
          { path: 'community-guidelines', element: withRouteFallback(<LegalDocumentPage />) },
          { path: 'seller-terms', element: withRouteFallback(<LegalDocumentPage />) },
          { path: 'buyer-policy', element: withRouteFallback(<LegalDocumentPage />) },
          { path: 'payment-policy', element: withRouteFallback(<LegalDocumentPage />) },
          { path: 'copyright', element: withRouteFallback(<LegalDocumentPage />) },
          { path: 'account-deletion', element: withRouteFallback(<LegalDocumentPage />) },
          { path: 'settings', element: <SettingsHome /> },
          { path: 'settings/collections', element: <CollectionsSettings /> },
        ],
      },
      {
        path: '/designs/create',
        element: <DesignCreateAliasRedirect />,
      },
      {
        path: '/designs/:id/edit',
        element: <DesignEditAliasRedirect />,
      },
      {
        path: '/designs/:id',
        element: <Layout><DesignDetailsPage /></Layout>,
      },
      {
        path: '/products/create',
        element: <StudioRedirect to="/studio/store/products/new" preserveCurrentQuery />,
      },
      {
        path: '/products/:id/edit',
        element: <ProductEditAliasRedirect />,
      },
      {
        path: '/collections/create',
        element: <StudioRedirect to="/studio/store/collections/new" preserveCurrentQuery />,
      },
      {
        path: '/collections/:id/edit',
        element: <CollectionEditAliasRedirect />,
      },
      {
        path: '/studio',
        element: (
          <StudioProtected>
            <RequireStoreSetup>
              {withStudioRouteFallback('overview', <StudioHome />)}
            </RequireStoreSetup>
          </StudioProtected>
        ),
      },
      {
        path: '/studio/store',
        element: (
          <StudioProtected>
            <RequireStoreSetup>
              <StudioScaffold active="store" onSelect={noopStudioSelect}>
                {withStudioContentFallback(<StoreManagement />)}
              </StudioScaffold>
            </RequireStoreSetup>
          </StudioProtected>
        ),
      },
      {
        path: '/studio/verification',
        element: (
          <StudioProtected>
            <RequireStoreSetup>
              <StudioScaffold active="store" onSelect={noopStudioSelect}>
                {withStudioContentFallback(<StoreVerificationPage />)}
              </StudioScaffold>
            </RequireStoreSetup>
          </StudioProtected>
        ),
      },
      {
        path: '/studio/verification/apply',
        element: (
          <StudioProtected>
            <RequireStoreSetup>
              <StudioScaffold active="store" onSelect={noopStudioSelect}>
                {withStudioContentFallback(<VerificationWizardPage />)}
              </StudioScaffold>
            </RequireStoreSetup>
          </StudioProtected>
        ),
      },
      {
        path: '/studio/verification/submitted',
        element: (
          <StudioProtected>
            <RequireStoreSetup>
              <StudioScaffold active="store" onSelect={noopStudioSelect}>
                {withStudioContentFallback(<VerificationSubmittedPage />)}
              </StudioScaffold>
            </RequireStoreSetup>
          </StudioProtected>
        ),
      },
      {
        path: '/studio/store/collections',
        element: <StudioRedirect to="/studio/store?view=collections" />,
      },
      {
        path: '/studio/store/custom-orders',
        element: <StudioRedirect to="/studio/custom-orders" />,
      },
      {
        path: '/studio/store/collections/new',
        element: (
          <StudioProtected>
            <RequireStoreSetup>
              <StudioScaffold active="store" onSelect={noopStudioSelect}>
                {withStudioContentFallback(<StoreCollectionCreate />)}
              </StudioScaffold>
            </RequireStoreSetup>
          </StudioProtected>
        ),
      },
      {
        path: '/studio/store/products/new',
        element: (
          <StudioProtected>
            <RequireStoreSetup>
              <StudioScaffold active="store" onSelect={noopStudioSelect}>
                {withStudioContentFallback(<EditProduct />)}
              </StudioScaffold>
            </RequireStoreSetup>
          </StudioProtected>
        ),
      },
      {
        path: '/studio/store/products/:id/edit',
        element: (
          <StudioProtected>
            <RequireStoreSetup>
              <StudioScaffold active="store" onSelect={noopStudioSelect}>
                {withStudioContentFallback(<EditProduct />)}
              </StudioScaffold>
            </RequireStoreSetup>
          </StudioProtected>
        ),
      },
      {
        path: '/studio/store/products/:id',
        element: (
          <StudioProtected>
            <RequireStoreSetup>
              <StudioScaffold active="store" onSelect={noopStudioSelect}>
                {withStudioContentFallback(<ProductDetailsPage />)}
              </StudioScaffold>
            </RequireStoreSetup>
          </StudioProtected>
        ),
      },
      {
        path: '/studio/custom-orders',
        element: (
          <StudioProtected>
            <RequireStoreSetup>
              <StudioScaffold active="orders" onSelect={noopStudioSelect}>
                {withStudioContentFallback(<StudioCustomOrdersPage />)}
              </StudioScaffold>
            </RequireStoreSetup>
          </StudioProtected>
        ),
      },
      {
        path: '/studio/custom-orders/:orderId',
        element: (
          <StudioProtected>
            <RequireStoreSetup>
              <StudioScaffold active="orders" onSelect={noopStudioSelect}>
                {withStudioContentFallback(<StudioCustomOrderDetailPage />)}
              </StudioScaffold>
            </RequireStoreSetup>
          </StudioProtected>
        ),
      },
      {
        path: '/studio/staff',
        element: (
          <StudioProtected>
            <RequireStoreSetup>
              <StudioScaffold active="staff" onSelect={noopStudioSelect}>
                {withStudioContentFallback(<BrandStaffPage />)}
              </StudioScaffold>
            </RequireStoreSetup>
          </StudioProtected>
        ),
      },
      {
        path: '/studio/messages',
        element: (
          <StudioProtected>
            <RequireStoreSetup>
              <StudioScaffold active="messages" onSelect={noopStudioSelect}>
                {withStudioContentFallback(<MessagingManagementPage />)}
              </StudioScaffold>
            </RequireStoreSetup>
          </StudioProtected>
        ),
      },
      {
        path: '/studio/shop/setup',
        element: <StudioRedirect to="/studio/store/setup" />,
      },
      {
        path: '/studio/shop/essentials',
        element: <StudioRedirect to="/studio/store/essentials" />,
      },
      {
        path: '/studio/store/setup',
        element: (
          <StudioProtected>
            <RequireStoreSetup>
              <ShopSetupWizardPage />
            </RequireStoreSetup>
          </StudioProtected>
        ),
      },
      {
        path: '/studio/store/essentials',
        element: (
          <StudioProtected>
            <RequireStoreSetup>
              <ShopSetupEssentialsPage />
            </RequireStoreSetup>
          </StudioProtected>
        ),
      },
      {
        path: '/studio/products',
        element: <StudioRedirect to="/studio/store" />,
      },
      {
        path: '/studio/products/create',
        element: <StudioRedirect to="/studio/store/products/new" />,
      },
      {
        path: '/studio/products/edit/:id',
        element: <LegacyProductEditRedirect />,
      },
      {
        path: '/dashboard',
        element: <Navigate to="/studio" replace />,
      },
      {
        path: '/profile',
        element: (
          <RequireAuthenticated>
            <AdminProfileRouteGuard>
              <ProfileLayout />
            </AdminProfileRouteGuard>
          </RequireAuthenticated>
        ),
        children: profileChildren,
      },
      {
        path: '/profile/:id',
        element: (
          <AdminProfileRouteGuard>
            <ProfileLayout />
          </AdminProfileRouteGuard>
        ),
        children: profileChildren,
      },
      {
        path: '/u/:username',
        element: <Layout><ProfileAliasRedirect /></Layout>,
      },
      {
        path: '/brand/:slug',
        element: <Layout><StorefrontAliasRedirect /></Layout>,
      },
      {
        path: '/verify-email',
        element: <EmailVerifyPage />,
      },
      {
        path: '/change-email/confirm',
        element: withRouteFallback(<ChangeEmailConfirmPage />),
      },
      {
        path: '/brand/staff/invite',
        element: withRouteFallback(<BrandStaffInvitePage />),
      },
      {
        path: '/brand/reviews',
        element: <StudioRedirect to="/studio?tab=reviews" />,
      },
      {
        element: <GuestRoute />,
        children: [
          { path: '/signup', element: <SignupPage /> },
          { path: '/login', element: <LoginPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
          { path: '/reset-password', element: <ResetPasswordPage /> },
          { path: '/account-reactivation', element: <AccountReactivationRequestPage /> },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/bag', element: <Navigate to="/" replace /> },
          { path: '/checkout', element: <Layout>{withRouteFallback(<CheckoutPage />)}</Layout> },
          { path: '/bag/payment-return', element: <Layout><PaymentReturnPage /></Layout> },
          { path: '/bag/confirmation', element: <Layout><OrderConfirmation /></Layout> },
          { path: '/orders', element: <Layout><MyOrders /></Layout> },
          { path: '/account/reviews', element: <Layout><MyReviewsPage /></Layout> },
          { path: '/messages', element: <Layout><MessagingManagementPage /></Layout> },
          {
            path: '/store/payouts',
            element: (
              <RequireBrand>
                <Layout>
                  <BrandPayoutsPage />
                </Layout>
              </RequireBrand>
            ),
          },
          {
            path: '/store/payouts/:payoutId',
            element: (
              <RequireBrand>
                <Layout>
                  <BrandPayoutsPage />
                </Layout>
              </RequireBrand>
            ),
          },
          { path: '/custom-orders', element: <LegacyBuyerCustomOrdersRedirect /> },
          { path: '/custom-orders/new', element: <Layout><CustomOrderComposerPage /></Layout> },
          { path: '/custom-orders/resume/:token', element: <Layout><CustomOrderCheckoutResumePage /></Layout> },
          { path: '/custom-orders/:orderId', element: <LegacyBuyerCustomOrdersRedirect /> },
          { path: '/orders/:orderId', element: <Layout><OrderDetail /></Layout> },
        ],
      },
      {
        path: '/store/:brandId',
        element: <LegacyStoreRedirect />,
      },
      {
        // Legacy store essentials route (moved into Studio)
        path: '/store/essentials',
        element: <Navigate to="/studio/store/essentials" replace />,
      },
      {
        // Legacy store wizard route (moved into Studio)
        path: '/store/create',
        element: <Navigate to="/studio/store/setup" replace />,
      },
      {
        // Legacy owner's store view (moved into Studio)
        path: '/store/my',
        element: <Navigate to="/studio/store" replace />,
      },
      {
        // Redirect /store/dashboard to Studio shop
        path: '/store/dashboard',
        element: <Navigate to="/studio/store" replace />,
      },
      {
        path: '/collections/:id',
        element: <CollectionRouter />,
      },
      {
        path: '/products/:id',
        element: <Layout><ProductDetailsPage /></Layout>,
      },
      {
        path: '/p/:slug',
        element: <Layout><ProductAliasRedirect /></Layout>,
      },
      {
        path: '/admin/reset-password',
        element: (
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-500 text-sm">Loading reset page...</div>}>
            <AdminResetPasswordPage />
          </Suspense>
        ),
      },
      {
        path: '/admin/force-reset-password',
        element: (
          <RequireAdmin>
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-500 text-sm">Loading reset page...</div>}>
              <AdminForceResetPasswordPage />
            </Suspense>
          </RequireAdmin>
        ),
      },
      // ── Admin Console (lazy-loaded, guarded) ──
      {
        path: '/admin',
        element: (
          <RequireAdmin>
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-500 text-sm">Loading admin console...</div>}>
              <AdminScaffold />
            </Suspense>
          </RequireAdmin>
        ),
        children: [
          { index: true, element: <AdminDashboard /> },
          { path: 'custom-orders', element: <RequireAdminPermission permission="MODERATION_READ"><AdminCustomOrdersPage /></RequireAdminPermission> },
          { path: 'custom-orders/:orderId', element: <RequireAdminPermission permission="MODERATION_READ"><AdminCustomOrdersPage /></RequireAdminPermission> },
          { path: 'users', element: <RequireAdminPermission permission="USERS_READ"><AdminUsersPage /></RequireAdminPermission> },
          { path: 'brands', element: <RequireAdminPermission permission="BRANDS_READ"><AdminBrandsPage /></RequireAdminPermission> },
          { path: 'verification', element: <RequireAdminPermission permission="BRANDS_VERIFY"><AdminVerificationQueuePage /></RequireAdminPermission> },
          { path: 'brands/:id/verification-review', element: <RequireAdminPermission permission="BRANDS_VERIFY"><AdminBrandVerificationReviewPage /></RequireAdminPermission> },
          { path: 'content', element: <RequireAdminPermission permission={['PRODUCTS_READ', 'COLLECTIONS_READ']}><AdminContentManagementPage /></RequireAdminPermission> },
          { path: 'content-review', element: <RequireAdminPermission permission="CONTENT_REVIEW_READ"><AdminContentReviewPage /></RequireAdminPermission> },
          { path: 'products', element: <Navigate to="/admin/content?tab=products" replace /> },
          { path: 'collections', element: <Navigate to="/admin/content?tab=collections" replace /> },
          { path: 'taxonomy', element: <RequireAdminPermission permission="TAXONOMY_READ"><AdminTaxonomyPage /></RequireAdminPermission> },
          { path: 'tags', element: <RequireAdminPermission permission="TAGS_READ"><AdminTagsPage /></RequireAdminPermission> },
          { path: 'measurements', element: <Navigate to="/admin/taxonomy?tab=measurements" replace /> },
          { path: 'orders', element: <RequireAdminPermission permission="PAYOUTS_READ"><AdminOrdersPage /></RequireAdminPermission> },
          { path: 'finance', element: <RequireAdminPermission permission="PAYOUTS_READ"><AdminFinancePage /></RequireAdminPermission> },
          { path: 'finance/payments/:reference', element: <RequireAdminPermission permission="PAYOUTS_READ"><AdminFinancePage /></RequireAdminPermission> },
          { path: 'finance/settlement-policies', element: <RequireAdminPermission permission="PAYOUTS_READ"><AdminSettlementPoliciesPage /></RequireAdminPermission> },
          { path: 'orders/:orderId', element: <RequireAdminPermission permission="PAYOUTS_READ"><AdminOrderDetailPage /></RequireAdminPermission> },
          { path: 'payouts', element: <RequireAdminPermission permission="PAYOUTS_READ"><AdminPayoutsPage /></RequireAdminPermission> },
          { path: 'disputes', element: <RequireAdminPermission permission="DISPUTES_READ"><AdminDisputesPage /></RequireAdminPermission> },
          { path: 'messaging', element: <RequireAdminPermission permission="MESSAGING_READ"><AdminMessagingPage /></RequireAdminPermission> },
          { path: 'moderation', element: <RequireAdminPermission permission="MODERATION_READ"><AdminModerationPage /></RequireAdminPermission> },
          { path: 'reviews', element: <RequireAdminPermission permission="MODERATION_READ"><AdminReviewsPage /></RequireAdminPermission> },
          { path: 'audit', element: <RequireAdminPermission permission="AUDIT_READ"><AdminAuditPage /></RequireAdminPermission> },
          { path: 'monitoring', element: <RequireAdminPermission permission="ALERTS_READ"><AdminMonitoringPage /></RequireAdminPermission> },
          { path: 'alerts', element: <Navigate to="/admin/monitoring" replace /> },
          { path: 'market-governance', element: <RequireAdminPermission permission="MARKET_GOVERNANCE_READ"><AdminMarketGovernancePage /></RequireAdminPermission> },
          { path: 'settings', element: <RequireAdminPermission superAdminOnly permission={['SYSTEM_SLA_READ', 'SYSTEM_FEATURE_FLAGS_WRITE', 'SYSTEM_SETTINGS_WRITE']}><AdminSettingsPage /></RequireAdminPermission> },
          { path: 'settings/sla', element: <RequireAdminPermission superAdminOnly permission={['SYSTEM_SLA_READ', 'SYSTEM_FEATURE_FLAGS_WRITE', 'SYSTEM_SETTINGS_WRITE']}><AdminSettingsPage /></RequireAdminPermission> },
        ],
      },
      // Catch-all 404 route - must be last
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
]);

const App: React.FC = () => (
  <AuthProvider>
    <ThemeBackendSync />
    <DropdownManagerProvider>
      <BrandPatchProvider>
        <Toaster position="top-center" richColors closeButton />
        <RouterProvider router={router} />
      </BrandPatchProvider>
    </DropdownManagerProvider>
  </AuthProvider>
);

export default App;
