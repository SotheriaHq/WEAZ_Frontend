
import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import Market from './pages/Market';
import SettingsHome from './pages/settings/SettingsHome';
import CollectionsSettings from './pages/settings/CollectionsSettings';
import SignupPage from './pages/SignUp';
import Success from './pages/Success';
import LoginPage from './pages/Login';
// Removed separate BrandPublic visitor page; unified profile view handles both owner & visitor modes
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Profile from './pages/catalog/BrandProfile';
import { ProfileLayout } from './components/catalog(profile)/ProfileLayout';
import CreateCollectionPage from './pages/catalog/CreateCollection';
import RequireBrand from './components/RequireBrand';
import { ToastContainer, Slide } from 'react-toastify';
import CollectionView from './pages/catalog/CollectionView';
import DropdownDemo from './pages/ui/DropdownDemo';
import AcceptInvite from './pages/AcceptInvite';
import EditCollection from './pages/catalog/EditCollection';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <div className="min-h-screen flex items-center justify-center text-2xl">404 - Page Not Found</div>,
    children: [
      { index: true, element: <Market /> },
      { path: 'market', element: <Market /> },
  // Route brand profile (visitor or owner) to unified Profile component
  { path: 'brands/:id', element: <Profile /> },
      { path: 'collections/:id', element: <CollectionView /> },
  { path: 'collections/:id/edit', element: <EditCollection /> },
      { path: 'collections/invite', element: <AcceptInvite /> },
  { path: 'ui/dropdowns', element: <DropdownDemo /> },
      // { path: 'profile', element: <Profile /> },
      { path: 'success', element: <Success /> },
      { path: 'settings', element: <SettingsHome /> },
      { path: 'settings/collections', element: <CollectionsSettings /> },
    ],
  },
  {
    path: '/profile',
    element: <ProfileLayout />,
    errorElement: <div className="min-h-screen flex items-center justify-center text-2xl">404 - Page Not Found</div>,
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
    element: <ProtectedRoute />,
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
        <ToastContainer
          position="top-right"
          newestOnTop
          closeOnClick
          pauseOnFocusLoss={false}
          autoClose={6500}
          transition={Slide}
          toastClassName="text-sm font-medium bg-gradient-to-br from-purple-600/80 via-fuchsia-600/75 to-indigo-600/80 text-white backdrop-blur-md border border-white/20 shadow-xl rounded-xl"
        />
        <RouterProvider router={router} />
      </>
    </ThemeProvider>
  </AuthProvider>
);

export default App;
