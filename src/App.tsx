
import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import Market from './pages/Market';
import Trouble from './pages/Trouble';
import SignupPage from './pages/SignUp';
import Success from './pages/Success';
import LoginPage from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import Profile from './pages/catalog/BrandProfile';
import { ProfileLayout } from './components/catalog(profile)/ProfileLayout';
import CreateCollectionPage from './pages/catalog/CreateCollection';
import RequireBrand from './components/RequireBrand';
import { ToastContainer } from 'react-toastify';
import CollectionView from './pages/catalog/CollectionView';
import DropdownDemo from './pages/ui/DropdownDemo';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <div className="min-h-screen flex items-center justify-center text-2xl">404 - Page Not Found</div>,
    children: [
      { index: true, element: <Market /> },
      { path: 'market', element: <Market /> },
      { path: 'collections/:id', element: <CollectionView /> },
  { path: 'ui/dropdowns', element: <DropdownDemo /> },
      // { path: 'profile', element: <Profile /> },
      { path: 'success', element: <Success /> },
      { path: 'settings', element: <Trouble /> },
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
      { path: 'settings', element: <Trouble /> },
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
    <>
      <ToastContainer position="top-right" theme="colored" newestOnTop toastClassName="text-sm font-medium" closeOnClick pauseOnFocusLoss={false} />
      <RouterProvider router={router} />
    </>
  </AuthProvider>
);

export default App;
