
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
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';
import { AuthProvider } from './context/AuthContext';
import { DropdownManagerProvider } from './context/DropdownManagerContext';
import { ProfileLayout } from './components/catalog/ProfileLayout';
import RequireBrand from './components/RequireBrand';
import { Toaster } from 'sonner';
import ErrorPage from './pages/ErrorPage';
import CartDrawer from './components/designs/CartDrawer';
import WishlistDrawer from './components/designs/WishlistDrawer';
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
import { GlobalModalRouter } from './components/modals/GlobalModalRouter';
import ShopSetupWizardPage from './pages/studio/shop/ShopSetupWizardPage';
import ShopSetupEssentialsPage from './pages/studio/shop/ShopSetupEssentialsPage';
import StudioScaffold from './components/studio/StudioScaffold';
import RequireStoreSetup from './components/store/RequireStoreSetup';
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

const Market = lazy(() => import('./pages/Market'));
const MarketPlace = lazy(() => import('./pages/MarketPlace'));
const SearchResultsPage = lazy(() => import('./pages/SearchResultsPage'));
const Profile = lazy(() => import('./pages/catalog/Catalog'));
const CreateDesignPage = lazy(() => import('./pages/catalog/CreateDesign'));
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
const MyOrders = lazy(() => import('./pages/orders/MyOrders'));
const OrderDetail = lazy(() => import('./pages/orders/OrderDetail'));
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
const AdminTaxonomyPage = lazy(() => import('./pages/admin/AdminTaxonomyPage'));
const AdminTagsPage = lazy(() => import('./pages/admin/AdminTagsPage'));
const AdminFinancePage = lazy(() => import('./pages/admin/AdminFinancePage'));
const AdminPayoutsPage = lazy(() => import('./pages/admin/AdminPayoutsPage'));
const AdminOrderDetailPage = lazy(() => import('./pages/admin/AdminOrderDetailPage'));
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage'));
const AdminDisputesPage = lazy(() => import('./pages/admin/AdminDisputesPage'));
const AdminModerationPage = lazy(() => import('./pages/admin/AdminModerationPage'));
const AdminAuditPage = lazy(() => import('./pages/admin/AdminAuditPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));
const AdminForceResetPasswordPage = lazy(() => import('./pages/admin/AdminForceResetPasswordPage'));
const AdminResetPasswordPage = lazy(() => import('./pages/admin/AdminResetPasswordPage'));
const AdminCustomOrdersPage = lazy(() => import('./pages/admin/AdminCustomOrdersPage'));
const AdminMessagingPage = lazy(() => import('./pages/admin/AdminMessagingPage'));

// Password reset pages — lazy loaded
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const EmailVerifyPage = lazy(() => import('./pages/EmailVerify'));

const AppRouteFallback: React.FC = () => (
  /* Full-page skeleton shown while the lazy chunk is downloading.
     Matches the general two-column layout (sidebar + masonry grid) so the
     transition to the real page is seamless rather than a white flash. */
  <div className="flex min-h-screen bg-white dark:bg-gray-950">
    {/* Sidebar skeleton */}
    <div className="hidden md:flex flex-col gap-4 w-16 px-2 py-6 border-r border-gray-100 dark:border-gray-800">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse mx-auto" />
      ))}
    </div>
    {/* Content skeleton — masonry-like card grid */}
    <div className="flex-1 p-4">
      <div className="flex gap-2 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-24 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="break-inside-avoid mb-3 rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse"
            style={{ height: `${180 + (i % 3) * 60}px` }}
          />
        ))}
      </div>
    </div>
  </div>
);

const AdminProfileRouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const role = useSelector((state: RootState) => state.user.profile?.role);
  if (role === 'SuperAdmin' || role === 'Admin') {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
};

const RequireAdminPermission: React.FC<{
  permission?: string;
  children: React.ReactNode;
}> = ({ permission, children }) => {
  const { isSuperAdmin, hasPermission } = useAdminPermissions();

  if (!permission || isSuperAdmin || hasPermission(permission)) {
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
  const [showRouteIntentProgress, setShowRouteIntentProgress] = useState(false);
  const routeIntentTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
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
      }, 1600);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      if (routeIntentTimeoutRef.current !== null) {
        window.clearTimeout(routeIntentTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setShowRouteIntentProgress(false);
    if (routeIntentTimeoutRef.current !== null) {
      window.clearTimeout(routeIntentTimeoutRef.current);
      routeIntentTimeoutRef.current = null;
    }
  }, [location.pathname, location.search]);

  return (
    <>
      {showRouteIntentProgress && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[2147483646] h-0.5 overflow-hidden">
          <div className="h-full w-full animate-pulse bg-gradient-to-r from-fuchsia-500 via-indigo-500 to-cyan-500" />
        </div>
      )}
      <ViewportSync watchKey={location.pathname} />
      <CartDrawer />
      <WishlistDrawer />
      <GlobalModalRouter />
      <Suspense fallback={<AppRouteFallback />}>
        <Outlet />
      </Suspense>
    </>
  );
};

const LegacyProductEditRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/studio/store/products/${id}/edit` : '/studio/store'} replace />;
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
  { index: true, element: <Profile /> },
  {
    path: 'collections',
    element: <RequireBrand />,
    children: [
      { path: 'create', element: <CreateDesignPage /> },
      { path: 'edit/:id', element: <CreateDesignPage /> },
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
          { index: true, element: <Market /> },
          { path: 'market', element: <Market /> },
          { path: 'market-place', element: <MarketPlace /> },
          { path: 'search', element: <SearchResultsPage /> },
          { path: 'subscriptions', element: <SubscriptionsPlaceholder /> },
          { path: 'history', element: <HistoryPlaceholder /> },
          { path: 'watch-later', element: <WatchLaterPlaceholder /> },
          { path: 'trending', element: <TrendingPlaceholder /> },
          { path: 'size-charts', element: <SizeChartsPage /> },
          { path: 'help/verified-badge', element: <VerifiedBadgeMeaningPage /> },
          { path: 'settings', element: <SettingsHome /> },
          { path: 'settings/collections', element: <CollectionsSettings /> },
        ],
      },
      {
        path: '/studio',
        element: (
          <RequireBrand>
            <RequireStoreSetup>
              <StudioHome />
            </RequireStoreSetup>
          </RequireBrand>
        ),
      },
      {
        path: '/studio/store',
        element: (
          <RequireBrand>
            <RequireStoreSetup>
              <StudioScaffold active="store" onSelect={() => {}}>
                <StoreManagement />
              </StudioScaffold>
            </RequireStoreSetup>
          </RequireBrand>
        ),
      },
      {
        path: '/studio/verification',
        element: (
          <RequireBrand>
            <RequireStoreSetup>
              <StudioScaffold active="store" onSelect={() => {}}>
                <StoreVerificationPage />
              </StudioScaffold>
            </RequireStoreSetup>
          </RequireBrand>
        ),
      },
      {
        path: '/studio/verification/apply',
        element: (
          <RequireBrand>
            <RequireStoreSetup>
              <StudioScaffold active="store" onSelect={() => {}}>
                <VerificationWizardPage />
              </StudioScaffold>
            </RequireStoreSetup>
          </RequireBrand>
        ),
      },
      {
        path: '/studio/verification/submitted',
        element: (
          <RequireBrand>
            <RequireStoreSetup>
              <StudioScaffold active="store" onSelect={() => {}}>
                <VerificationSubmittedPage />
              </StudioScaffold>
            </RequireStoreSetup>
          </RequireBrand>
        ),
      },
      {
        path: '/studio/store/collections',
        element: <Navigate to="/studio/store?view=collections" replace />,
      },
      {
        path: '/studio/store/custom-orders',
        element: <Navigate to="/studio/custom-orders" replace />,
      },
      {
        path: '/studio/store/collections/new',
        element: (
          <RequireBrand>
            <RequireStoreSetup>
              <StudioScaffold active="store" onSelect={() => {}}>
                <StoreCollectionCreate />
              </StudioScaffold>
            </RequireStoreSetup>
          </RequireBrand>
        ),
      },
      {
        path: '/studio/store/products/new',
        element: (
          <RequireBrand>
            <RequireStoreSetup>
              <StudioScaffold active="store" onSelect={() => {}}>
                <EditProduct />
              </StudioScaffold>
            </RequireStoreSetup>
          </RequireBrand>
        ),
      },
      {
        path: '/studio/store/products/:id/edit',
        element: (
          <RequireBrand>
            <RequireStoreSetup>
              <StudioScaffold active="store" onSelect={() => {}}>
                <EditProduct />
              </StudioScaffold>
            </RequireStoreSetup>
          </RequireBrand>
        ),
      },
      {
        path: '/studio/store/products/:id',
        element: (
          <RequireBrand>
            <RequireStoreSetup>
              <StudioScaffold active="store" onSelect={() => {}}>
                <ProductDetailsPage />
              </StudioScaffold>
            </RequireStoreSetup>
          </RequireBrand>
        ),
      },
      {
        path: '/studio/custom-orders',
        element: (
          <RequireBrand>
            <RequireStoreSetup>
              <StudioScaffold active="orders" onSelect={() => {}}>
                <StudioCustomOrdersPage />
              </StudioScaffold>
            </RequireStoreSetup>
          </RequireBrand>
        ),
      },
      {
        path: '/studio/custom-orders/:orderId',
        element: (
          <RequireBrand>
            <RequireStoreSetup>
              <StudioScaffold active="orders" onSelect={() => {}}>
                <StudioCustomOrderDetailPage />
              </StudioScaffold>
            </RequireStoreSetup>
          </RequireBrand>
        ),
      },
      {
        path: '/studio/messages',
        element: (
          <RequireBrand>
            <RequireStoreSetup>
              <StudioScaffold active="messages" onSelect={() => {}}>
                <MessagingManagementPage />
              </StudioScaffold>
            </RequireStoreSetup>
          </RequireBrand>
        ),
      },
      {
        path: '/studio/shop/setup',
        element: <Navigate to="/studio/store/setup" replace />,
      },
      {
        path: '/studio/shop/essentials',
        element: <Navigate to="/studio/store/essentials" replace />,
      },
      {
        path: '/studio/store/setup',
        element: (
          <RequireBrand>
            <RequireStoreSetup>
              <ShopSetupWizardPage />
            </RequireStoreSetup>
          </RequireBrand>
        ),
      },
      {
        path: '/studio/store/essentials',
        element: (
          <RequireBrand>
            <RequireStoreSetup>
              <ShopSetupEssentialsPage />
            </RequireStoreSetup>
          </RequireBrand>
        ),
      },
      {
        path: '/studio/products',
        element: <Navigate to="/studio/store" replace />,
      },
      {
        path: '/studio/products/create',
        element: <Navigate to="/studio/store/products/new" replace />,
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
          <AdminProfileRouteGuard>
            <ProfileLayout />
          </AdminProfileRouteGuard>
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
          { path: '/bag/payment-return', element: <Layout><PaymentReturnPage /></Layout> },
          { path: '/bag/confirmation', element: <Layout><OrderConfirmation /></Layout> },
          { path: '/orders', element: <Layout><MyOrders /></Layout> },
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
          { path: 'content', element: <AdminContentManagementPage /> },
          { path: 'products', element: <Navigate to="/admin/content?tab=products" replace /> },
          { path: 'collections', element: <Navigate to="/admin/content?tab=collections" replace /> },
          { path: 'taxonomy', element: <RequireAdminPermission permission="TAXONOMY_READ"><AdminTaxonomyPage /></RequireAdminPermission> },
          { path: 'tags', element: <RequireAdminPermission permission="TAGS_READ"><AdminTagsPage /></RequireAdminPermission> },
          { path: 'measurements', element: <Navigate to="/admin/taxonomy?tab=measurements" replace /> },
          { path: 'orders', element: <RequireAdminPermission permission="PAYOUTS_READ"><AdminOrdersPage /></RequireAdminPermission> },
          { path: 'finance', element: <RequireAdminPermission permission="PAYOUTS_READ"><AdminFinancePage /></RequireAdminPermission> },
          { path: 'finance/payments/:reference', element: <RequireAdminPermission permission="PAYOUTS_READ"><AdminFinancePage /></RequireAdminPermission> },
          { path: 'orders/:orderId', element: <RequireAdminPermission permission="PAYOUTS_READ"><AdminOrderDetailPage /></RequireAdminPermission> },
          { path: 'payouts', element: <RequireAdminPermission permission="PAYOUTS_READ"><AdminPayoutsPage /></RequireAdminPermission> },
          { path: 'disputes', element: <RequireAdminPermission permission="DISPUTES_READ"><AdminDisputesPage /></RequireAdminPermission> },
          { path: 'messaging', element: <RequireAdminPermission permission="MESSAGING_READ"><AdminMessagingPage /></RequireAdminPermission> },
          { path: 'moderation', element: <RequireAdminPermission permission="MODERATION_READ"><AdminModerationPage /></RequireAdminPermission> },
          { path: 'audit', element: <RequireAdminPermission permission="AUDIT_READ"><AdminAuditPage /></RequireAdminPermission> },
          { path: 'settings', element: <RequireAdminPermission permission="SYSTEM_SLA_READ"><AdminSettingsPage /></RequireAdminPermission> },
          { path: 'settings/sla', element: <RequireAdminPermission permission="SYSTEM_SLA_READ"><AdminSettingsPage /></RequireAdminPermission> },
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
    <DropdownManagerProvider>
      <Toaster position="top-center" richColors closeButton />
      <RouterProvider router={router} />
    </DropdownManagerProvider>
  </AuthProvider>
);

export default App;
