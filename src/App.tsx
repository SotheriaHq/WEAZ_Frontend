
import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import Market from './pages/Market';
import Trouble from './pages/Trouble';
import SignupPage from './pages/SignUp';
import Success from './pages/Success';
import LoginPage from './pages/Login';
import BrandPublic from './pages/BrandPublic';
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

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <div className="min-h-screen flex items-center justify-center text-2xl">404 - Page Not Found</div>,
    children: [
      { index: true, element: <Market /> },
      { path: 'market', element: <Market /> },
      { path: 'brands/:id', element: <BrandPublic /> },
      { path: 'collections/:id', element: <CollectionView /> },
      { path: 'collections/invite', element: <AcceptInvite /> },
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
          bodyClassName="text-white/95"
          progressClassName="bg-white/70"
        />
        <RouterProvider router={router} />
      </>
    </ThemeProvider>
  </AuthProvider>
);

export default App;
