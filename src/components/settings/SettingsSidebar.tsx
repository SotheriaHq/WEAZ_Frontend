import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';

interface SidebarItem {
  key: string;
  label: string;
  path: string;
  icon: string;
  danger?: boolean;
  description?: string;
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
      { key: 'profile-visibility', label: 'Profile Visibility', path: '/settings?tab=profile-visibility', icon: '👁️', description: 'Who can see your profile' },
      { key: 'size-fits', label: 'Size & Fittings', path: '/settings?tab=size-fits', icon: '📏', description: 'Body measurements' },
      { key: 'hidden-content', label: 'Hidden Content', path: '/settings?tab=hidden-content', icon: '🙈', description: 'Manage hidden items' },
      { key: 'billing', label: 'Accounts', path: '/settings?tab=billing', icon: '🏦', description: 'Wallet, payout account, and payout history' },
    ],
  },
  {
    id: 'brand',
    label: 'Brand',
    collapsible: true,
    items: [
      { key: 'patches', label: 'Brand Patches', path: '/settings?tab=patches', icon: '✅', description: 'Manage patch followers' },
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
  const isBrandUser = me?.type === 'BRAND';
  const [mobileOpen, setMobileOpen] = useState(false);
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
    setMobileOpen(false);
  };

  const visibleGroups = sidebarGroups.filter((group) => !group.brandOnly || isBrandUser);

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
                  className={`flex w-full items-center gap-2.5 py-2 text-left text-sm transition-colors ${
                    group.collapsible ? 'pl-6 pr-4' : 'px-4'
                  } ${
                    isActive
                      ? '-ml-[1px] border-l-[3px] border-primary bg-primary/10 font-medium text-primary'
                      : danger
                        ? 'text-red-500 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-black dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white'
                  }`}
                >
                  <span className="shrink-0" aria-hidden="true">{icon}</span>
                  {label}
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
      <h2 className="mb-4 px-4 text-xl font-semibold text-gray-900 dark:text-white">Settings</h2>
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
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-4 right-4 z-30 rounded-full bg-primary p-3 text-white shadow-lg transition-colors hover:bg-primary/90 md:hidden"
        aria-label="Open settings menu"
      >
        <span aria-hidden="true">☰</span>
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[280px] overflow-y-auto bg-white shadow-xl dark:bg-zinc-900">
            <div className="flex items-center justify-between px-4 pt-4">
              <span className="text-lg font-semibold text-gray-900 dark:text-white">Settings</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-white/10"
              >
                <span className="text-gray-500" aria-hidden="true">✕</span>
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      ) : null}

      <aside className="fixed left-0 top-16 z-20 hidden h-[calc(100vh-64px)] w-[240px] overflow-y-auto border-r border-gray-200 bg-white scrollbar-hide dark:border-white/5 dark:bg-zinc-900 md:block">
        {sidebarContent}
      </aside>
    </>
  );
};

export default SettingsSidebar;
