
import React from 'react';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { Layout } from './components/Layout';
import Market from './pages/Market';
import SettingsHome from './pages/settings/SettingsHome';
import CollectionsSettings from './pages/settings/CollectionsSettings';
import SignupPage from './pages/SignUp';
import Success from './pages/Success';
import LoginPage from './pages/Login';
// Removed separate BrandPublic visitor page; unified profile view handles both owner & visitor modes
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Profile from './pages/catalog/Catalog';
import { ProfileLayout } from './components/catalog/ProfileLayout';
import CreateCollectionPage from './pages/catalog/CreateCollectionRedesign';
import RequireBrand from './components/RequireBrand';
import { Toaster } from 'sonner';
import CollectionViewRedesign from './pages/catalog/CollectionViewRedesign';
import ErrorPage from './pages/ErrorPage';
import StudioHome from './pages/studio/StudioHome';
import ProductManagement from './pages/studio/products/ProductManagement';
import EditProduct from './pages/studio/products/EditProduct';
import { Navigate } from 'react-router-dom';
import CartDrawer from './components/designs/CartDrawer';
import WishlistDrawer from './components/designs/WishlistDrawer';
import BrandStore from './pages/brand/BrandStore';
import CheckoutPage from './pages/checkout/CheckoutPage';
import MyOrders from './pages/orders/MyOrders';
import OrderDetail from './pages/orders/OrderDetail';
// Placeholder pages for features under development
import {
  NotFound,
  MarketplacePlaceholder,
  SubscriptionsPlaceholder,
  HistoryPlaceholder,
  WatchLaterPlaceholder,
  TrendingPlaceholder,
} from './pages/placeholders';
import StoreCreationWizard from './pages/store/StoreCreationWizard';
import StoreEssentials from './pages/store/StoreEssentials';
import MyStore from './pages/store/MyStore';
import { GlobalModalRouter } from './components/modals/GlobalModalRouter';

/**
 * Root layout component that wraps all routes
 * Contains global overlays like CartDrawer and WishlistDrawer
 * that need Router context (useNavigate)
 */
const RootLayout: React.FC = () => (
  <>
    <CartDrawer />
    <WishlistDrawer />
    <GlobalModalRouter />
    <Outlet />
  </>
);

const profileChildren = [
  { index: true, element: <Profile /> },
  {
    path: 'collections',
    element: <RequireBrand />,
    children: [
      { path: 'create', element: <CreateCollectionPage /> },
      { path: 'edit/:id', element: <CreateCollectionPage /> },
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
          // Placeholder routes - these render inside Layout via Outlet
          { path: 'market-place', element: <MarketplacePlaceholder /> },
          { path: 'subscriptions', element: <SubscriptionsPlaceholder /> },
          { path: 'history', element: <HistoryPlaceholder /> },
          { path: 'watch-later', element: <WatchLaterPlaceholder /> },
          { path: 'trending', element: <TrendingPlaceholder /> },
          { path: 'settings', element: <SettingsHome /> },
          { path: 'settings/collections', element: <CollectionsSettings /> },
        ],
      },
      {
        path: '/studio',
        element: (
          <RequireBrand>
            <StudioHome />
          </RequireBrand>
        ),
      },
      {
        path: '/studio/products',
        element: (
          <RequireBrand>
            <Layout>
              <ProductManagement />
            </Layout>
          </RequireBrand>
        ),
      },
      {
        path: '/studio/products/create',
        element: (
          <RequireBrand>
            <Layout>
              <EditProduct />
            </Layout>
          </RequireBrand>
        ),
      },
      {
        path: '/studio/products/edit/:id',
        element: (
          <RequireBrand>
            <Layout>
              <EditProduct />
            </Layout>
          </RequireBrand>
        ),
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
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/checkout', element: <Layout><CheckoutPage /></Layout> },
          { path: '/orders', element: <Layout><MyOrders /></Layout> },
          { path: '/orders/:orderId', element: <Layout><OrderDetail /></Layout> },
        ],
      },
      {
        path: '/store/:brandId',
        element: <Layout><BrandStore /></Layout>,
      },
      {
        // Store essentials capture - brand users only, standalone (no Layout)
        path: '/store/essentials',
        element: (
          <RequireBrand>
            <Layout>
              <StoreEssentials />
            </Layout>
          </RequireBrand>
        ),
      },
      {
        // Store creation wizard - brand users only, wrapped in Layout for navbar/sidebar
        path: '/store/create',
        element: (
          <RequireBrand>
            <Layout>
              <StoreCreationWizard />
            </Layout>
          </RequireBrand>
        ),
      },
      {
        // Owner's store view - brand users only
        path: '/store/my',
        element: (
          <RequireBrand>
            <Layout>
              <MyStore />
            </Layout>
          </RequireBrand>
        ),
      },
      {
        // Redirect /store/dashboard to /store/my
        path: '/store/dashboard',
        element: <Navigate to="/store/my" replace />,
      },
      {
        // Standalone collection view page (redesigned)
        path: '/collections/:id',
        element: <CollectionViewRedesign />,
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
    <ThemeProvider defaultTheme="light">
      <Toaster position="top-center" richColors closeButton />
      <RouterProvider router={router} />
    </ThemeProvider>
  </AuthProvider>
);

export default App;
