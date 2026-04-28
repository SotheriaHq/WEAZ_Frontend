import { useLanguage } from '../context/LanguageContext';
import { useSelector, useDispatch } from 'react-redux';
import { clearUser, setUser } from '../features/userSlice';
import { resetUnreadCount } from '../features/notificationsSlice';
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
import { useEffect, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import ImageWithFallback from './ImageWithFallback';
import FrostedButton from './ui/FrostedButton';
import { generateUserUid } from '@/utils/userUid';
import { resolveProfileImageSource } from '@/utils/profileImage';
import BrandWordmark from '@/components/brand/BrandWordmark';
import { COMPANY_NAME } from '@/lib/brand';
import { useStoreSetupStatus } from '@/hooks/useStoreSetupStatus';
import NotificationsDropdown from '@/components/notifications/NotificationsDropdown';
import {
  Dropdown as SharedDropdown,
  DropdownDivider,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@/components/ui/Dropdown';

interface NavbarProps {
  minimal?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ minimal = false }) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const notificationsButtonRef = React.useRef<HTMLButtonElement | null>(null);
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
  const storeSetupComplete = useStoreSetupStatus();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const userUid = user ? generateUserUid(user.id, user.firstName) : null;
  const resolvedIsDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  const themeActionEmoji = resolvedIsDark ? '☀️' : '🌙';
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
    if (!showProfileMenu) {
      setShowLanguageDropdown(false);
    }
  }, [showProfileMenu]);

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
  const showStudioMenuEntry = user?.type === 'BRAND' && storeSetupComplete === true;

  const ProfileMenu = () => {
    if (!user) return null;

    return (
      <SharedDropdown
        open={showProfileMenu}
        onOpenChange={(nextOpen) => {
          setShowProfileMenu(nextOpen);
          if (!nextOpen) {
            setShowLanguageDropdown(false);
          }
        }}
        placement="bottom-end"
        offset={1}
        className="relative"
      >
          <DropdownTrigger
            type="button"
            className="relative flex h-10 w-10 !border-0 !bg-transparent !p-0 items-center justify-center overflow-visible rounded-xl !shadow-none !ring-0 transition-colors hover:!ring-0 focus:!ring-0 focus-visible:!ring-0"
            aria-label="Profile menu"
          >
            <span className="block h-10 w-10 overflow-hidden rounded-xl">
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
            </span>
        </DropdownTrigger>

        <DropdownMenu
          maxHeight="min(80dvh, 30rem)"
          className="w-[min(13.5rem,calc(100vw-1rem))] !border-0 !border-transparent !bg-white !shadow-none !ring-0 outline-none dark:!bg-[#09090b] sm:w-[15.5rem]"
        >
          <div className="flex items-center gap-3 px-3.5 pb-3 pt-3.5">
            <div className="h-12 w-12 overflow-hidden rounded-xl border border-black/5 dark:border-white/10">
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
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0 flex-1 truncate text-base font-semibold text-[color:var(--text-primary)]">
                  {user.firstName} {user.lastName}
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleThemeToggle();
                  }}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                  aria-label={`Switch to ${themeMenuLabel}`}
                  title={`Switch to ${themeMenuLabel}`}
                >
                  <span aria-hidden="true">{themeActionEmoji}</span>
                </button>
              </div>
              <div className="mt-0.5 break-words text-[11px] leading-4 text-[color:var(--text-secondary)]">
                {user.email}
                {userUid ? ` · UID ${userUid}` : ''}
              </div>
            </div>
          </div>

          <DropdownDivider />

          {showStudioMenuEntry ? (
            <DropdownItem
              leftIcon="🧵"
              onClick={() => {
                navigate('/studio');
                setShowProfileMenu(false);
              }}
            >
              Studio
            </DropdownItem>
          ) : null}

          <DropdownItem
            leftIcon="👤"
            onClick={() => {
              navigate(profileHomeRoute);
              setShowProfileMenu(false);
            }}
          >
            {translate('profile')}
          </DropdownItem>

          <DropdownItem
            leftIcon="⚙️"
            onClick={() => {
              navigate('/settings');
              setShowProfileMenu(false);
            }}
          >
            Settings
          </DropdownItem>


          <DropdownItem
            leftIcon="🌍"
            rightIcon={<span aria-hidden="true" className={`transition-transform duration-200 ${showLanguageDropdown ? 'rotate-180' : ''}`}>⌄</span>}
            onClick={() => {
              setShowLanguageDropdown((prev) => !prev);
            }}
          >
            {translate('language')}
          </DropdownItem>

          {showLanguageDropdown ? (
            <div className="space-y-1 px-1 pt-1">
              <button onClick={() => { setLanguage('en'); setShowProfileMenu(false); }} className="w-full rounded-xl px-4 py-2 text-left text-sm text-[color:var(--text-primary)] transition-colors hover:bg-black/5 dark:hover:bg-white/10">English</button>
              <button onClick={() => { setLanguage('zh'); setShowProfileMenu(false); }} className="w-full rounded-xl px-4 py-2 text-left text-sm text-[color:var(--text-primary)] transition-colors hover:bg-black/5 dark:hover:bg-white/10">Chinese</button>
              <button onClick={() => { setLanguage('ar'); setShowProfileMenu(false); }} className="w-full rounded-xl px-4 py-2 text-left text-sm text-[color:var(--text-primary)] transition-colors hover:bg-black/5 dark:hover:bg-white/10">Arabic</button>
              <button onClick={() => { setLanguage('hi'); setShowProfileMenu(false); }} className="w-full rounded-xl px-4 py-2 text-left text-sm text-[color:var(--text-primary)] transition-colors hover:bg-black/5 dark:hover:bg-white/10">Hindi</button>
            </div>
          ) : null}

          <DropdownItem
            leftIcon="📍"
            onClick={() => {
              handleLocationShare();
              setShowProfileMenu(false);
            }}
          >
            {translate('location')}
          </DropdownItem>

          <DropdownItem
            leftIcon="🆘"
            onClick={() => {
              navigate(helpRoute);
              setShowProfileMenu(false);
            }}
          >
            Help
          </DropdownItem>

          <DropdownDivider />

          <DropdownItem
            leftIcon="📦"
            onClick={() => {
              navigate(ordersRoute);
              setShowProfileMenu(false);
            }}
          >
            My Orders
          </DropdownItem>

          <DropdownItem
            leftIcon="🤍"
            onClick={() => {
              navigate(savedRoute);
              setShowProfileMenu(false);
            }}
          >
            Saved
          </DropdownItem>

          <DropdownDivider />

          <DropdownItem
            leftIcon="↩️"
            tone="danger"
            onClick={async () => {
              try {
                await apiClient.post('/auth/logout');
              } catch (error) {
                void error;
              }
              dropStoredAccessToken();
              localStorage.removeItem(env.userStorageKey);
              dispatch(clearUser());
              dispatch(resetCartState());
              dispatch(resetWishlistState());
              dispatch(resetUnreadCount());
              setShowProfileMenu(false);
              navigate('/', { replace: true });
            }}
          >
            {translate('signOut')}
          </DropdownItem>
        </DropdownMenu>
      </SharedDropdown>
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
              <span aria-hidden="true" className="text-xl">🤍</span>
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
            <span aria-hidden="true" className="text-xl">🛍️</span>
            {cartQuantity > 0 ? (
              <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-purple-600 px-1 text-xs font-bold text-white">
                {cartQuantity > 99 ? '99+' : cartQuantity}
              </span>
            ) : null}
          </button>

          {user ? (
            <div className="relative">
              <button
                ref={notificationsButtonRef}
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowLanguageDropdown(false);
                  setShowNotificationsDropdown((value) => !value);
                }}
                className="relative hidden rounded-full p-2 text-xl transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 sm:flex"
                aria-label="Notifications"
                aria-expanded={showNotificationsDropdown}
              >
                <span aria-hidden="true" className="text-xl">🔔</span>
                {unreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                ) : null}
              </button>
              <NotificationsDropdown
                open={showNotificationsDropdown}
                onClose={() => setShowNotificationsDropdown(false)}
                anchorRef={notificationsButtonRef}
              />
            </div>
          ) : null}

          {!user ? (
            <FrostedButton className="btn-frost-outline btn-tight-xs hidden flex-none sm:flex" onClick={() => navigate('/login')}>
              Sign In
            </FrostedButton>
          ) : null}

          {user ? <ProfileMenu /> : null}
        </div>
      </div>
    </nav>
  );
};
