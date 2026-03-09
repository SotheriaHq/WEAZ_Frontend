
import React, { Suspense, useEffect, lazy } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, Navigate, useParams, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import Market from './pages/Market';
import SettingsHome from './pages/settings/SettingsHome';
import CollectionsSettings from './pages/settings/CollectionsSettings';
import SignupPage from './pages/SignUp';
import Success from './pages/Success';
import LoginPage from './pages/Login';
import AccountReactivationRequestPage from './pages/AccountReactivationRequestPage';
import MarketPlace from './pages/MarketPlace';
// Removed separate BrandPublic visitor page; unified profile view handles both owner & visitor modes
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';
import { AuthProvider } from './context/AuthContext';
import { DropdownManagerProvider } from './context/DropdownManagerContext';
import Profile from './pages/catalog/Catalog';
import { ProfileLayout } from './components/catalog/ProfileLayout';
import CreateDesignPage from './pages/catalog/CreateDesign';
import RequireBrand from './components/RequireBrand';
import { Toaster } from 'sonner';
import CollectionRouter from './pages/catalog/CollectionRouter';
import ErrorPage from './pages/ErrorPage';
import StudioHome from './pages/studio/StudioHome';
import EditProduct from './pages/studio/products/EditProduct';
import CartDrawer from './components/designs/CartDrawer';
import WishlistDrawer from './components/designs/WishlistDrawer';
import LegacyStoreRedirect from './pages/store/LegacyStoreRedirect';
import CheckoutPage from './pages/checkout/CheckoutPage';
import OrderConfirmation from './pages/checkout/OrderConfirmation';
import MyOrders from './pages/orders/MyOrders';
import OrderDetail from './pages/orders/OrderDetail';
import ProductDetailsPage from './pages/catalog/ProductDetailsPage';
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
import StoreManagement from './pages/studio/store/StoreManagement';
import StoreCollectionCreate from './pages/studio/store/StoreCollectionCreate';
import RequireStoreSetup from './components/store/RequireStoreSetup';
import SizeChartsPage from './pages/size-charts/SizeChartsPage';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@/store';
import { setViewportWidth } from '@/features/uiSlice';
import RequireAdmin from './components/admin/RequireAdmin';

// Admin pages — lazy loaded for code splitting
const AdminScaffold = lazy(() => import('./components/admin/AdminScaffold'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminBrandsPage = lazy(() => import('./pages/admin/AdminBrandsPage'));
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
      <Outlet />
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
          { path: 'subscriptions', element: <SubscriptionsPlaceholder /> },
          { path: 'history', element: <HistoryPlaceholder /> },
          { path: 'watch-later', element: <WatchLaterPlaceholder /> },
          { path: 'trending', element: <TrendingPlaceholder /> },
          { path: 'size-charts', element: <SizeChartsPage /> },
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
        path: '/studio/store/collections',
        element: <Navigate to="/studio/store?view=collections" replace />,
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
          { path: '/checkout/confirmation', element: <Layout><OrderConfirmation /></Layout> },
          { path: '/orders', element: <Layout><MyOrders /></Layout> },
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
          { path: 'users', element: <AdminUsersPage /> },
          { path: 'brands', element: <AdminBrandsPage /> },
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
