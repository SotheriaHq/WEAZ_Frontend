import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { isBrandAccount } from '@/lib/brandAccess';
import { useStoreSetupStatus } from '@/hooks/useStoreSetupStatus';
import type { StoreStatusResponse } from '@/api/StoreApi';

interface SidebarItem {
  key: string;
  label: string;
  path: string;
  icon: string;
  danger?: boolean;
  description?: string;
  requiresStoreSetup?: boolean;
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
    id: 'privacy-security',
    label: 'Privacy & Security',
    items: [
      {
        key: 'account-security',
        label: 'Account Security',
        path: '/settings?tab=account-security',
        icon: '👤',
        description: 'Email, password, devices',
      },
      {
        key: 'privacy',
        label: 'Privacy Controls',
        path: '/settings?tab=privacy',
        icon: '🛡️',
        description: 'Data & visibility',
      },
    ],
  },
  {
    id: 'personal',
    label: 'Personal',
    items: [
      {
        key: 'notifications',
        label: 'Notifications',
        path: '/settings?tab=notifications',
        icon: '🔔',
        description: 'Email & push alerts',
      },
      {
        key: 'email-preferences',
        label: 'Email Preferences',
        path: '/settings?tab=email-preferences',
        icon: '📧',
        description: 'Scenario-level email delivery',
      },
      {
        key: 'profile-visibility',
        label: 'Profile Visibility',
        path: '/settings?tab=profile-visibility',
        icon: '👁️',
        description: 'Who can see your profile',
        nonAdmin: true,
      },
      {
        key: 'location',
        label: 'Location',
        path: '/settings?tab=location',
        icon: '📍',
        description: 'Share location access',
      },
      {
        key: 'currency',
        label: 'Currency',
        path: '/settings?tab=currency',
        icon: '💱',
        description: 'Prices in your currency',
      },
      {
        key: 'size-fits',
        label: 'Size & Fittings',
        path: '/settings?tab=size-fits',
        icon: '📏',
        description: 'Body measurements',
        nonAdmin: true,
      },
      {
        key: 'market-preferences',
        label: 'Market & Feed',
        path: '/settings?tab=market-preferences',
        icon: '🧵',
        description: 'Hidden content and reset',
      },
      {
        key: 'upload-preferences',
        label: 'Upload Preferences',
        path: '/settings?tab=upload-preferences',
        icon: '⬆️',
        description: 'Quality limits and data usage',
      },
      {
        key: 'billing',
        label: 'Accounts',
        path: '/settings?tab=billing',
        icon: '🏦',
        description: 'Wallet, payout account, and payout history',
        requiresStoreSetup: true,
      },
    ],
  },
  {
    id: 'brand',
    label: 'Brand',
    collapsible: true,
    items: [
      {
        key: 'patches',
        label: 'Brand Patches',
        path: '/settings?tab=patches',
        icon: '✅',
        description: 'Manage brand patches',
      },
      {
        key: 'subscriptions',
        label: 'Brand subscribers',
        path: '/settings?tab=subscriptions',
        icon: '👥',
        description: 'Your subscribers',
      },
    ],
  },
  {
    id: 'studio',
    label: 'Business',
    collapsible: true,
    brandOnly: true,
    items: [
      { key: 'store-category-requests', label: 'Category requests', path: '/settings?tab=store-category-requests', icon: '📝', description: 'Request and track category approval', requiresStoreSetup: true },
      {
        key: 'store-customers', label: 'Customers', path: '/settings?tab=store-customers',
        icon: '👥', description: 'Customer purchase threshold · paid plans', requiresStoreSetup: true,
      },
      {
        key: 'subscription-billing',
        label: 'Billing & subscriptions',
        path: '/settings?tab=subscription-billing',
        icon: '🧵',
        description: 'Plans, renewals, history and payment methods',
      },
      {
        key: 'store-general',
        label: 'General',
        path: '/settings?tab=store-general',
        icon: '⚙️',
        description: 'Store name, bio, logo',
        requiresStoreSetup: true,
      },
      {
        key: 'store-hours',
        label: 'Working Hours',
        path: '/settings?tab=store-hours',
        icon: '🕒',
        description: 'Days & hours you operate',
        requiresStoreSetup: true,
      },
      {
        key: 'store-social',
        label: 'Social & Links',
        path: '/settings?tab=store-social',
        icon: '🔗',
        description: 'Social links, verification',
        requiresStoreSetup: true,
      },
      {
        key: 'store-policies',
        label: 'Policies',
        path: '/settings?tab=store-policies',
        icon: '📄',
        description: 'Return, shipping, terms',
        requiresStoreSetup: true,
      },
      {
        key: 'store-team',
        label: 'Team Members',
        path: '/settings?tab=store-team',
        icon: '👥',
        description: 'Manage access',
        requiresStoreSetup: true,
      },
      {
        key: 'store-notifications',
        label: 'Store Notifications',
        path: '/settings?tab=store-notifications',
        icon: '🔔',
        description: 'Order & store alerts',
        requiresStoreSetup: true,
      },
      {
        key: 'store-danger',
        label: 'Danger Zone',
        path: '/settings?tab=store-danger',
        icon: '⚠️',
        danger: true,
        description: 'Close or delete store',
        requiresStoreSetup: true,
      },
    ],
  },
];

