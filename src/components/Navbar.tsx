import { useLanguage } from '../context/LanguageContext';
import { useSelector, useDispatch } from 'react-redux';
import { clearUser, setUser } from '../features/userSlice';
import { addLocalNotification, resetUnreadCount } from '../features/notificationsSlice';
import { toggleSidebar } from '../features/uiSlice';
import {
  openCartDrawer,
  closeCartDrawer,
  selectCartTotalQuantity,
  selectCartIsDrawerOpen,
  fetchCart,
} from '../features/cartSlice';
import {
  openWishlistDrawer,
  closeWishlistDrawer,
  fetchWishlist,
  selectWishlistTotal,
  selectWishlistIsDrawerOpen,
} from '../features/wishlistSlice';
import type { RootState, AppDispatch } from '../store';
// Notifications bootstrap logic moved to useNotificationsBootstrap hook mounted at app root.
import type { AuthUserDto } from '../types/auth';
import '../styles/scrollbar-hide.css';
import SearchField from '@/components/SearchField';
import { apiClient, dropStoredAccessToken } from '../api/httpClient';
import { env } from '../config/env';
import getProfileOrHomeUrl from '../lib/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import React from 'react';
import { User, Settings, TagIcon, Sun, ChevronDown, Moon, Monitor, Globe, MapPin, LogOut, Menu, SearchIcon, Filter, LayoutDashboard, Heart } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import ImageWithFallback from './ImageWithFallback';
import FrostedButton from './ui/FrostedButton';
import NotificationsDropdown from '@/components/notifications/NotificationsDropdown';



interface NavbarProps {
  minimal?: boolean; // profile pages: hide center controls
}

