import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { hasActiveBrandMembership } from '@/lib/brandAccess';

interface SidebarItem {
  key: string;
  label: string;
  path: string;
  icon: string;
  danger?: boolean;
  description?: string;
  nonAdmin?: boolean;
  endUserOnly?: boolean; // hidden for brand accounts (shopper-only settings)
}

interface SidebarGroup {
  id: string;
  label: string;
  collapsible?: boolean;
  brandOnly?: boolean;
  items: SidebarItem[];
}

const sidebarGroups: SidebarGroup[] = [
  {
    id: 'personal',
    label: 'Personal',
    items: [
      { key: 'account-security', label: 'Account & Security', path: '/settings?tab=account-security', icon: '👤', description: 'Email, password, devices' },
      { key: 'notifications', label: 'Notifications', path: '/settings?tab=notifications', icon: '🔔', description: 'Email & push alerts' },
      { key: 'email-preferences', label: 'Email Preferences', path: '/settings?tab=email-preferences', icon: '📧', description: 'Scenario-level email delivery' },
      { key: 'privacy', label: 'Privacy', path: '/settings?tab=privacy', icon: '🛡️', description: 'Data & visibility' },
      { key: 'profile-visibility', label: 'Profile Visibility', path: '/settings?tab=profile-visibility', icon: '👁️', description: 'Who can see your profile', nonAdmin: true, endUserOnly: true },
      { key: 'location', label: 'Location', path: '/settings?tab=location', icon: '📍', description: 'Share location access' },
      { key: 'size-fits', label: 'Size & Fittings', path: '/settings?tab=size-fits', icon: '📏', description: 'Body measurements', nonAdmin: true },
      { key: 'market-preferences', label: 'Market & Feed', path: '/settings?tab=market-preferences', icon: '🧵', description: 'Hidden content and reset' },
      { key: 'upload-preferences', label: 'Upload Preferences', path: '/settings?tab=upload-preferences', icon: '⬆️', description: 'Quality limits and data usage' },
      { key: 'billing', label: 'Accounts', path: '/settings?tab=billing', icon: '🏦', description: 'Wallet, payout account, and payout history' },
    ],
  },
  {
    id: 'brand',
    label: 'Brand',
    collapsible: true,
    items: [
      { key: 'patches', label: 'Brand Patches', path: '/settings?tab=patches', icon: '✅', description: 'Manage brand patches' },
      { key: 'subscriptions', label: 'Subscriptions', path: '/settings?tab=subscriptions', icon: '👥', description: 'Your subscribers' },
    ],
  },
  {
    id: 'studio',
    label: 'Studio',
    collapsible: true,
    brandOnly: true,
    items: [
      { key: 'store-general', label: 'General', path: '/settings?tab=store-general', icon: '⚙️', description: 'Store name, bio, logo' },
      { key: 'store-social', label: 'Social & Links', path: '/settings?tab=store-social', icon: '🔗', description: 'Social links, verification' },
      { key: 'store-policies', label: 'Policies', path: '/settings?tab=store-policies', icon: '📄', description: 'Return, shipping, terms' },
      { key: 'store-team', label: 'Team Members', path: '/settings?tab=store-team', icon: '👥', description: 'Manage access' },
      { key: 'store-notifications', label: 'Store Notifications', path: '/settings?tab=store-notifications', icon: '🔔', description: 'Order & store alerts' },
      { key: 'store-danger', label: 'Danger Zone', path: '/settings?tab=store-danger', icon: '⚠️', danger: true, description: 'Close or delete store' },
    ],
  },
];

interface SettingsSidebarProps {
  active: string;
  onSelect: (key: string) => void;
}

export function getGroupForKey(key: string): SidebarGroup | undefined {
  return sidebarGroups.find((group) => group.items.some((item) => item.key === key));
}

export function getItemForKey(key: string): SidebarItem | undefined {
  for (const group of sidebarGroups) {
    const item = group.items.find((candidate) => candidate.key === key);
    if (item) return item;
  }
  return undefined;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ active, onSelect }) => {
  const navigate = useNavigate();
  const me = useSelector((state: RootState) => state.user.profile);
  const isBrandUser = hasActiveBrandMembership(me);
  const isAdmin = me?.role === 'SuperAdmin' || me?.role === 'Admin';
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of sidebarGroups) {
      if (group.collapsible) {
        initial[group.id] = group.items.some((item) => item.key === active);
      }
    }
    return initial;
  });

  const toggleGroup = (id: string) => {
    setExpanded((previous) => ({ ...previous, [id]: !previous[id] }));
  };

  const handleSelect = (key: string, path: string) => {
    onSelect(key);
    navigate(path);
  };

  const visibleGroups = sidebarGroups
    .filter((group) => !group.brandOnly || isBrandUser)
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (!isAdmin || !item.nonAdmin) &&
          // Shopper-only links never show for brand accounts, and vice-versa.
          (!isBrandUser || !item.endUserOnly),
      ),
    }));

  const renderGroup = (group: SidebarGroup) => {
    const isGroupActive = group.items.some((item) => item.key === active);
    const isExpanded = group.collapsible ? expanded[group.id] : true;

    return (
      <div key={group.id}>
        {group.collapsible ? (
          <button
            onClick={() => toggleGroup(group.id)}
            className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider transition-colors ${
              isGroupActive
                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5'
            }`}
          >
            <span>{group.label}</span>
            <span aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
          </button>
        ) : (
          <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {group.label}
          </div>
        )}

        {isExpanded ? (
          <div className={group.collapsible ? 'ml-2 border-l border-gray-200 dark:border-white/10' : ''}>
            {group.items.map(({ key, label, path, icon, danger }) => {
              const isActive = active === key;
              return (
                <button
                  key={key}
                  onClick={() => handleSelect(key, path)}
            className={`flex w-full items-center gap-2 py-2.5 text-left text-[11px] leading-snug transition-colors md:gap-2.5 md:py-2 md:text-sm ${
                    group.collapsible ? 'pl-3 pr-2 md:pl-6 md:pr-4' : 'px-3 md:px-4'
                  } ${
                    isActive
                      ? '-ml-[1px] border-l-[3px] border-primary bg-primary/10 font-medium text-primary'
                      : danger
                        ? 'text-red-500 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-black dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white'
                  }`}
                >
                  <span className="shrink-0 text-sm md:text-base" aria-hidden="true">{icon}</span>
                  <span className="min-w-0">{label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  const sidebarContent = (
    <div className="py-4">
      <h2 className="mb-2 px-2 text-sm font-semibold text-gray-900 md:mb-4 md:px-4 md:text-xl dark:text-white">Settings</h2>
      <nav className="space-y-1">
        {visibleGroups.map((group, index) => (
          <React.Fragment key={group.id}>
            {index > 0 ? (
              <div className="mx-4 my-3 border-t border-gray-200 dark:border-white/5" />
            ) : null}
            {renderGroup(group)}
          </React.Fragment>
        ))}
      </nav>
    </div>
  );

  return (
    // Scaled fixed sidebar — stays visible on mobile (narrow) and full-width on md+.
    <aside className="fixed left-0 top-16 z-20 block h-[calc(100vh-64px)] w-[118px] overflow-y-auto border-r border-gray-200 bg-white scrollbar-hide dark:border-white/5 dark:bg-zinc-900 md:w-[220px]">
      {sidebarContent}
    </aside>
  );
};

export default SettingsSidebar;