interface SettingsSidebarProps {
  active: string;
  onSelect: (key: string) => void;
}

export function getGroupForKey(key: string): SidebarGroup | undefined {
  return sidebarGroups.find((group) =>
    group.items.some((item) => item.key === key),
  );
}

export function getItemForKey(key: string): SidebarItem | undefined {
  for (const group of sidebarGroups) {
    const item = group.items.find((candidate) => candidate.key === key);
    if (item) return item;
  }
  return undefined;
}

export function getVisibleSettingsGroups({
  isBrandUser,
  isAdmin,
  storeSetupComplete,
}: {
  isBrandUser: boolean;
  isAdmin: boolean;
  storeSetupComplete: boolean | null;
}): SidebarGroup[] {
  return sidebarGroups
    .filter((group) => !group.brandOnly || isBrandUser)
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (!isAdmin || !item.nonAdmin) &&
          (!isBrandUser || !item.endUserOnly) &&
          (!item.requiresStoreSetup || !isBrandUser || storeSetupComplete === true),
      ),
    }));
}

export function resolveSettingsTab(
  active: string,
  isBrandUser: boolean,
  storeStatus: StoreStatusResponse | null,
): string {
  const normalizedAccountTab =
    active === 'account' || active === 'security' ? 'account-security' : active;
  const normalizedActive =
    isBrandUser && normalizedAccountTab === 'store-payments'
      ? 'billing'
      : normalizedAccountTab;

  if (
    !isBrandUser &&
    (normalizedActive.startsWith('store-') || normalizedActive === 'subscription-billing')
  ) {
    return 'account-security';
  }

  const needsPublishedStoreHours =
    normalizedActive === 'store-hours' &&
    storeStatus?.isPublished === true &&
    storeStatus.workingHoursRequired === true &&
    storeStatus.businessHoursConfigured === false;
  const item = getItemForKey(normalizedActive);
  if (
    isBrandUser &&
    item?.requiresStoreSetup &&
    storeStatus?.isSetupComplete !== true &&
    !needsPublishedStoreHours
  ) {
    return 'account-security';
  }

  return normalizedActive;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  active,
  onSelect,
}) => {
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('wiez_settings_sidebar_width');
      return saved ? Math.min(360, Math.max(170, parseInt(saved, 10))) : 240;
    } catch {
      return 240;
    }
  });

  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty('--settings-sidebar-width', `${sidebarWidth}px`);
  }, [sidebarWidth]);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newWidth = Math.min(360, Math.max(170, moveEvent.clientX));
      setSidebarWidth(newWidth);
      document.documentElement.style.setProperty('--settings-sidebar-width', `${newWidth}px`);
      try {
        localStorage.setItem('wiez_settings_sidebar_width', String(newWidth));
      } catch {}
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };
  const navigate = useNavigate();
  const me = useSelector((state: RootState) => state.user.profile);
  const isBrandUser = isBrandAccount(me);
  const isAdmin = me?.role === 'SuperAdmin' || me?.role === 'Admin';
  const storeSetupComplete = useStoreSetupStatus();
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

  const visibleGroups = getVisibleSettingsGroups({
    isBrandUser,
    isAdmin,
    storeSetupComplete,
  });

  const renderGroup = (group: SidebarGroup) => {
    const isGroupActive = group.items.some((item) => item.key === active);
    const isExpanded = group.collapsible ? expanded[group.id] : true;

    return (
      <div key={group.id} className="space-y-0.5">
        {group.collapsible ? (
          <button
            type="button"
            onClick={() => toggleGroup(group.id)}
            className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider transition-colors rounded-lg ${
              isGroupActive
                ? 'text-primary font-bold'
                : 'text-theme-muted hover:bg-white/[0.08] dark:hover:bg-white/5 hover:text-theme'
            }`}
          >
            <span>{group.label}</span>
            <span aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
          </button>
        ) : (
          <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-theme-muted">
            {group.label}
          </div>
        )}

        {isExpanded ? (
          <div
            className={
              group.collapsible
                ? 'ml-2 space-y-0.5 border-l border-[color:var(--border-default)]/30 pl-1'
                : 'space-y-0.5'
            }
          >
            {group.items.map(({ key, label, path, icon, danger }) => {
              const isActive = active === key;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => handleSelect(key, path)}
                  className={`flex w-full items-center gap-2.5 rounded-xl py-2 text-left text-[11px] leading-snug transition-all duration-150 md:text-sm ${
                    group.collapsible
                      ? 'pl-2.5 pr-2 md:pl-4 md:pr-3'
                      : 'px-2.5 md:px-3.5'
                  } ${
                    isActive
                      ? 'bg-purple-500/15 font-bold text-purple-700 dark:text-purple-300'
                      : danger
                        ? 'text-red-500 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300'
                        : 'text-theme-secondary hover:bg-white/[0.08] dark:hover:bg-white/5 hover:text-theme'
                  }`}
                >
                  <span
                    className="shrink-0 text-sm md:text-base"
                    aria-hidden="true"
                  >
                    {icon}
                  </span>
                  <span className={`min-w-0 font-medium whitespace-nowrap leading-tight transition-all ${
                    label.length > 18 || sidebarWidth < 210
                      ? 'text-[10px] sm:text-[11px]'
                      : label.length > 14 || sidebarWidth < 250
                        ? 'text-[11px] sm:text-xs'
                        : 'text-xs sm:text-sm'
                  }`}>{label}</span>
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
      <h2 className="mb-2 px-3 text-sm font-bold text-theme md:mb-4 md:px-4 md:text-xl">
        Settings
      </h2>
      <nav className="space-y-1">
        {visibleGroups.map((group, index) => (
          <React.Fragment key={group.id}>
            {index > 0 ? (
              <div className="mx-3 my-2.5 border-t border-[color:var(--border-default)]/40" />
            ) : null}
            {renderGroup(group)}
          </React.Fragment>
        ))}
      </nav>
    </div>
  );

  return (
    // Resizable responsive fixed sidebar with persistent width & zero text truncation
    <aside
      style={{ width: `var(--settings-sidebar-width, ${sidebarWidth}px)` }}
      className={`fixed left-0 top-16 z-20 block h-[calc(100vh-64px)] overflow-y-auto border-r border-border/40 bg-surface-primary text-theme scrollbar-hide px-1 md:px-2 ${isDragging ? 'transition-none select-none' : 'transition-[width] duration-75'}`}
    >
      {sidebarContent}
      {/* Resizable right-border drag handle — invisible touch area, zero purple activator */}
      <div
        onMouseDown={handleDragStart}
        className="absolute -right-1 top-0 bottom-0 w-2.5 cursor-col-resize z-30 bg-transparent select-none"
        title="Drag to resize sidebar width"
        aria-label="Drag to resize sidebar width"
      />
    </aside>
  );
};

export default SettingsSidebar;
