import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { closeSidebar, toggleSidebar, MOBILE_BREAKPOINT } from '../features/uiSlice';
import { useStoreSetupStatus } from '@/hooks/useStoreSetupStatus';
import BrandWordmark from '@/components/brand/BrandWordmark';

interface SidebarLinkProps {
  emoji: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
  isRail?: boolean;
}

interface SidebarProps {
  overlayOnly?: boolean;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({
  emoji,
  label,
  active = false,
  onClick,
  isRail = false,
}) => {
  if (isRail) {
    return (
      <button
        onClick={onClick}
        className={`w-full py-3 flex flex-col items-center justify-center gap-1 rounded-lg transition-colors ${
          active
            ? 'bg-[linear-gradient(180deg,rgba(217,70,239,0.12),rgba(255,255,255,0.1))] dark:bg-[linear-gradient(180deg,rgba(168,85,247,0.18),rgba(255,255,255,0.05))]'
            : 'hover:bg-white/28 dark:hover:bg-white/6'
        }`}
        title={label}
      >
        <span className="text-xl">{emoji}</span>
        <span
          className={`text-[10px] truncate w-full text-center ${
            active ? 'text-primary font-medium' : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          {label}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-all duration-200 ${
        active
          ? 'bg-[linear-gradient(90deg,rgba(217,70,239,0.12),rgba(255,255,255,0.12))] font-semibold text-gray-900 dark:bg-[linear-gradient(90deg,rgba(168,85,247,0.18),rgba(255,255,255,0.04))] dark:text-white'
          : 'text-gray-700 dark:text-gray-300 hover:bg-white/28 dark:hover:bg-white/5'
      }`}
      title={isRail ? label : undefined}
    >
      <span className="w-6 shrink-0 text-center text-xl">{emoji}</span>
      <span className="flex-1 truncate text-[17px] font-medium">{label}</span>
    </button>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ overlayOnly = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();

  const { isSidebarOpen, viewportWidth } = useSelector((state: RootState) => state.ui);
  const { profile: user } = useSelector((state: RootState) => state.user);

  const liveViewportWidth =
    typeof window !== 'undefined' && Number.isFinite(window.innerWidth)
      ? window.innerWidth
      : viewportWidth;
  const isMobile = liveViewportWidth < MOBILE_BREAKPOINT;
  const isProfileRoute = location.pathname === '/profile' || location.pathname.startsWith('/profile/');
  const isAdminConsoleUser = user?.role === 'SuperAdmin' || user?.role === 'Admin';
  const storeSetupComplete = useStoreSetupStatus();

  const showOverlay = isSidebarOpen;
  const isRail = !showOverlay;

  if (overlayOnly && !isSidebarOpen) {
    return null;
  }

  const widthClass = isRail ? 'w-[76px]' : 'w-[240px]';
  const positionClass = isRail
    ? 'fixed left-0 top-[var(--app-header-height)] h-[calc(100vh-var(--app-header-height))] z-50'
    : 'fixed left-0 top-0 h-full z-50 shadow-xl';

  const slideClasses = showOverlay
    ? `transform transition-transform duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] ${
        isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'
      }`
    : '';

  const handleLinkClick = (path: string) => {
    navigate(path);
    if (isSidebarOpen) dispatch(closeSidebar());
  };

  // Brands without complete store setup should not see Studio or Messages
  const isBrandWithIncompleteSetup = user?.type === 'BRAND' && storeSetupComplete === false;

  const mainLinks = [
    {
      emoji: '👗',
      label: 'Designs',
      path: '/',
      active: location.pathname === '/market' || location.pathname === '/',
    },
    {
      emoji: '🛍️',
      label: 'Market',
      path: '/market-place',
      active: location.pathname === '/market-place',
    },
    ...(user?.type === 'BRAND' && !isBrandWithIncompleteSetup
      ? [
          {
            emoji: '🎬',
            label: 'Studio',
            path: '/studio',
            active: location.pathname.startsWith('/studio'),
          },
        ]
      : []),
    {
      emoji: '📺',
      label: 'Subscriptions',
      path: '/subscriptions',
      active: location.pathname === '/subscriptions',
    },
    ...(!isBrandWithIncompleteSetup
      ? [
          {
            emoji: '💬',
            label: 'Messages',
            path: '/messages',
            active: location.pathname === '/messages' || location.pathname.startsWith('/studio/messages'),
          },
        ]
      : []),
    {
      emoji: '📏',
      label: 'Size Charts',
      path: '/size-charts',
      active: location.pathname === '/size-charts',
    },
  ];

  const youLinks = [
    { emoji: '🕒', label: 'History', path: '/history', active: location.pathname === '/history' },
    { emoji: '⏰', label: 'Watch Later', path: '/watch-later', active: location.pathname === '/watch-later' },
  ];

  const exploreLinks = [
    { emoji: '📈', label: 'Trending', path: '/trending', active: location.pathname === '/trending' },
  ];

  const mobileDockLinks = [
    ...mainLinks.slice(0, 4),
    {
      emoji: isAdminConsoleUser ? '🛡️' : '👤',
      label: isAdminConsoleUser ? 'Admin' : 'Profile',
      path: isAdminConsoleUser ? '/admin' : '/profile',
      active: isAdminConsoleUser ? location.pathname.startsWith('/admin') : isProfileRoute,
    },
  ];

  if (isMobile && !isSidebarOpen) {
    return (
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200/70 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 shadow-[0_-6px_18px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-black/85">
        <div className="mx-auto flex max-w-xl items-stretch justify-between gap-1">
          {mobileDockLinks.map((link) => (
            <button
              key={link.path}
              type="button"
              onClick={() => navigate(link.path)}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium transition-colors ${
                link.active
                  ? 'bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10'
              }`}
              aria-label={link.label}
            >
              <span className="text-lg leading-none">{link.emoji}</span>
              <span className="truncate">{link.label}</span>
            </button>
          ))}
        </div>
      </nav>
    );
  }

  const renderSidebarContent = (isRailMode: boolean) => (
    <div className={`flex-1 overflow-y-auto scrollbar-hide [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${isRailMode ? 'px-1' : 'px-3'} py-2`}>
      <div className="space-y-1 mb-3">
        {mainLinks.map((link) => (
          <SidebarLink
            key={link.path}
            emoji={link.emoji}
            label={link.label}
            active={link.active}
            onClick={() => handleLinkClick(link.path)}
            isRail={isRailMode}
          />
        ))}
      </div>

      {!isRailMode && (
        <>
          <div className="border-t border-gray-200/50 dark:border-white/10 my-3 mx-2" />

          <div className="px-3 mb-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center">
              You <span className="ml-1 text-xs">{'>'}</span>
            </h3>
          </div>
          <div className="space-y-1 mb-3">
            {youLinks.map((link) => (
              <SidebarLink
                key={link.path}
                emoji={link.emoji}
                label={link.label}
                active={link.active}
                onClick={() => handleLinkClick(link.path)}
                isRail={isRailMode}
              />
            ))}
          </div>

          <div className="border-t border-gray-200/50 dark:border-white/10 my-3 mx-2" />

          <div className="px-3 mb-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Explore</h3>
          </div>
          <div className="space-y-1 mb-3">
            {exploreLinks.map((link) => (
              <SidebarLink
                key={link.path}
                emoji={link.emoji}
                label={link.label}
                active={link.active}
                onClick={() => handleLinkClick(link.path)}
                isRail={isRailMode}
              />
            ))}
          </div>

          <div className="border-t border-gray-200/50 dark:border-white/10 my-3 mx-2" />

          {user && (
            <div className="space-y-1 mb-3">
              <SidebarLink
                emoji="⚙️"
                label="Settings"
                active={location.pathname.startsWith('/settings')}
                onClick={() => handleLinkClick('/settings')}
                isRail={isRailMode}
              />
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ease-out ${
          isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => dispatch(closeSidebar())}
        aria-hidden
      />

      {/* OVERLAY SIDEBAR (Always rendered but translated when closed) */}
      <div
        className={`fixed left-0 top-0 h-full z-50 shadow-xl w-[240px] threadly-chrome-surface rounded-r-lg flex flex-col overflow-hidden transform transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] ${
          isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="h-16 shrink-0 border-b border-gray-200/50 px-4 sm:px-5 dark:border-white/10 flex items-center justify-start">
          <button
            onClick={() => dispatch(toggleSidebar())}
            className="inline-flex h-9 w-9 items-center justify-center mr-1 rounded-xl bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 transition-colors"
          >
            <span className="text-xl">🍔</span>
          </button>
          <div className="flex items-center cursor-pointer" onClick={() => handleLinkClick('/')}>
            <BrandWordmark
              logoSize={32}
              textClassName="text-lg font-bold text-gray-900 dark:text-white tracking-tight"
            />
          </div>
        </div>

        {renderSidebarContent(false)}
      </div>

      {/* RAIL SIDEBAR */}
      {!overlayOnly && !isMobile && (
        <div className="fixed left-0 top-[var(--app-header-height)] h-[calc(100vh-var(--app-header-height))] z-30 w-[76px] bg-transparent flex flex-col overflow-hidden">
          {renderSidebarContent(true)}
        </div>
      )}
    </>
  );
};

export default Sidebar;
