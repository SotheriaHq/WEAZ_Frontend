
import React, { Suspense, useEffect, lazy } from 'react';
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
import CheckoutPage from './pages/checkout/CheckoutPage';
import OrderConfirmation from './pages/checkout/OrderConfirmation';
import PaymentReturnPage from './pages/checkout/PaymentReturnPage';
import OrderAccessResolverPage from './pages/orders/OrderAccessResolverPage';
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
import type { AppDispatch } from '@/store';
import { setViewportWidth } from '@/features/uiSlice';
import RequireAdmin from './components/admin/RequireAdmin';

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
const CustomOrdersPage = lazy(() => import('./pages/studio/CustomOrdersPage'));
const MyOrders = lazy(() => import('./pages/orders/MyOrders'));
const OrderDetail = lazy(() => import('./pages/orders/OrderDetail'));
const CustomOrdersIndexPage = lazy(() => import('./pages/custom-orders/CustomOrdersIndexPage'));
const CustomOrderComposerPage = lazy(() => import('./pages/custom-orders/CustomOrderComposerPage'));
const CustomOrderDetailPage = lazy(() => import('./pages/custom-orders/CustomOrderDetailPage'));

// Admin pages — lazy loaded for code splitting
const AdminScaffold = lazy(() => import('./components/admin/AdminScaffold'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminBrandsPage = lazy(() => import('./pages/admin/AdminBrandsPage'));
const AdminVerificationQueuePage = lazy(() => import('./pages/admin/AdminVerificationQueuePage'));
const AdminBrandVerificationReviewPage = lazy(() => import('./pages/admin/AdminBrandVerificationReviewPage'));
const AdminProductsPage = lazy(() => import('./pages/admin/AdminProductsPage'));
const AdminCollectionsPage = lazy(() => import('./pages/admin/AdminCollectionsPage'));
const AdminTaxonomyPage = lazy(() => import('./pages/admin/AdminTaxonomyPage'));
const AdminTagsPage = lazy(() => import('./pages/admin/AdminTagsPage'));
const AdminMeasurementsPage = lazy(() => import('./pages/admin/AdminMeasurementsPage'));
const AdminPayoutsPage = lazy(() => import('./pages/admin/AdminPayoutsPage'));
const AdminDisputesPage = lazy(() => import('./pages/admin/AdminDisputesPage'));
const AdminModerationPage = lazy(() => import('./pages/admin/AdminModerationPage'));
const AdminAuditPage = lazy(() => import('./pages/admin/AdminAuditPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));
const AdminForceResetPasswordPage = lazy(() => import('./pages/admin/AdminForceResetPasswordPage'));
const AdminResetPasswordPage = lazy(() => import('./pages/admin/AdminResetPasswordPage'));
const AdminCustomOrdersPage = lazy(() => import('./pages/admin/AdminCustomOrdersPage'));

const AppRouteFallback: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">Loading page...</div>
);

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

  return (
    <>
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
              <StudioScaffold active="custom-orders" onSelect={() => {}}>
                <CustomOrdersPage />
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
              <StudioScaffold active="custom-orders" onSelect={() => {}}>
                <CustomOrdersPage />
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
            <ShopSetupWizardPage />
          </RequireBrand>
        ),
      },
      {
        path: '/studio/store/essentials',
        element: (
          <RequireBrand>
            <ShopSetupEssentialsPage />
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
        element: <ProfileLayout />,
        children: profileChildren,
      },
      {
        path: '/profile/:id',
        element: <ProfileLayout />,
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
        element: <GuestRoute />,
        children: [
          { path: '/signup', element: <SignupPage /> },
          { path: '/login', element: <LoginPage /> },
          { path: '/account-reactivation', element: <AccountReactivationRequestPage /> },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/checkout', element: <Layout><CheckoutPage /></Layout> },
          { path: '/checkout/payment-return', element: <Layout><PaymentReturnPage /></Layout> },
          { path: '/checkout/confirmation', element: <Layout><OrderConfirmation /></Layout> },
          { path: '/orders', element: <Layout><MyOrders /></Layout> },
          { path: '/custom-orders', element: <Layout><CustomOrdersIndexPage /></Layout> },
          { path: '/custom-orders/new', element: <Layout><CustomOrderComposerPage /></Layout> },
          { path: '/custom-orders/:orderId', element: <Layout><CustomOrderDetailPage /></Layout> },
          { path: '/orders/access/:orderId', element: <Layout><OrderAccessResolverPage /></Layout> },
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
          { path: 'custom-orders', element: <AdminCustomOrdersPage /> },
          { path: 'custom-orders/:orderId', element: <AdminCustomOrdersPage /> },
          { path: 'users', element: <AdminUsersPage /> },
          { path: 'brands', element: <AdminBrandsPage /> },
          { path: 'verification', element: <AdminVerificationQueuePage /> },
          { path: 'brands/:id/verification-review', element: <AdminBrandVerificationReviewPage /> },
          { path: 'products', element: <AdminProductsPage /> },
          { path: 'collections', element: <AdminCollectionsPage /> },
          { path: 'taxonomy', element: <AdminTaxonomyPage /> },
          { path: 'tags', element: <AdminTagsPage /> },
          { path: 'measurements', element: <AdminMeasurementsPage /> },
          { path: 'payouts', element: <AdminPayoutsPage /> },
          { path: 'disputes', element: <AdminDisputesPage /> },
          { path: 'moderation', element: <AdminModerationPage /> },
          { path: 'audit', element: <AdminAuditPage /> },
          { path: 'settings', element: <AdminSettingsPage /> },
          { path: 'settings/sla', element: <AdminSettingsPage /> },
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
