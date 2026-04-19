import { useLanguage } from '../context/LanguageContext';
import { useSelector, useDispatch } from 'react-redux';
import { clearUser, setUser } from '../features/userSlice';
import { addLocalNotification, resetUnreadCount } from '../features/notificationsSlice';
import { closeSidebar, toggleSidebar } from '../features/uiSlice';
import {
  openCartDrawer,
  closeCartDrawer,
  selectCartCombinedQuantity,
  selectCartIsDrawerOpen,
  fetchCart,
  fetchCustomBagCount,
  resetCartState,
} from '../features/cartSlice';
import {
  openWishlistDrawer,
  closeWishlistDrawer,
  fetchWishlist,
  selectWishlistTotal,
  selectWishlistIsDrawerOpen,
  resetWishlistState,
} from '../features/wishlistSlice';
import type { RootState, AppDispatch } from '../store';
import type { AuthUserDto } from '../types/auth';
import '../styles/scrollbar-hide.css';
import SearchBarWithSuggestions from '@/components/search/SearchBarWithSuggestions';
import { apiClient, dropStoredAccessToken } from '../api/httpClient';
import { env } from '../config/env';
import getProfileOrHomeUrl from '../lib/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import ImageWithFallback from './ImageWithFallback';
import FrostedButton from './ui/FrostedButton';
import NotificationsDropdown from '@/components/notifications/NotificationsDropdown';
import { generateUserUid } from '@/utils/userUid';
import { resolveProfileImageSource } from '@/utils/profileImage';
import BrandWordmark from '@/components/brand/BrandWordmark';
import { COMPANY_NAME } from '@/lib/brand';

