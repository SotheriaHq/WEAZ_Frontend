import React, { useState } from 'react';
import { Home, TrendingUp, Grid3X3, Heart, Tag, Trophy, ChevronDown, Shield, Users, BarChart, Settings, UserCheck, Crown, Search, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext'; // Assuming this import path is correct
import { useNavigate, useLocation } from 'react-router-dom';
// import { useSelector } from 'react-redux';
// import type { RootState } from '../store';

interface SidebarLinkProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  hasDropdown?: boolean;
  onClick?: () => void;
  iconColor?: string;
  isCollapsed?: boolean;
  isHovered?: boolean;
}

interface LetterRefs {
  [key: string]: HTMLDivElement | null;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({
  icon: Icon,
  label,
  active = false,
  hasDropdown = false,
  onClick,
  iconColor = "text-gray-600 dark:text-gray-400",
  isCollapsed = false,
  isHovered = false
}) => {
  const showLabel = !isCollapsed;

  // Use iconColor and isHovered to avoid unused variable lint warnings
  const iconClass = `${active ? 'text-white' : iconColor} ${isHovered ? 'scale-105' : ''}`.trim();

  // Collapsed: stack icon over label to keep labels visible under icons
  if (isCollapsed) {
    return (
      <button
        onClick={onClick}
        className={`w-full px-1 py-3 rounded-lg transition-all duration-200 flex flex-col items-center justify-center ${active
          ? 'bg-gradient-to-br from-purple-600/70 via-fuchsia-600/60 to-indigo-600/70 text-white backdrop-blur-md'
          : 'text-gray-700 dark:text-gray-300 hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary'
          }`}
        aria-label={label}
        title={label}
      >
        <Icon className={`w-5 h-5 flex-shrink-0 ${iconClass}`} />
        <span className="mt-1 text-[10px] leading-tight font-medium text-center truncate w-full">{label}</span>
      </button>
    );
  }

  // Expanded: standard horizontal layout
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center space-x-4 px-4 py-3 rounded-lg transition-all duration-200 ${active
        ? 'bg-gradient-to-br from-purple-600/70 via-fuchsia-600/60 to-indigo-600/70 text-white backdrop-blur-md'
        : 'text-gray-700 dark:text-gray-300 hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary'
        }`}
      title={label}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${iconClass}`} />
      {showLabel && (
        <>
          <span className="text-sm font-medium flex-1 text-left">{label}</span>
          {hasDropdown && (
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${active ? 'rotate-180' : ''}`} />
          )}
        </>
      )}
    </button>
  );
};

// Mobile Footer Link Component
const MobileFooterLink: React.FC<SidebarLinkProps> = ({
  icon: Icon,
  label,
  active = false,
  hasDropdown = false,
  onClick,
  iconColor = "text-gray-600 dark:text-gray-400",
  isHovered: _isHovered = false
}) => {
  const iconClass = `${active ? 'text-white' : iconColor} ${_isHovered ? 'scale-105' : ''}`.trim();

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center space-y-1 p-2 rounded-lg transition-all duration-200 ${active
        ? 'bg-gradient-to-br from-purple-600/70 via-fuchsia-600/60 to-indigo-600/70 text-white backdrop-blur-md'
        : 'text-gray-700 dark:text-gray-300 hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary'
        }`}
    >
  <Icon className={`w-5 h-5 flex-shrink-0 ${iconClass}`} />
      <span className="text-xs font-medium text-center truncate">{label}</span>
      {hasDropdown && (
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${active ? 'rotate-180' : ''
          }`} />
      )}
    </button>
  );
};

// Brand Search Component
const BrandSearch: React.FC<{
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onClear: () => void;
}> = ({ searchTerm, onSearchChange, onClear }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="relative mb-4">
      <div className={`relative transition-all duration-200 ${isExpanded ? 'w-full' : 'w-8'}`}>
        <button
          onClick={() => setIsExpanded(true)}
          className={`absolute left-0 top-1/2 transform -translate-y-1/2 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${isExpanded ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
            }`}
        >
          <Search className="w-4 h-4" />
        </button>
        <input
          type="text"
          placeholder="Search brands..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setIsExpanded(true)}
          onBlur={() => !searchTerm && setIsExpanded(false)}
          className={`w-full py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none transition-all duration-200 bg-transparent rounded-lg border border-gray-200 dark:border-gray-700 ${isExpanded
            ? 'opacity-100 pl-10 pr-8 border-primary/30'
            : 'opacity-0 pl-8 pr-0 border-transparent'
            }`}
        />
        {searchTerm && (
          <button
            onClick={() => {
              onClear();
              setIsExpanded(false);
            }}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// Alphabet Navigation Component
const AlphabetNavigation: React.FC<{
  availableLetters: string[];
  activeLetter: string | null;
  onLetterClick: (letter: string) => void;
}> = ({ availableLetters, activeLetter, onLetterClick }) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  return (
    <div className="mb-4">
      <div className="space-y-0.5">
        {alphabet.map((letter) => {
          const isAvailable = availableLetters.includes(letter);
          const isActive = activeLetter === letter;

          return (
            <button
              key={letter}
              onClick={() => isAvailable ? onLetterClick(letter) : null}
              disabled={!isAvailable}
              className={`w-full text-left px-3 py-1.5 text-sm font-medium transition-colors rounded ${isActive
                ? 'text-primary bg-primary/10 font-bold'
                : isAvailable
                  ? 'text-gray-700 dark:text-gray-300 hover:text-primary hover:bg-primary/5'
                  : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                }`}
            >
              {letter}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Mock brands data
const mockBrands = [
  'Abuja Styles', 'African Elegance', 'African Prints Co.', 'Afrocentric Styles',
  'Ankara Luxury', 'Calabar Couture', 'Eko Couture', 'Fashion Forward NG',
  'Golden Thread', 'Lagos Style Hub', 'Lagos Urban', 'Modern Traditional',
  'Moodrama', 'Nigerian Fashion House', 'Nollywood Fashion', 'Ola Gold',
  'Port Harcourt Threads', 'Style Connect', 'Style Fusion', 'Trendy Ankara',
  'Urban Lagos'
].sort();

type UserRole = 'user' | 'admin' | 'moderator';

interface SidebarProps {
  userRole?: UserRole;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

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


export const Sidebar: React.FC<SidebarProps> = ({
  userRole = 'user',
  isCollapsed,
  setIsCollapsed
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  // const userProfile = useSelector((state: RootState) => state.user.profile);
  const [activeLink, setActiveLink] = useState('market');
  const [brandsOpen, setBrandsOpen] = useState(false); // deprecated; retained to avoid large refactor
  const [brandSearchTerm, setBrandSearchTerm] = useState(''); // deprecated
  const [activeLetter, setActiveLetter] = useState<string | null>(null); // deprecated
  const { translate } = useLanguage();

  const [isHovered] = useState(false); // Retained but not used for sidebar width, only link styles

  // Hide sidebar on settings pages
  if (location.pathname.startsWith('/settings')) {
    return null;
  }

  const sidebarWidth = isCollapsed ? 'w-[64px]' : 'w-[192px]';

  type SidebarLinkType = {
    icon: React.ElementType;
    labelKey: string;
    hasDropdown: boolean;
    iconColor?: string;
  };

  // Filter brands based on search term
  const filteredBrands = mockBrands.filter(brand =>
    brand.toLowerCase().includes(brandSearchTerm.toLowerCase())
  );

  // Get available letters for navigation
  const availableLetters = Array.from(new Set(
    filteredBrands.map(brand => brand[0].toUpperCase())
  )).sort();

  // Group filtered brands by their starting letter
  const groupedBrands = filteredBrands.reduce((acc, brand) => {
    const firstLetter = brand[0].toUpperCase();
    if (!acc[firstLetter]) {
      acc[firstLetter] = [];
    }
    acc[firstLetter].push(brand);
    return acc;
  }, {} as Record<string, string[]>);

  // Refs for smooth scrolling and scroll tracking
  const brandsListRef = React.useRef<HTMLDivElement>(null);
  const letterRefs = React.useRef<LetterRefs>({});

  // Scroll to letter section
  const handleLetterClick = (letter: string) => {
    setActiveLetter(letter);
    const targetElement = letterRefs.current[letter];
    if (targetElement && brandsListRef.current) {
      const container = brandsListRef.current;
      const targetOffset = targetElement.offsetTop;
      container.scrollTo({
        top: targetOffset,
        behavior: 'smooth'
      });
    }
  };

  // Track scroll position and update active letter
  const handleBrandsScroll = React.useCallback(() => {
    if (!brandsListRef.current) return;

    const container = brandsListRef.current;
    const scrollTop = container.scrollTop;

    let newActiveLetter: string | null = null;
    const threshold = 50;

    for (const letter of availableLetters) {
      const element = letterRefs.current[letter];
      if (element) {
        const elementTop = element.offsetTop;
        if (elementTop <= scrollTop + threshold) {
          newActiveLetter = letter;
        } else {
          break;
        }
      }
    }

    // Only update if significantly different to avoid refresh effect
    if (newActiveLetter !== activeLetter && newActiveLetter !== null) {
      setActiveLetter(newActiveLetter);
    }
  }, [availableLetters, activeLetter]);


  // Attach scroll listener
  React.useEffect(() => {
    const container = brandsListRef.current;
    if (container) {
      container.addEventListener('scroll', handleBrandsScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleBrandsScroll);
    }
  }, [handleBrandsScroll]);

  // Reset active letter when search changes
  React.useEffect(() => {
    setActiveLetter(null);
  }, [brandSearchTerm]);

  const mainSidebarLinks: SidebarLinkType[] = [
    { icon: Home, labelKey: 'market', hasDropdown: false },
    { icon: TrendingUp, labelKey: 'trending', hasDropdown: false },
    { icon: Grid3X3, labelKey: 'categories', hasDropdown: false },
  ];

  const userSidebarLinks: SidebarLinkType[] = [
    { icon: Heart, labelKey: 'favorites', hasDropdown: false },
    { icon: Tag, labelKey: 'brands', hasDropdown: false },
    { icon: Trophy, labelKey: 'badges', hasDropdown: false },
  ];

  const getAdditionalLinks = (): SidebarLinkType[] => {
    switch (userRole) {
      case 'admin':
        return [
          { icon: Shield, labelKey: 'adminPanel', hasDropdown: false },
          { icon: Users, labelKey: 'userManagement', hasDropdown: false },
          { icon: BarChart, labelKey: 'analytics', hasDropdown: false },
          { icon: Settings, labelKey: 'systemSettings', hasDropdown: false }
        ];
      case 'moderator':
        return [
          { icon: UserCheck, labelKey: 'moderation', hasDropdown: false },
          { icon: BarChart, labelKey: 'reports', hasDropdown: false }
        ];
      default:
        return [];
    }
  };

  const additionalLinks = getAdditionalLinks();

  const handleLinkClick = (labelKey: string) => {
    // Always handle Market navigation the same way regardless of collapsed state
    if (labelKey === 'market') {
      if (isCollapsed) setIsCollapsed(false);
      setActiveLink(labelKey);
      setBrandsOpen(false);
      // Navigate explicitly to /market to avoid brand-root redirect
      navigate('/market');
      return;
    }

    if (isCollapsed) {
      setIsCollapsed(false);
    }

    if (labelKey === 'brands') {
      // Route to a dedicated brands page or market for now
      setActiveLink(labelKey);
      setBrandsOpen(false);
      navigate('/market');
      return;
    }

    setActiveLink(labelKey);
    setBrandsOpen(false);
  };

  const clearBrandSearch = () => {
    setBrandSearchTerm('');
    setActiveLetter(null);
  };



  // Desktop/Tablet Sidebar
  const DesktopSidebar = () => (
    <div
      // FIX: Full height (h-screen), top-0, and higher z-index to sit above/beside navbar
      className={`fixed left-0 top-0 h-screen ${sidebarWidth} flex flex-col z-[60] transition-all duration-300 ease-out will-change-[width]
    border-r border-white/20 dark:border-white/10 bg-white dark:bg-[#000000]`}
    >

      {/* Navigation Links Wrapper - Takes remaining space and provides main scrolling area */}
      <div className="flex-1 flex flex-col min-h-0 pt-4">
        <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ overscrollBehavior: 'contain' }}>
          {/* Main Navigation */}
          <div className="px-2 py-4 space-y-1">
            {mainSidebarLinks.map((link) => (
              <SidebarLink
                key={link.labelKey}
                icon={link.icon}
                label={translate(link.labelKey)}
                active={activeLink === link.labelKey}
                hasDropdown={link.hasDropdown}
                onClick={() => handleLinkClick(link.labelKey)}
                isCollapsed={isCollapsed}
                isHovered={isHovered}
              />
            ))}
          </div>

          {/* Divider */}
          {/* <div className="border-t border-gray-200 dark:border-gray-800 mx-3"></div> */}

          {/* User Section */}
          <div className="px-2 py-4 flex-1 overflow-hidden">

            {!isCollapsed && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 px-4">
                  Your Library
                </h3>
              </div>
            )}
            {userSidebarLinks.map((link) => (
              <div key={link.labelKey} className="mb-1">
                <SidebarLink
                  icon={link.icon}
                  label={translate(link.labelKey)}
                  active={activeLink === link.labelKey}
                  hasDropdown={link.hasDropdown}
                  onClick={() => handleLinkClick(link.labelKey)}
                  isCollapsed={isCollapsed}
                  isHovered={isHovered}
                />
                {/* Brand listing panel removed; link now routes to page */}
                </div>
              ))}
            </div>

            {/* Admin/Moderator Section */}
            {additionalLinks.length > 0 && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-800 mx-2"></div>
                <div className="px-2 py-4 space-y-1">


                  {!isCollapsed && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 px-4">
                        {userRole === 'admin' ? 'Administration' : 'Moderation'}
                      </h3>
                    </div>
                  )}
                  {additionalLinks.map((link) => (
                    <SidebarLink
                      key={link.labelKey}
                      icon={link.icon}
                      label={translate(link.labelKey)}
                      active={activeLink === link.labelKey}
                      hasDropdown={link.hasDropdown}
                      onClick={() => handleLinkClick(link.labelKey)}
                      isCollapsed={isCollapsed}
                      isHovered={isHovered}
                    />
                  ))}
                </div>
              </>
            )}

            {/* User Role Badge */}
            {userRole !== 'user' && !isCollapsed && (
              <div className="px-3 pb-4">
                <div className="flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-gradient-to-r from-primary to-purple-700">
                  <Crown className="w-4 h-4 text-white" />
                  <span className="text-xs font-medium text-white capitalize">{userRole}</span>
                </div>
              </div>
            )}

          </div>
        </div>


        {/* Bottom footer + collapse control removed as per spec */}
      </div>
  );

