import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { closeSidebar, toggleSidebar, MOBILE_BREAKPOINT } from '../features/uiSlice';

const ThreadlyLogo = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="threadly-gradient-sidebar" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="var(--brand-primary)" />
        <stop offset="0.5" stopColor="var(--brand-accent)" />
        <stop offset="1" stopColor="var(--brand-primary-strong)" />
      </linearGradient>
    </defs>
    <path
      d="M8 20C8 16.5 13 16.5 13 13C13 9.5 8 9.5 8 13"
      stroke="url(#threadly-gradient-sidebar)"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M24 12C24 15.5 19 15.5 19 19C19 22.5 24 22.5 24 19"
      stroke="url(#threadly-gradient-sidebar)"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="16" cy="16" r="2.5" fill="url(#threadly-gradient-sidebar)" />
  </svg>
);

interface SidebarLinkProps {
  emoji: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
  isRail?: boolean;
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
        className={`w-full py-3 flex flex-col items-center justify-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ${
          active ? 'bg-gray-100 dark:bg-gray-800' : ''
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
      className={`w-full flex items-center px-3 py-2 rounded-lg transition-all duration-200 ${
        active
          ? 'font-medium text-primary border-l-4 border-primary bg-primary/10'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
      title={label}
    >
      <span className="text-xl mr-3">{emoji}</span>
      <span className="text-sm truncate flex-1 text-left">{label}</span>
    </button>
  );
};

export const Sidebar: React.FC = () => {
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
  const isSettingsRoute =
    location.pathname.startsWith('/settings') || location.pathname.startsWith('/profile/settings');

  if (location.pathname.startsWith('/studio')) return null;
  if (isSettingsRoute && !isSidebarOpen) return null;

  const showOverlay = isSidebarOpen;
  const isRail = !showOverlay;
  const forceRailOnProfile = isProfileRoute;

  if (isMobile && !isSidebarOpen && !forceRailOnProfile) {
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
    if (showOverlay) dispatch(closeSidebar());
  };

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
    ...(user?.type === 'BRAND'
      ? [
          {
            emoji: '🎬',
            label: 'Studio',
            path: '/studio',
            active: location.pathname === '/studio',
          },
        ]
      : []),
    {
      emoji: '📺',
      label: 'Subscriptions',
      path: '/subscriptions',
      active: location.pathname === '/subscriptions',
    },
  ];

  const youLinks = [
    { emoji: '🕒', label: 'History', path: '/history', active: location.pathname === '/history' },
    { emoji: '⏰', label: 'Watch Later', path: '/watch-later', active: location.pathname === '/watch-later' },
  ];

  const exploreLinks = [
    { emoji: '📈', label: 'Trending', path: '/trending', active: location.pathname === '/trending' },
  ];

  return (
    <>
      {showOverlay && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => dispatch(closeSidebar())}
          aria-hidden
        />
      )}

      <div
        className={`${positionClass} ${widthClass} bg-[color:var(--surface-primary)]/95 dark:bg-[color:var(--surface-primary)]/95 backdrop-blur-xl flex flex-col transition-all duration-300 ease-out overflow-hidden ${slideClasses}`}
      >
        {showOverlay && (
          <div className="h-16 px-4 sm:px-5 flex items-center justify-start shrink-0 border-b border-transparent">
            <button
              onClick={() => dispatch(toggleSidebar())}
              className="inline-flex items-center justify-center p-2 mr-1 sm:mr-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="text-xl">🍔</span>
            </button>
            <div className="flex items-center cursor-pointer" onClick={() => handleLinkClick('/')}>
              <ThreadlyLogo />
              <span className="ml-2 text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                Threadly
              </span>
            </div>
          </div>
        )}

        <div className={`flex-1 overflow-y-auto scrollbar-hide hover:scrollbar-default ${isRail ? 'px-1' : 'px-3'} py-2`}>
          <div className="space-y-1 mb-3">
            {mainLinks.map((link) => (
              <SidebarLink
                key={link.path}
                emoji={link.emoji}
                label={link.label}
                active={link.active}
                onClick={() => handleLinkClick(link.path)}
                isRail={isRail}
              />
            ))}
          </div>

          {!isRail && (
            <>
              <div className="border-t border-gray-200 dark:border-gray-800 my-3 mx-2" />

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
                    isRail={isRail}
                  />
                ))}
              </div>

              <div className="border-t border-gray-200 dark:border-gray-800 my-3 mx-2" />

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
                    isRail={isRail}
                  />
                ))}
              </div>

              <div className="border-t border-gray-200 dark:border-gray-800 my-3 mx-2" />

              {user && (
                <div className="space-y-1 mb-3">
                  <SidebarLink
                    emoji="⚙️"
                    label="Settings"
                    active={location.pathname.startsWith('/settings')}
                    onClick={() => handleLinkClick('/settings')}
                    isRail={isRail}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
