import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Settings, CheckCircle, Shield, Wallet, Users, Bell, AlertTriangle } from 'lucide-react';

interface SettingsSidebarProps {
  active: string;
  onSelect: (key: string) => void;
}

const accountItems = [
  { key: 'account', label: 'Account', path: '/settings?tab=account' },
  { key: 'notifications', label: 'Notifications', path: '/settings?tab=notifications' },
  { key: 'playback', label: 'Playback and performance', path: '/settings?tab=playback' },
  { key: 'downloads', label: 'Downloads', path: '/settings?tab=downloads' },
  { key: 'privacy', label: 'Privacy', path: '/settings?tab=privacy' },
  { key: 'hidden-content', label: 'Hidden Content', path: '/settings?tab=hidden-content' },
  { key: 'connected', label: 'Connected apps', path: '/settings?tab=connected' },
  { key: 'billing', label: 'Billing & payments', path: '/settings?tab=billing' },
  { key: 'advanced', label: 'Advanced settings', path: '/settings?tab=advanced' },
];

const brandItems = [
  { key: 'security', label: 'Security', path: '/settings?tab=security', icon: Shield },
  { key: 'patches', label: 'Brand Patches', path: '/settings?tab=patches', icon: CheckCircle },
  { key: 'subscriptions', label: 'Subscriptions', path: '/settings?tab=subscriptions', icon: Wallet },
];

// Studio/Store Settings Items
const studioItems = [
  { key: 'store-general', label: 'General Settings', path: '/settings?tab=store-general', icon: Settings },
  { key: 'store-social', label: 'Social & Verification', path: '/settings?tab=store-social', icon: CheckCircle },
  { key: 'store-policies', label: 'Policies', path: '/settings?tab=store-policies', icon: Shield },
  { key: 'store-payments', label: 'Payments & Payouts', path: '/settings?tab=store-payments', icon: Wallet },
  { key: 'store-team', label: 'Team Members', path: '/settings?tab=store-team', icon: Users },
  { key: 'store-notifications', label: 'Notifications', path: '/settings?tab=store-notifications', icon: Bell },
  { key: 'store-danger', label: 'Danger Zone', path: '/settings?tab=store-danger', icon: AlertTriangle, danger: true },
];

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ active, onSelect }) => {
  const navigate = useNavigate();
  const [studioExpanded, setStudioExpanded] = useState(
    studioItems.some((item) => active === item.key)
  );
  const [brandExpanded, setBrandExpanded] = useState(
    brandItems.some((item) => active === item.key)
  );

  const handleSelect = (key: string, path: string) => {
    onSelect(key);
    navigate(path);
  };

  const isStudioActive = studioItems.some((item) => active === item.key);
  const isBrandActive = brandItems.some((item) => active === item.key);

  return (
    <aside className="hidden md:block fixed left-0 top-16 h-[calc(100vh-64px)] w-[240px] z-20 overflow-y-auto scrollbar-hide border-r border-gray-200 dark:border-white/5">
      <div className="py-4">
        <h2 className="px-4 text-xl font-semibold text-gray-900 dark:text-white mb-4">Settings</h2>
        
        <nav className="space-y-1">
          {/* Account Section */}
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Account
          </div>
          {accountItems.map(({ key, label, path }) => {
            const isActive = active === key;
            return (
              <button
                key={key}
                onClick={() => handleSelect(key, path)}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  isActive
                    ? 'font-medium text-primary border-l-4 border-primary bg-primary/10' 
                    : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                }`}
              >
                {label}
              </button>
            );
          })}

          <div className="border-t border-gray-200 dark:border-white/5 my-3 mx-4" />

          {/* Brand Management Section (Collapsible) */}
          <button
            onClick={() => setBrandExpanded(!brandExpanded)}
            className={`w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center justify-between transition-colors uppercase tracking-wider ${
              isBrandActive
                ? 'text-purple-600 dark:text-purple-400 bg-purple-500/10'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
          >
            <span>Brand Management</span>
            {brandExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          {brandExpanded && (
             <div className="ml-4 border-l border-gray-200 dark:border-white/10">
              {brandItems.map(({ key, label, path, icon: Icon }) => {
                const isActive = active === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleSelect(key, path)}
                    className={`w-full text-left pl-6 pr-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                      isActive
                        ? 'font-medium text-primary border-l-4 border-primary bg-primary/10 -ml-[1px]' 
                        : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                    }`}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="border-t border-gray-200 dark:border-white/5 my-3 mx-4" />

          {/* Studio Management Section (Collapsible) */}
          <button
            onClick={() => setStudioExpanded(!studioExpanded)}
            className={`w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center justify-between transition-colors uppercase tracking-wider ${
              isStudioActive
                ? 'text-purple-600 dark:text-purple-400 bg-purple-500/10'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
          >
            <span>Studio Management</span>
            {studioExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          {/* Studio Dropdown Items */}
          {studioExpanded && (
            <div className="ml-4 border-l border-gray-200 dark:border-white/10">
              {studioItems.map(({ key, label, path, icon: Icon, danger }) => {
                const isActive = active === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleSelect(key, path)}
                    className={`w-full text-left pl-6 pr-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                      isActive
                        ? 'font-medium text-primary border-l-4 border-primary bg-primary/10 -ml-[1px]' 
                        : danger
                          ? 'text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-500/10'
                          : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </nav>
      </div>
    </aside>
  );
};

export default SettingsSidebar;
