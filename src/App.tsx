
import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import Market from './pages/Market';
import MarketPlace from './pages/MarketPlace';
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
import CreateCollectionPage from './pages/catalog/CreateCollection';
import RequireBrand from './components/RequireBrand';
import { Toaster } from 'sonner';
import CollectionView from './pages/catalog/CollectionView';
import DropdownDemo from './pages/ui/DropdownDemo';
import AcceptInvite from './pages/AcceptInvite';
import ErrorPage from './pages/ErrorPage';
import StudioHome from './pages/studio/StudioHome';
import Subscriptions from './pages/Subscriptions';
import { Navigate } from 'react-router-dom';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Market /> },
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
    errorElement: <ErrorPage />,
  },
  {
    path: '/dashboard',
    element: <Navigate to="/studio" replace />,
  },
  {
    path: '/profile',
    element: <ProfileLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Profile /> },
      {
        path: 'collections',
        element: <RequireBrand />,
        children: [
          { path: 'create', element: <CreateCollectionPage /> },
        ],
      },
      { path: 'success', element: <Success /> },
      { path: 'settings', element: <SettingsHome /> },
      { path: 'settings/collections', element: <CollectionsSettings /> },
    ],
  },
  {
    element: <GuestRoute />,
    children: [
      { path: '/signup', element: <SignupPage /> },
      { path: '/login', element: <LoginPage /> },
    ],
  },
]);

const App: React.FC = () => (
  <AuthProvider>
    <ThemeProvider>
      <>
        <Toaster position="top-right" richColors closeButton />
        <RouterProvider router={router} />
      </>
    </ThemeProvider>
  </AuthProvider>
);

export default App;
