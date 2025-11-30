import React, { useState, useEffect } from 'react';
import { Home, TrendingUp, Grid3X3, Heart, Tag, Trophy, ChevronDown, Shield, Users, BarChart, Settings, UserCheck, Crown, Search, X, Menu, History, Clock, PlaySquare } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { closeSidebar, toggleSidebar } from '../features/uiSlice';

// Threadly Logo Component
const ThreadlyLogo = () => (
  <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="threadly-gradient-sidebar" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6366F1" />
        <stop offset="0.5" stopColor="#8B5CF6" />
        <stop offset="1" stopColor="#A21CAF" />
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
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
  isRail?: boolean;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({
  icon: Icon,
  label,
  active = false,
  onClick,
  isRail = false
}) => {
  if (isRail) {
    return (
      <button
        onClick={onClick}
        className={`w-full py-4 flex flex-col items-center justify-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ${active ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400'}`}
        title={label}
      >
        <Icon className={`w-6 h-6 ${active ? 'fill-current' : ''}`} />
        <span className="text-[10px] truncate w-full text-center">{label}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center px-3 py-2 rounded-lg transition-all duration-200 ${
        active 
          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md font-medium' 
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
      title={label}
    >
      <Icon className={`w-5 h-5 mr-3 ${active ? 'fill-white/20' : ''}`} />
      <span className="text-sm truncate flex-1 text-left">{label}</span>
    </button>
  );
};

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const { translate } = useLanguage();
  
  const { sidebarMode, isSidebarOpen } = useSelector((state: RootState) => state.ui);
  const { profile: user } = useSelector((state: RootState) => state.user);
  const userRole = user?.role || 'user';

  const showOverlay = isSidebarOpen;
  const showRail = sidebarMode === 'RAIL' && !isSidebarOpen;

  // If hidden and not open, render nothing
  if (sidebarMode === 'HIDDEN' && !isSidebarOpen) {
    return null;
  }
  
  // If mobile and closed, render nothing
  if (window.innerWidth < 1024 && !isSidebarOpen) {
      return null; 
  }


  const isRail = !showOverlay; // If not overlay, it's rail (assuming not hidden/mobile-closed)
  
  const widthClass = isRail ? 'w-[72px]' : 'w-[240px]';
  const positionClass = !isRail ? 'fixed left-0 top-0 h-full z-[51] shadow-xl' : `fixed left-0 top-16 h-[calc(100vh-64px)] z-20`;
  
  // Header is needed if it's Overlay (to cover Navbar)
  const isOverlay = showOverlay;
  const showHeader = isOverlay;

  const handleLinkClick = (path: string) => {
    navigate(path);
    if (isOverlay) {
      dispatch(closeSidebar());
    }
  };

  const mainLinks = [
    { icon: Home, label: 'Market', path: '/market' }, // "Home" maps to Market
    { icon: PlaySquare, label: 'Shorts', path: '/shorts' }, // Placeholder
    { icon: Grid3X3, label: 'Subscriptions', path: '/subscriptions' }, // Placeholder
  ];

  if (userRole === 'BRAND') {
    mainLinks.unshift({ icon: BarChart, label: 'Dashboard', path: '/dashboard' });
  }

  const youLinks = [
    { icon: History, label: 'History', path: '/history' },
    { icon: Clock, label: 'Watch Later', path: '/watch-later' },
    { icon: Heart, label: 'Liked Videos', path: '/liked' },
  ];

  const exploreLinks = [
    { icon: TrendingUp, label: 'Trending', path: '/trending' },
    { icon: Tag, label: 'Fashion', path: '/fashion' },
    { icon: Trophy, label: 'Awards', path: '/awards' },
  ];

  return (
    <div className={`${positionClass} ${widthClass} bg-white dark:bg-[#000000] flex flex-col transition-all duration-300 ease-out overflow-hidden ${!isRail ? 'border-r border-gray-200 dark:border-white/10' : ''}`}>
      
      {/* Header (Logo + Hamburger) - Only visible in Drawer/Overlay mode inside the sidebar */}
      {showHeader && (
        <div className="h-16 px-4 flex items-center justify-start shrink-0">
          <button 
            onClick={() => dispatch(toggleSidebar())}
            className="p-2 mr-4 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Menu className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          </button>
          <div className="flex items-center cursor-pointer" onClick={() => handleLinkClick('/')}>
            <ThreadlyLogo />
            <span className="ml-1 text-lg font-bold text-gray-900 dark:text-white tracking-tight">Threadly</span>
          </div>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto scrollbar-hide hover:scrollbar-default ${isRail ? 'px-1' : 'px-3'} py-2`}>
        
        {/* Main Section */}
        <div className="space-y-1 mb-3">
          {mainLinks.map((link) => (
            <SidebarLink
              key={link.path}
              icon={link.icon}
              label={link.label}
              active={location.pathname === link.path}
              onClick={() => handleLinkClick(link.path)}
              isRail={isRail}
            />
          ))}
        </div>

        {!isRail && (
          <>
            <div className="border-t border-gray-200 dark:border-gray-800 my-3 mx-2" />
            
            {/* You Section */}
            <div className="px-3 mb-2">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center">
                You <span className="ml-1 text-xs">›</span>
              </h3>
            </div>
            <div className="space-y-1 mb-3">
              {youLinks.map((link) => (
                <SidebarLink
                  key={link.path}
                  icon={link.icon}
                  label={link.label}
                  active={location.pathname === link.path}
                  onClick={() => handleLinkClick(link.path)}
                  isRail={isRail}
                />
              ))}
            </div>

            <div className="border-t border-gray-200 dark:border-gray-800 my-3 mx-2" />

            {/* Explore Section */}
            <div className="px-3 mb-2">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Explore</h3>
            </div>
            <div className="space-y-1 mb-3">
              {exploreLinks.map((link) => (
                <SidebarLink
                  key={link.path}
                  icon={link.icon}
                  label={link.label}
                  active={location.pathname === link.path}
                  onClick={() => handleLinkClick(link.path)}
                  isRail={isRail}
                />
              ))}
            </div>

            <div className="border-t border-gray-200 dark:border-gray-800 my-3 mx-2" />

            {/* Settings Link */}
            {user && (
              <div className="space-y-1 mb-3">
                <SidebarLink
                  icon={Settings}
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
  );
};