export const Navbar: React.FC<NavbarProps> = ({ minimal = false }) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  // search focus handled inside SearchField
  // search focus handled inside SearchField
  const [, setScrolled] = useState(false); // removed scroll usage
  const profileMenuRef = useRef(null);
  const notificationsAnchorRef = useRef<HTMLElement | null>(null);
  const { theme, setTheme } = useTheme();
  const { setLanguage, translate } = useLanguage();
  const { profile: userProfile, isAuthenticated } = useSelector((state: RootState) => state.user);
  const { unreadCount } = useSelector((state: RootState) => state.notifications);
  const cartQuantity = useSelector(selectCartTotalQuantity);
  const isCartOpen = useSelector(selectCartIsDrawerOpen);
  const wishlistTotal = useSelector(selectWishlistTotal);
  const isWishlistOpen = useSelector(selectWishlistIsDrawerOpen);
  const user = isAuthenticated ? userProfile : null;
  const dispatch = useDispatch<AppDispatch>();

  // Fetch cart and wishlist on mount if authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchCart());
      dispatch(fetchWishlist({}));
    }
  }, [isAuthenticated, dispatch]);

  // Hydrate Redux user state from localStorage if missing
  React.useEffect(() => {
    if (!user && typeof window !== 'undefined') {
      const persisted = localStorage.getItem(env.userStorageKey);
      if (persisted) {
        try {
          const parsed = JSON.parse(persisted) as AuthUserDto;
          if (parsed && parsed.id) {
            dispatch(setUser(parsed));
          }
        } catch (e) { void e; }
      }
    }
  }, [user, dispatch]);

  const navigate = useNavigate();
  const location = useLocation();



  // Location sharing handler
  const handleLocationShare = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          void position;
          // location obtained but not persisted in this component
        },
        (error) => {
          void error;
        }
      );
    }
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        event.target instanceof HTMLElement &&
        !(profileMenuRef.current as HTMLDivElement).contains(event.target)
      ) {
        setShowProfileMenu(false);
        setShowThemeDropdown(false);
        setShowLanguageDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Remove scroll transparency behavior; always solid background
  useEffect(() => { setScrolled(false); }, [location.pathname, theme]);

  // Track scroll position for liquid glass effect
  const [isScrolled, setIsScrolled] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial state
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Removed local fetch + realtime subscription; handled globally via useNotificationsBootstrap.

  // Profile Menu Component
  const ProfileMenu = () => {
    if (!showProfileMenu) return null;

    return (
      <div
        ref={profileMenuRef}
        className="absolute right-0 mt-2 w-64 max-h-[calc(100vh-80px)] overflow-y-auto scrollbar-hide glass-panel bg-white/95 dark:bg-gray-950 backdrop-blur-xl rounded-lg shadow-xl border border-white/30 dark:border-white/10 py-2 z-50"
        style={{ WebkitOverflowScrolling: 'touch', height: 'auto', minHeight: '400px' }}
      >
        {/* Gradient Background Overlay - Same as Market Header */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-purple-400/10 to-transparent opacity-50 blur-2xl pointer-events-none" />
        
        <div className="relative z-10">
          {isAuthenticated && user ? (
          <>
            {/* User Info */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <ImageWithFallback
                  src={user.profileImage ?? null}
                  alt={`${user.firstName} ${user.lastName}`}
                  fallbackName={`${user.firstName || ''} ${user.lastName || ''}`}
                  className="w-10 h-10"
                  containerClassName="w-10 h-10"
                  rounded="full"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{user.firstName} {user.lastName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                </div>
              </div>
            </div>

            {/* Main Links */}
            <div className="py-2">
              {user.type === 'BRAND' && (
                <button
                  onClick={() => { navigate('/studio'); setShowProfileMenu(false); }}
                  className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-3"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </button>
              )}
              <button
                onClick={() => {
                  if (user) {
                    navigate(getProfileOrHomeUrl(user));
                    setShowProfileMenu(false);
                  } else {
                    navigate('/login');
                  }
                }}
                className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-3"
              >
                <User className="w-4 h-4" />
                <span>{translate('profile')}</span>
              </button>
              <button
                onClick={() => { navigate('/settings'); setShowProfileMenu(false); }}
                className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-3"
              >
                <Settings className="w-4 h-4" />
                <span>{translate('settings')}</span>
              </button>
            </div>

            {/* User Actions */}
            <div className="py-2 border-t border-gray-200 dark:border-gray-700">
              <button className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-3">
                <TagIcon className="w-4 h-4" />
                <span>My Orders</span>
              </button>
              <button className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-3">
                <Heart className="w-4 h-4" />
                <span>Saved</span>
              </button>
            </div>

            {/* Theme & Language */}
            <div className="py-2 border-t border-gray-200 dark:border-gray-700">
              <div className="relative">
                <button
                  onClick={() => setShowThemeDropdown(!showThemeDropdown)}
                  className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <Sun className="w-4 h-4" />
                    <span>{translate('theme')}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showThemeDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showThemeDropdown && (
                  <div className="pl-8 space-y-1 py-1">
                    <button onClick={() => setTheme('light')} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2">
                      <Sun className="w-4 h-4" />
                      <span>Light</span>
                    </button>
                    <button onClick={() => setTheme('dark')} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2">
                      <Moon className="w-4 h-4" />
                      <span>Dark</span>
                    </button>
                    <button onClick={() => setTheme('system')} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2">
                      <Monitor className="w-4 h-4" />
                      <span>System</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                  className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <Globe className="w-4 h-4" />
                    <span>{translate('language')}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showLanguageDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showLanguageDropdown && (
                  <div className="pl-8 space-y-1 py-1">
                    <button onClick={() => setLanguage('en')} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">English</button>
                    <button onClick={() => setLanguage('zh')} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">中文</button>
                    <button onClick={() => setLanguage('ar')} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">العربية</button>
                    <button onClick={() => setLanguage('hi')} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">हिन्दी</button>
                  </div>
                )}
              </div>

              <button onClick={handleLocationShare} className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-3">
                <MapPin className="w-4 h-4" />
                <span>{translate('location')}</span>
              </button>
            </div>

            {/* Help & Sign Out */}
            <div className="py-2 border-t border-gray-200 dark:border-gray-700">
              <button className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-3">
                <TagIcon className="w-4 h-4" />
                <span>Help</span>
              </button>
              <button
                onClick={async () => {
                  try {
                    await apiClient.post('/auth/logout');
                  } catch (e) { void e; }
                  // Announce logout before clearing user
                  dispatch(addLocalNotification({ message: 'Signed out successfully.' }));
                  localStorage.removeItem(env.tokenStorageKey);
                  localStorage.removeItem('access_token');
                  localStorage.removeItem('accessToken');
                  dropStoredAccessToken();
                  localStorage.removeItem(env.userStorageKey);
                  dispatch(clearUser());
                  dispatch(resetUnreadCount());
                  setShowProfileMenu(false);
                  navigate('/', { replace: true });
                }}
                className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-3"
              >
                <LogOut className="w-4 h-4" />
                <span>{translate('signOut')}</span>
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Not authenticated menu */}
            <div className="py-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => { navigate('/settings'); setShowProfileMenu(false); }}
                className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-3"
              >
                <Settings className="w-4 h-4" />
                <span>{translate('settings')}</span>
              </button>
            </div>

            <div className="py-2 border-t border-gray-200 dark:border-gray-700">
              <div className="relative">
                <button
                  onClick={() => setShowThemeDropdown(!showThemeDropdown)}
                  className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <Sun className="w-4 h-4" />
                    <span>{translate('theme')}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showThemeDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showThemeDropdown && (
                  <div className="pl-8 space-y-1 py-1">
                    <button onClick={() => setTheme('light')} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2">
                      <Sun className="w-4 h-4" />
                      <span>Light</span>
                    </button>
                    <button onClick={() => setTheme('dark')} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2">
                      <Moon className="w-4 h-4" />
                      <span>Dark</span>
                    </button>
                    <button onClick={() => setTheme('system')} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2">
                      <Monitor className="w-4 h-4" />
                      <span>System</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                  className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <Globe className="w-4 h-4" />
                    <span>{translate('language')}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showLanguageDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showLanguageDropdown && (
                  <div className="pl-8 space-y-1 py-1">
                    <button onClick={() => setLanguage('en')} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">English</button>
                    <button onClick={() => setLanguage('zh')} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">中文</button>
                    <button onClick={() => setLanguage('ar')} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">العربية</button>
                    <button onClick={() => setLanguage('hi')} className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">हिन्दी</button>
                  </div>
                )}
              </div>

              <button className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-3">
                <TagIcon className="w-4 h-4" />
                <span>Help</span>
              </button>
            </div>
          </>
        )}
        </div>
      </div>
    );
  };

  // Threadly Logo SVG Component
  const ThreadlyLogo = () => (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="threadly-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--brand-primary)" />
          <stop offset="0.5" stopColor="var(--brand-accent)" />
          <stop offset="1" stopColor="var(--brand-primary-strong)" />
        </linearGradient>
      </defs>
      <path
        d="M8 20C8 16.5 13 16.5 13 13C13 9.5 8 9.5 8 13"
        stroke="url(#threadly-gradient)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24 12C24 15.5 19 15.5 19 19C19 22.5 24 22.5 24 19"
        stroke="url(#threadly-gradient)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="2.5" fill="url(#threadly-gradient)" />
    </svg>
  );

  return (
    <nav
      className={`fixed top-0 left-0 w-full px-4 sm:px-5 h-16 z-50 transition-all duration-300 ease-out
      ${minimal
        ? 'bg-transparent border-b border-transparent'
        : isScrolled
          ? 'bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-white/10 shadow-sm'
          : 'bg-white dark:bg-black border-b border-gray-200 dark:border-white/10'}`}
      style={isScrolled && !minimal ? {
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      } : undefined}
    >
     
      {/* Main Navbar Content */}
      <div className={`flex items-center h-full justify-between gap-4`}>

        {/* Left Section: Hamburger + Logo */}
        <div className="flex items-center shrink-0 min-w-[180px]">
          {/* Hamburger - Visible on both Mobile and Desktop (unless minimal) */}
          {!minimal && (
            <button
              type="button"
              onClick={() => dispatch(toggleSidebar())}
              className="inline-flex items-center justify-center p-2 mr-1 sm:mr-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle sidebar"
            >
              <span className="text-xl">🍔</span>
            </button>
          )}

          {/* Brand: Logo + Name */}
          <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
            <ThreadlyLogo />
            <span className="ml-2 text-lg font-bold text-gray-900 dark:text-white tracking-tight max-w-[200px] truncate" title="Threadly">
              Threadly
            </span>
          </div>
        </div>

        {/* Center Section: Search - Hidden in minimal mode, centered on desktop */}
        {!minimal && (
          <div className="hidden sm:flex flex-1 justify-center px-6">
            <div className="flex items-center w-full gap-2">
              <SearchField 
                placeholder={translate('searchPlaceholder') || 'Search designs, brands...'} 
                showFilter={true} 
                className="!flex-1" 
              />
            </div>
          </div>
        )}

        {/* Right Section: Actions */}
        <div className="flex items-center justify-end shrink-0 min-w-[100px] space-x-2 sm:space-x-3">
          {/* Mobile Search Icon (visible only on mobile when search is hidden) */}
          {!minimal && (
            <button className="sm:hidden p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
               <SearchIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          )}

          {/* Wishlist */}
          {user && (
            <button
              type="button"
              onClick={() => dispatch(isWishlistOpen ? closeWishlistDrawer() : openWishlistDrawer())}
              className="hidden sm:flex p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative text-xl"
              aria-label="Wishlist"
            >
              <span role="img" aria-hidden="true" className="filter invert dark:invert-0 transition-all duration-300">🤍</span>
              {wishlistTotal > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white px-1">
                  {wishlistTotal > 99 ? '99+' : wishlistTotal}
                </span>
              )}
            </button>
          )}

          {/* Cart */}
          <button
            type="button"
            onClick={() => dispatch(isCartOpen ? closeCartDrawer() : openCartDrawer())}
            className="hidden sm:flex p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative text-xl"
            aria-label="Cart"
          >
            <span role="img" aria-hidden="true">🛒</span>
            {cartQuantity > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-purple-600 rounded-full flex items-center justify-center text-xs font-bold text-white px-1">
                {cartQuantity > 99 ? '99+' : cartQuantity}
              </span>
            )}
          </button>

          {/* Notifications */}
          {user && (
            <div className="relative hidden sm:block">
              <button
                type="button"
                ref={(el) => { (notificationsAnchorRef as any).current = el; }}
                onClick={() => setShowNotifications((p) => !p)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
              >
                <span className="text-xl">🔔</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              <NotificationsDropdown open={showNotifications} onClose={() => setShowNotifications(false)} anchorRef={notificationsAnchorRef as any} />
            </div>
          )}

          {/* Auth Buttons */}
          {!user && (
            <FrostedButton className="btn-frost-outline btn-tight-xs hidden sm:flex flex-none" onClick={() => navigate('/login')}>
              Sign In
            </FrostedButton>
          )}

          {/* Profile Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setShowProfileMenu((prev) => !prev); }}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:ring-2 hover:ring-primary/20 transition-all duration-200 overflow-hidden"
              aria-label="Profile menu"
            >
              {user ? (
                <ImageWithFallback
                  src={user.profileImage ?? user.profileImageFile?.s3Url ?? null}
                  fileId={user.profileImageId ?? user.profileImageFile?.id ?? null}
                  alt={`${user.firstName} ${user.lastName}`}
                  fallbackName={`${user.firstName || ''} ${user.lastName || ''}`}
                  className="w-full h-full object-cover"
                  containerClassName="w-full h-full"
                  rounded="full"
                />
              ) : (
                <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
              )}
            </button>
            <ProfileMenu />
          </div>
        </div>
      </div>

      {/* Hashtags Row removed to reduce navbar height */}
    </nav>
  );
};




