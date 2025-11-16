import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Filter, Bell, User, Tag as TagIcon, Settings, LogOut, ChevronDown, Globe, MapPin, Sun, Moon, Monitor, Heart } from 'lucide-react';
// Button variants available: FrostedButton (primary|ghost|outline) and IconButton
// Sizes: xs|sm|md|lg via btn-tight-* classes
import { FrostedButton } from '@/components/ui/FrostedButton';
import { ImageWithFallback } from '@/components/ImageWithFallback';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useSelector, useDispatch } from 'react-redux';
import { clearUser, setUser } from '../features/userSlice';
import { addLocalNotification, resetUnreadCount } from '../features/notificationsSlice';
import type { RootState } from '../store';
// Notifications bootstrap logic moved to useNotificationsBootstrap hook mounted at app root.
import type { AuthUserDto } from '../types/auth';
import '../styles/scrollbar-hide.css';
import TagChip from '@/components/ui/Tag';
import SearchField from '@/components/SearchField';
import { apiClient, dropStoredAccessToken } from '../api/httpClient';
import { env } from '../config/env';
import getProfileOrHomeUrl from '../lib/navigation';
import { getTagColor } from '../utils/tagColors';
import NotificationsDropdown from '@/components/notifications/NotificationsDropdown';



interface NavbarProps {
  isCollapsed: boolean;
  minimal?: boolean; // profile pages: hide center controls
}

export const Navbar: React.FC<NavbarProps> = ({ isCollapsed: _isCollapsed, minimal = false }) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  // search focus handled inside SearchField
  const [showTags, setShowTags] = useState(false);
  const [, setScrolled] = useState(false); // removed scroll usage
  const profileMenuRef = useRef(null);
  const notificationsAnchorRef = useRef<HTMLElement | null>(null);
  const { theme, setTheme } = useTheme();
  const { setLanguage, translate } = useLanguage();
  const { profile: userProfile, isAuthenticated } = useSelector((state: RootState) => state.user);
  const { unreadCount } = useSelector((state: RootState) => state.notifications);
  const user = isAuthenticated ? userProfile : null;
  const dispatch = useDispatch();

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

  const navTags = [
    'Ankara', 'Luxury', 'Streetwear', 'Spring2025', 'Summer', 'Under50k', 'Dresses', 'Accessories'
  ];

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
              <button className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-3">
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
              <button className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-3">
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
      <rect width="32" height="32" rx="8" fill="url(#threadly-gradient)" />
      <path
        d="M8 20C8 16.5 13 16.5 13 13C13 9.5 8 9.5 8 13"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24 12C24 15.5 19 15.5 19 19C19 22.5 24 22.5 24 19"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="2" fill="white" />
      <defs>
        <linearGradient id="threadly-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="0.5" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#A21CAF" />
        </linearGradient>
      </defs>
    </svg>
  );

  return (
    <nav
      className={`w-full px-4 sm:px-5 py-1.5 z-40 transition-all duration-300 ease-out
      ${_isCollapsed ? 'lg:pl-[64px]' : 'lg:pl-[192px]'}
      ${minimal
        ? 'bg-transparent border-b border-transparent'
        : 'bg-white dark:bg-black border-b border-gray-200 dark:border-white/10'}`}
    >
     
      {/* Main Navbar Content */}
      <div className={`flex items-center min-h-[48px] ${minimal ? 'justify-between lg:justify-end' : 'justify-between'}`}>

        {/* Mobile Logo - Only visible on mobile/tablet */}
        <div className="flex items-center lg:hidden">
          <ThreadlyLogo />
          <span className="ml-2 text-lg font-bold text-gray-900 dark:text-white tracking-tight">
            Threadly
          </span>
        </div>

        {/* Search Section - hidden in minimal mode */}
        {!minimal && (
          <div className="flex-1 flex justify-start mx-2">
            <div className="relative flex items-center w-full min-w-0">
              <SearchField placeholder={translate('searchPlaceholder') || 'Search...'} showFilter={false} className="!flex-none !max-w-none" />
              <button
                type="button"
                className="ml-2 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Filter"
              >
                <Filter className="w-5 h-5 text-primary" />
              </button>
              <button
                type="button"
                className="ml-2 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Toggle tags"
                onClick={() => setShowTags(prev => !prev)}
              >
                <TagIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
              {showTags && (
                <div className="ml-2 flex-1 min-w-0 overflow-hidden max-w-[calc(100%-12rem)] sm:max-w-[calc(100%-16rem)]">
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide whitespace-nowrap py-1">
                    {navTags.map((tag) => {
                      const color = getTagColor(tag);
                      return (
                        <TagChip key={tag} label={`#${tag}`} size="sm" color={color} />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right Side Actions */}
        <div className="flex items-center space-x-3 shrink-0">
          {/* Notifications Dropdown */}
          <div className="relative hidden sm:block">
            <button
              type="button"
              ref={(el) => { (notificationsAnchorRef as any).current = el; }}
              onClick={() => setShowNotifications((p) => !p)}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
            >
              <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <NotificationsDropdown open={showNotifications} onClose={() => setShowNotifications(false)} anchorRef={notificationsAnchorRef as any} />
          </div>

          {/* Auth Buttons - Only when not logged in */}
          {!user && (
            <>
              {/* You can switch to btn-frost-primary/ghost/outline and sizes via btn-tight-*. */}
              <FrostedButton className="btn-frost-outline btn-tight-xs hidden sm:flex flex-none" onClick={() => navigate('/login')}>
                Sign In
              </FrostedButton>
              <FrostedButton className="btn-frost-primary btn-tight-xs hidden md:flex flex-none" onClick={() => navigate('/signup')}>
                Sign Up
              </FrostedButton>
            </>
          )}

          {/* Profile Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setShowProfileMenu((prev) => !prev); }}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:ring-2 hover:ring-primary/20 transition-all duration-200 overflow-hidden"
              aria-label="Profile menu"
            >
              {user ? (
                <ImageWithFallback
                  src={user.profileImage ?? user.profileImageFile?.s3Url ?? null}
                  fileId={user.type === 'BRAND' ? (user.profileImageId ?? user.profileImageFile?.id ?? null) : null}
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