  // Mobile Footer (No changes needed, kept for completeness)
  const MobileFooter = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#000000] border-t border-gray-200 dark:border-gray-800 px-4 py-2 z-40">
      <div className="flex justify-around items-center max-w-2xl mx-auto">
        {[...mainSidebarLinks, ...userSidebarLinks].slice(0, 5).map((link) => (
          <MobileFooterLink
            key={link.labelKey}
            icon={link.icon}
            label={translate(link.labelKey)}
            active={activeLink === link.labelKey}
            hasDropdown={link.hasDropdown}
            onClick={() => handleLinkClick(link.labelKey)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop/Tablet Sidebar - Hidden on mobile */}
      <div className="hidden lg:block">
        <DesktopSidebar />
      </div>

      {/* Mobile Footer - Only visible on mobile and tablet */}
      <div className="block lg:hidden">
        <MobileFooter />
      </div>

      {/* Mobile Brands Modal (kept for completeness) */}
      {brandsOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 lg:hidden">
          <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-lg max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">All Brands</h3>
                <button
                  onClick={() => setBrandsOpen(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <BrandSearch
                searchTerm={brandSearchTerm}
                onSearchChange={setBrandSearchTerm}
                onClear={clearBrandSearch}
              />
            </div>

            <div className="overflow-y-auto p-4 flex-1">
              <div className="flex gap-4 h-full">
                <div className="flex-1 overflow-y-auto">
                  {Object.keys(groupedBrands).length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No brands found
                    </div>
                  ) : (
                    Object.keys(groupedBrands).map((letter) => (
                      <div key={letter} className="mb-6">
                        <h4 className="text-lg font-bold text-primary mb-3">{letter}</h4>
                        <div className="grid grid-cols-1 gap-2">
                          {groupedBrands[letter].map((brand) => (
                            <button
                              key={brand}
                              className="text-left px-3 py-3 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-primary/10 hover:text-primary transition-colors font-medium border border-gray-200 dark:border-gray-700"
                              onClick={() => {
                                setBrandsOpen(false);
                                setActiveLink('');
                              }}
                            >
                              {brand}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="w-8 flex-shrink-0">
                  <div className="sticky top-0">
                    <AlphabetNavigation
                      availableLetters={availableLetters}
                      activeLetter={activeLetter}
                      onLetterClick={handleLetterClick}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};


