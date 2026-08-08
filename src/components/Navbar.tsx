import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useSelector, useDispatch } from 'react-redux';
import { closeSidebar, toggleSidebar } from '../features/uiSlice';
import {
  openCartDrawer,
  closeCartDrawer,
  selectCartCombinedQuantity,
  selectCartIsDrawerOpen,
  fetchCart,
  fetchCustomBagCount,
} from '../features/cartSlice';
import {
  openWishlistDrawer,
  closeWishlistDrawer,
  fetchWishlist,
  selectWishlistTotal,
  selectWishlistIsDrawerOpen,
} from '../features/wishlistSlice';
import type { RootState, AppDispatch } from '../store';
import '../styles/scrollbar-hide.css';
import SearchBarWithSuggestions from '@/components/search/SearchBarWithSuggestions';
import getProfileOrHomeUrl from '../lib/navigation';
import { useEffect, useState } from 'react';
import { useSyncedThemePreference } from '@/hooks/useSyncedThemePreference';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import ImageWithFallback from './ImageWithFallback';
import FrostedButton from './ui/FrostedButton';
import { generateUserUid } from '@/utils/userUid';
import { resolveProfileImageSource } from '@/utils/profileImage';
import BrandWordmark from '@/components/brand/BrandWordmark';
import { COMPANY_NAME } from '@/lib/brand';
import { hasActiveBrandMembership, resolveAccountDisplayName } from '@/lib/brandAccess';
import { useStoreSetupStatus } from '@/hooks/useStoreSetupStatus';
import NotificationsDropdown from '@/components/notifications/NotificationsDropdown';
import { MY_BAG_EMOJI, MY_BAG_LABEL } from '@/constants/bagging';
import {
  Dropdown as SharedDropdown,
  DropdownDivider,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@/components/ui/Dropdown';

interface NavbarProps {
  minimal?: boolean;
  /**
   * Float the bar over a full-bleed dark stage instead of sitting on its own
   * surface — the mobile Runway reels.
   *
   * The reels stage used to start at `top-16` so the solid bar could own the
   * first 64px of the screen. That is a band of chrome above the photo on a
   * surface whose entire point is edge-to-edge media, and it read as the navbar
   * "pushing the rest of the view down". Native has always overlaid instead.
   *
   * Keeps every control (unlike `minimal`, which strips them); only the surface
   * changes. Foreground is forced light because the stage is dark in BOTH
   * themes, so the theme-coloured wordmark would otherwise be dark-on-dark in
   * light mode — the same defect the Runway filter chips had.
   */
  immersive?: boolean;
  profileMenuContext?: 'default' | 'studio';
}

const THEME_MENU_OPTIONS = [
  { value: 'light' as const, label: 'Light', icon: '☀️' },
  { value: 'dark' as const, label: 'Dark', icon: '🌙' },
  { value: 'system' as const, label: 'System', icon: '💻' },
];

export const Navbar: React.FC<NavbarProps> = ({ minimal = false, immersive = false, profileMenuContext = 'default' }) => {
  const { logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const notificationsButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const { themePreference, setThemePreference } = useSyncedThemePreference();
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
  // Brand accounts display the brand identity (name + initials), never the
  // creator's personal name — keeps the fallback initials aligned with the
  // brand-logo avatar. See resolveAccountDisplayName (Rule 28).
  const accountDisplayName = resolveAccountDisplayName(user);

  const isAdmin = user?.role === 'SuperAdmin' || user?.role === 'Admin';

  React.useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      dispatch(fetchCart());
      dispatch(fetchCustomBagCount());
      dispatch(fetchWishlist({ page: 1, limit: 200 }));
    }
  }, [dispatch, isAuthenticated, isAdmin]);

  // AuthContext is the single source of truth for session bootstrap/logout.
  // Do NOT rehydrate localStorage here — that recreates ghost sessions after
  // logout/expiry and can show another user's email/uid in the navbar while
  // the catalog renders a public brand from a QR scan.

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

  const handleHelpComingSoon = () => {
    toast.info('Help center coming soon.');
  };
  const profileHomeRoute = user ? getProfileOrHomeUrl(user) : '/profile';
  const hasBrandAccess = hasActiveBrandMembership(user);
  const savedRoute = hasBrandAccess ? '/profile?tab=Content' : profileHomeRoute;
  const isStudioProfileMenu = profileMenuContext === 'studio';
  const showStudioMenuEntry =
    !isStudioProfileMenu && hasBrandAccess && storeSetupComplete === true;

  const renderProfileMenu = () => {
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
                alt={accountDisplayName}
                fallbackName={accountDisplayName}
                fit="cover"
                className="h-full w-full object-cover"
                containerClassName="h-full w-full"
                rounded="xl"
                keepPreviousOnReload
              />
            </span>
        </DropdownTrigger>

        <DropdownMenu
          maxHeight="min(80dvh, 30rem)"
          className="surface-menu w-[min(17rem,calc(100vw-1rem))] !shadow-none !ring-0 outline-none sm:w-[19rem]"
        >
          <div className="flex items-center gap-3 px-3.5 pb-3 pt-3.5">
            <div className="h-14 w-14 overflow-hidden rounded-xl border border-theme">
              <ImageWithFallback
                src={userAvatar.src}
                fileId={userAvatar.fileId}
                alt={accountDisplayName}
                fallbackName={accountDisplayName}
                fit="cover"
                className="h-full w-full object-cover"
                containerClassName="h-full w-full"
                rounded="xl"
                keepPreviousOnReload
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0 flex-1 truncate text-base font-semibold text-[color:var(--text-primary)]">
                  {accountDisplayName}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void navigator.clipboard.writeText(user.email);
                  toast.success('Email copied to clipboard!');
                }}
                title="Tap to copy email"
                className="mt-0.5 flex w-full items-center gap-1 overflow-visible whitespace-nowrap text-left text-[11px] font-semibold leading-4 text-[color:var(--text-primary)] transition-colors hover:text-purple-600"
              >
                <span>{user.email}</span>
                <span aria-hidden="true" className="shrink-0">📋</span>
              </button>
              {userUid && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void navigator.clipboard.writeText(userUid);
                    toast.success('UID copied to clipboard!');
                  }}
                  title="Tap to copy UID"
                  className="flex w-full items-center gap-1 overflow-visible whitespace-nowrap text-left text-[11px] font-semibold leading-4 text-[color:var(--text-primary)] transition-colors hover:text-purple-600"
                >
                  <span>UID: <span className="font-mono">{userUid}</span></span>
                  <span aria-hidden="true" className="shrink-0">📋</span>
                </button>
              )}
              <div className="mt-2 flex items-center gap-1 rounded-xl surface-control p-1">
                {THEME_MENU_OPTIONS.map((option) => {
                  const active = themePreference === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void setThemePreference(option.value);
                      }}
                      className={`inline-flex h-7 flex-1 items-center justify-center rounded-lg text-sm transition-colors ${
                        active
                          ? 'surface-card shadow-sm'
                          : 'surface-interactive-hover'
                      }`}
                      aria-label={`Use ${option.label.toLowerCase()} theme`}
                      aria-pressed={active}
                      title={`${option.label} theme`}
                    >
                      <span aria-hidden="true">{option.icon}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DropdownDivider />

          {showStudioMenuEntry ? (
            <DropdownItem
              leftIcon="📊"
              onClick={() => {
                navigate('/studio');
                setShowProfileMenu(false);
              }}
            >
              Dashboard
            </DropdownItem>
          ) : null}

          {/*
            Notifications belongs in this menu in BOTH contexts.

            In Studio (`profileMenuContext="studio"`) and on the Catalogue this
            menu is the only account surface a brand sees, and it had no
            notifications entry — so a brand working through their catalogue or
            studio had no indication that an admin had asked for changes. The
            count is the live Redux value, the same one the bell badge reads, so
            the two can never disagree.
          */}
          <DropdownItem
            leftIcon="🔔"
            meta={
              unreadCount > 0 ? (
                <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              ) : null
            }
            onClick={() => {
              navigate('/notifications');
              setShowProfileMenu(false);
            }}
          >
            Notifications
          </DropdownItem>

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


          {!isStudioProfileMenu ? (
            <>
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
                  <button onClick={() => { setLanguage('en'); setShowProfileMenu(false); }} className="w-full rounded-xl px-4 py-2 text-left text-sm text-[color:var(--text-primary)] surface-interactive-hover">English</button>
                  <button onClick={() => { setLanguage('zh'); setShowProfileMenu(false); }} className="w-full rounded-xl px-4 py-2 text-left text-sm text-[color:var(--text-primary)] surface-interactive-hover">Chinese</button>
                  <button onClick={() => { setLanguage('ar'); setShowProfileMenu(false); }} className="w-full rounded-xl px-4 py-2 text-left text-sm text-[color:var(--text-primary)] surface-interactive-hover">Arabic</button>
                  <button onClick={() => { setLanguage('hi'); setShowProfileMenu(false); }} className="w-full rounded-xl px-4 py-2 text-left text-sm text-[color:var(--text-primary)] surface-interactive-hover">Hindi</button>
                </div>
              ) : null}
            </>
          ) : null}

          <DropdownItem
            leftIcon="🆘"
            onClick={() => {
              handleHelpComingSoon();
              setShowProfileMenu(false);
            }}
          >
            Help
          </DropdownItem>

          <DropdownDivider />

          {!hasBrandAccess ? (
            <DropdownItem
              leftIcon="📦"
              onClick={() => {
                navigate('/profile?tab=orders');
                setShowProfileMenu(false);
              }}
            >
              My Orders
            </DropdownItem>
          ) : null}

          <DropdownItem
            leftIcon="⭐"
            onClick={() => {
              navigate('/account/reviews');
              setShowProfileMenu(false);
            }}
          >
            My Reviews
          </DropdownItem>

          {!isStudioProfileMenu ? (
            <DropdownItem
              leftIcon="🤍"
              onClick={() => {
                navigate(savedRoute);
                setShowProfileMenu(false);
              }}
            >
              Saved
            </DropdownItem>
          ) : null}

          <DropdownDivider />

          <DropdownItem
            leftIcon="↩️"
            tone="danger"
            onClick={() => {
              logout();
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
      className={`fixed top-0 left-0 z-layer-nav h-16 w-full px-4 sm:px-5 ${
        immersive
          ? 'border-b-0 bg-transparent'
          : minimal
            ? 'border-b border-transparent bg-transparent'
            : isScrolled
              ? 'wiez-nav-surface-muted'
              : 'wiez-nav-surface'
      }`}
      style={
        isScrolled && !minimal && !immersive
          ? {
              backdropFilter: 'blur(18px) saturate(140%)',
              WebkitBackdropFilter: 'blur(18px) saturate(140%)',
            }
          : undefined
      }
    >
      {/* Readability scrim: over edge-filled media the bar has no surface of
          its own, so the controls need this to stay legible. Extends past the
          bar's own height so it fades out rather than ending on a hard edge. */}
      {immersive ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 via-black/35 to-transparent"
          aria-hidden
        />
      ) : null}

      <div className={`relative flex h-full items-center justify-between gap-4 ${immersive ? 'text-white [&_.text-theme]:text-white [&_.text-theme-secondary]:text-white/80' : ''}`}>
        <div className="flex shrink-0 items-center">
          {!minimal ? (
            <button
              type="button"
              onClick={() => dispatch(toggleSidebar())}
              className="mr-1 inline-flex h-10 w-10 items-center justify-center rounded-xl surface-interactive-hover focus-visible:outline-none active:bg-[color:var(--surface-muted)]"
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
                textClassName="max-w-[200px] truncate text-lg font-bold tracking-tight text-theme"
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
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl surface-interactive-hover focus-visible:outline-none active:bg-[color:var(--surface-muted)] sm:hidden"
              aria-label="Open search"
              onClick={() => navigate('/search')}
            >
              <span aria-hidden="true" className="text-lg text-theme-secondary">🔎</span>
            </button>
          ) : null}

          {user && !isAdmin ? (
            <button
              type="button"
              onClick={() => dispatch(isWishlistOpen ? closeWishlistDrawer() : openWishlistDrawer())}
              className="relative hidden h-10 w-10 items-center justify-center rounded-xl text-xl surface-interactive-hover focus-visible:outline-none active:bg-[color:var(--surface-muted)] sm:flex"
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

          {!isAdmin ? (
            <button
              type="button"
              onClick={() => dispatch(isCartOpen ? closeCartDrawer() : openCartDrawer())}
              className="relative hidden h-10 w-10 items-center justify-center rounded-xl text-xl surface-interactive-hover focus-visible:outline-none active:bg-[color:var(--surface-muted)] sm:flex"
              aria-label={MY_BAG_LABEL}
            >
              <span aria-hidden="true" className="text-xl">{MY_BAG_EMOJI}</span>
              {cartQuantity > 0 ? (
                <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-purple-600 px-1 text-xs font-bold text-white">
                  {cartQuantity > 99 ? '99+' : cartQuantity}
                </span>
              ) : null}
            </button>
          ) : null}

          {user ? (
            <div className="relative">
              {/*
                The bell is visible at EVERY width, unlike the wishlist and bag
                buttons above it. Those two have a mobile home elsewhere;
                notifications had none. The bell was `hidden sm:flex`, the island
                dock has no entry, the profile menu had no entry, and there is no
                /notifications route — so below 640px a user could not reach
                their notifications by ANY path. That is why an admin's
                change-request on a submitted product never surfaced to the brand
                on a phone: the notification was created and pushed correctly,
                there was simply nothing on screen able to show it.
              */}
              <button
                ref={notificationsButtonRef}
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowLanguageDropdown(false);
                  setShowNotificationsDropdown((value) => !value);
                }}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl text-xl surface-interactive-hover focus-visible:outline-none active:bg-[color:var(--surface-muted)]"
                aria-label={
                  unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
                }
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

          {user ? renderProfileMenu() : null}
        </div>
      </div>
    </nav>
  );
};
