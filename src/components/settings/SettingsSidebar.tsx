import React, { useState, useEffect, useRef } from 'react';
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
      {
        key: 'account-security',
        label: 'Account & Security',
        path: '/settings?tab=account-security',
        icon: '👤',
        description: 'Email, password, devices',
      },
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
        key: 'privacy',
        label: 'Privacy',
        path: '/settings?tab=privacy',
        icon: '🛡️',
        description: 'Data & visibility',
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
      { key: 'store-category-requests', label: 'Category requests', path: '/settings?tab=store-category-requests', icon: '📝', description: 'Request and track category approval' },
      {
        key: 'store-customers', label: 'Customers', path: '/settings?tab=store-customers',
        icon: '👥', description: 'Customer purchase threshold · paid plans',
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
      },
      {
        key: 'store-hours',
        label: 'Working Hours',
        path: '/settings?tab=store-hours',
        icon: '🕒',
        description: 'Days & hours you operate',
      },
      {
        key: 'store-social',
        label: 'Social & Links',
        path: '/settings?tab=store-social',
        icon: '🔗',
        description: 'Social links, verification',
      },
      {
        key: 'store-policies',
        label: 'Policies',
        path: '/settings?tab=store-policies',
        icon: '📄',
        description: 'Return, shipping, terms',
      },
      {
        key: 'store-team',
        label: 'Team Members',
        path: '/settings?tab=store-team',
        icon: '👥',
        description: 'Manage access',
      },
      {
        key: 'store-notifications',
        label: 'Store Notifications',
        path: '/settings?tab=store-notifications',
        icon: '🔔',
        description: 'Order & store alerts',
      },
      {
        key: 'store-danger',
        label: 'Danger Zone',
        path: '/settings?tab=store-danger',
        icon: '⚠️',
        danger: true,
        description: 'Close or delete store',
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

  useEffect(() => {
    document.documentElement.style.setProperty('--settings-sidebar-width', `${sidebarWidth}px`);
  }, [sidebarWidth]);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
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
                      ? 'bg-[linear-gradient(90deg,rgba(217,70,239,0.12),rgba(255,255,255,0.12))] font-semibold text-gray-900 dark:bg-[linear-gradient(90deg,rgba(168,85,247,0.18),rgba(255,255,255,0.04))] dark:text-white neu-pressed-button'
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
                  <span className={`min-w-0 break-words text-wrap leading-tight ${sidebarWidth < 200 ? "text-[11px]" : sidebarWidth < 260 ? "text-xs" : "text-sm"}`}>{label}</span>
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
      className="fixed left-0 top-16 z-20 block h-[calc(100vh-64px)] overflow-y-auto border-r border-[color:var(--border-default)]/30 bg-[color:var(--surface-primary,#ffffff)] dark:bg-[color:var(--surface-primary,#12111a)] scrollbar-hide px-1 md:px-2 transition-[width] duration-75"
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