interface NavbarProps {
  minimal?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ minimal = false }) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationsAnchorRef = useRef<HTMLElement | null>(null);
  const { theme, setTheme } = useTheme();
  const { setLanguage, translate } = useLanguage();
  const { profile: userProfile, isAuthenticated } = useSelector((state: RootState) => state.user);
  const isSidebarOpen = useSelector((state: RootState) => state.ui.isSidebarOpen);
  const { unreadCount } = useSelector((state: RootState) => state.notifications);
  const cartQuantity = useSelector(selectCartCombinedQuantity);
  const isCartOpen = useSelector(selectCartIsDrawerOpen);
  const wishlistTotal = useSelector(selectWishlistTotal);
  const isWishlistOpen = useSelector(selectWishlistIsDrawerOpen);
  const user = isAuthenticated ? userProfile : null;
  const userAvatar = React.useMemo(
    () => resolveProfileImageSource(user),
    [user],
  );
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const userUid = user ? generateUserUid(user.id, user.firstName) : null;
  const resolvedIsDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  const themeActionEmoji = resolvedIsDark ? '🌞' : '🌙';
  const themeMenuLabel = resolvedIsDark ? 'Light theme' : 'Dark theme';

  React.useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchCart());
      dispatch(fetchCustomBagCount());
      dispatch(fetchWishlist({ page: 1, limit: 200 }));
    }
  }, [dispatch, isAuthenticated]);

  React.useEffect(() => {
    if (!user && typeof window !== 'undefined') {
      const persisted = localStorage.getItem(env.userStorageKey);
      if (persisted) {
        try {
          const parsed = JSON.parse(persisted) as AuthUserDto;
          if (parsed?.id) dispatch(setUser(parsed));
        } catch (error) {
          void error;
        }
      }
    }
  }, [dispatch, user]);

  useEffect(() => {
    if (!user) {
      setShowProfileMenu(false);
      setShowLanguageDropdown(false);
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        event.target instanceof HTMLElement &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setShowProfileMenu(false);
        setShowLanguageDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleThemeToggle = () => {
    setTheme(resolvedIsDark ? 'light' : 'dark');
  };

  const handleLocationShare = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => void position,
      (error) => void error,
    );
  };
  const profileHomeRoute = user ? getProfileOrHomeUrl(user) : '/profile';
  const ordersRoute = user?.type === 'BRAND' ? '/studio?tab=orders' : '/profile?tab=orders';
  const savedRoute = user?.type === 'BRAND' ? '/profile?tab=Content' : profileHomeRoute;
  const helpRoute = '/help/verified-badge';

  const MenuButton = ({
    icon,
    label,
    onClick,
    danger = false,
  }: {
    icon: string;
    label: string;
    onClick?: () => void | Promise<void>;
    danger?: boolean;
  }) => (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2 text-left transition ${
        danger
          ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
      }`}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </button>
  );

  const ProfileMenu = () => {
    if (!showProfileMenu) return null;

    return (
      <div
        ref={profileMenuRef}
        className="threadly-chrome-surface absolute right-0 mt-2 z-50 max-h-[calc(100vh-80px)] w-64 overflow-y-auto rounded-lg py-2 scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch', minHeight: '320px' }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.14),_transparent_42%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.12),_transparent_38%)] opacity-90" />
        <div className="relative z-10">
          {user ? (
            <>
              <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                <div className="flex items-start gap-3">
                  <ImageWithFallback
                    src={userAvatar.src}
                    fileId={userAvatar.fileId}
                    alt={`${user.firstName} ${user.lastName}`}
                    fallbackName={`${user.firstName || ''} ${user.lastName || ''}`}
                    fit="cover"
                    className="h-10 w-10"
                    containerClassName="h-10 w-10"
                    rounded="xl"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="break-words text-sm font-medium text-gray-600 dark:text-gray-300">{user.email}</p>
                    <p className="mt-0.5 text-[11px] font-semibold tracking-wide text-gray-700 dark:text-gray-200">UID: {userUid}</p>
                  </div>
                </div>
              </div>

              <div className="py-2">
                {user.type === 'BRAND' ? (
                  <MenuButton icon="🧵" label="Dashboard" onClick={() => { navigate('/studio'); setShowProfileMenu(false); }} />
                ) : null}
                <MenuButton icon="👤" label={translate('profile')} onClick={() => { navigate(profileHomeRoute); setShowProfileMenu(false); }} />
                <MenuButton icon={themeActionEmoji} label={themeMenuLabel} onClick={handleThemeToggle} />
                <MenuButton icon="⚙️" label={translate('settings')} onClick={() => { navigate('/settings'); setShowProfileMenu(false); }} />
              </div>

              <div className="border-t border-gray-200 py-2 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowNotifications(false);
                    setShowLanguageDropdown((prev) => !prev);
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-gray-700 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true">🌍</span>
                    <span>{translate('language')}</span>
                  </div>
                  <span aria-hidden="true" className={`transition-transform duration-200 ${showLanguageDropdown ? 'rotate-180' : ''}`}>⌄</span>
                </button>
                {showLanguageDropdown ? (
                  <div className="space-y-1 py-1 pl-8">
                    <button onClick={() => setLanguage('en')} className="w-full px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">English</button>
                    <button onClick={() => setLanguage('zh')} className="w-full px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">中文</button>
                    <button onClick={() => setLanguage('ar')} className="w-full px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">العربية</button>
                    <button onClick={() => setLanguage('hi')} className="w-full px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">हिन्दी</button>
                  </div>
                ) : null}
                <MenuButton icon="📍" label={translate('location')} onClick={handleLocationShare} />
                <MenuButton icon="🆘" label="Help" onClick={() => { navigate(helpRoute); setShowProfileMenu(false); }} />
              </div>

              <div className="border-t border-gray-200 py-2 dark:border-gray-700">
                <MenuButton icon="📦" label="My Orders" onClick={() => { navigate(ordersRoute); setShowProfileMenu(false); }} />
                <MenuButton icon="🤍" label="Saved" onClick={() => { navigate(savedRoute); setShowProfileMenu(false); }} />
              </div>

              <div className="border-t border-gray-200 py-2 dark:border-gray-700">
                <MenuButton
                  icon="↩️"
                  label={translate('signOut')}
                  danger
                  onClick={async () => {
                    try {
                      await apiClient.post('/auth/logout');
                    } catch (error) {
                      void error;
                    }
                    dispatch(addLocalNotification({ message: 'Signed out successfully.' }));
                    dropStoredAccessToken();
                    localStorage.removeItem(env.userStorageKey);
                    dispatch(clearUser());
                    dispatch(resetCartState());
                    dispatch(resetWishlistState());
                    dispatch(resetUnreadCount());
                    setShowProfileMenu(false);
                    navigate('/', { replace: true });
                  }}
                />
              </div>
            </>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <nav
      className={`fixed top-0 left-0 z-layer-nav h-16 w-full px-4 transition-all duration-500 ease-out sm:px-5 ${
        minimal
          ? 'border-b border-transparent bg-transparent'
          : isScrolled
            ? 'threadly-nav-surface-muted'
            : 'threadly-nav-surface'
      }`}
      style={
        isScrolled && !minimal
          ? {
              backdropFilter: 'blur(18px) saturate(140%)',
              WebkitBackdropFilter: 'blur(18px) saturate(140%)',
            }
          : undefined
      }
    >
      <div className="flex h-full items-center justify-between gap-4">
        <div className="flex shrink-0 items-center">
          {!minimal ? (
            <button
              type="button"
              onClick={() => dispatch(toggleSidebar())}
              className="mr-1 inline-flex items-center justify-center rounded-full p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Toggle sidebar"
            >
              <span className="text-xl">🍔</span>
            </button>
          ) : null}

          {!isSidebarOpen && (
            <div
              className="flex cursor-pointer items-center"
              onClick={() => {
                dispatch(closeSidebar());
                navigate('/');
              }}
            >
              <BrandWordmark
                logoSize={32}
                textClassName="max-w-[200px] truncate text-lg font-bold tracking-tight text-gray-900 dark:text-white"
              />
              <span className="sr-only">{COMPANY_NAME}</span>
            </div>
          )}
        </div>

        {!minimal ? (
          <div className="hidden flex-1 justify-center px-6 sm:flex">
            <div className="flex w-full items-center gap-2">
              <SearchBarWithSuggestions
                placeholder={translate('searchPlaceholder') || 'Search products, brands, styles...'}
                className="!flex-1"
              />
            </div>
          </div>
        ) : null}

        <div className="flex min-w-[100px] shrink-0 items-center justify-end space-x-2 sm:space-x-3">
          {!minimal ? (
            <button
              type="button"
              className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 sm:hidden"
              aria-label="Open search"
              onClick={() => navigate('/search')}
            >
              <span aria-hidden="true" className="text-lg text-gray-700 dark:text-gray-200">🔎</span>
            </button>
          ) : null}

          {user ? (
            <button
              type="button"
              onClick={() => dispatch(isWishlistOpen ? closeWishlistDrawer() : openWishlistDrawer())}
              className="relative hidden rounded-full p-2 text-xl transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 sm:flex"
              aria-label="Wishlist"
            >
              <span role="img" aria-hidden="true" className="filter invert transition-all duration-300 dark:invert-0">🤍</span>
              {wishlistTotal > 0 ? (
                <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                  {wishlistTotal > 99 ? '99+' : wishlistTotal}
                </span>
              ) : null}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => dispatch(isCartOpen ? closeCartDrawer() : openCartDrawer())}
            className="relative hidden rounded-full p-2 text-xl transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 sm:flex"
            aria-label="Bag"
          >
            <span role="img" aria-hidden="true">🛍️</span>
            {cartQuantity > 0 ? (
              <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-purple-600 px-1 text-xs font-bold text-white">
                {cartQuantity > 99 ? '99+' : cartQuantity}
              </span>
            ) : null}
          </button>

          {user ? (
            <div className="relative">
              <button
                type="button"
                ref={(element) => {
                  notificationsAnchorRef.current = element;
                }}
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowLanguageDropdown(false);
                  setShowNotifications((prev) => !prev);
                }}
                className="relative rounded-full p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-haspopup="dialog"
                aria-expanded={showNotifications}
              >
                <span aria-hidden="true" className="text-lg">🔔</span>
                {unreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                ) : null}
              </button>
              <NotificationsDropdown open={showNotifications} onClose={() => setShowNotifications(false)} anchorRef={notificationsAnchorRef as any} />
            </div>
          ) : null}

          {!user ? (
            <FrostedButton className="btn-frost-outline btn-tight-xs hidden flex-none sm:flex" onClick={() => navigate('/login')}>
              Sign In
            </FrostedButton>
          ) : null}

          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  setShowNotifications(false);
                  setShowLanguageDropdown(false);
                  setShowProfileMenu((prev) => !prev);
                }}
                className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl transition-all duration-200 hover:ring-2 hover:ring-primary/20"
                aria-label="Profile menu"
              >
                <ImageWithFallback
                  src={userAvatar.src}
                  fileId={userAvatar.fileId}
                  alt={`${user.firstName} ${user.lastName}`}
                  fallbackName={`${user.firstName || ''} ${user.lastName || ''}`}
                  fit="cover"
                  className="h-full w-full object-cover"
                  containerClassName="h-full w-full"
                  rounded="xl"
                />
              </button>
              <ProfileMenu />
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
};
