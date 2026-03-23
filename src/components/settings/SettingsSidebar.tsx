import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ChevronDown,
  ChevronRight,
  Settings,
  CheckCircle,
  Shield,
  Wallet,
  Users,
  Bell,
  AlertTriangle,
  User,
  Lock,
  Eye,
  Ruler,
  EyeOff,
  ShieldCheck,
  CreditCard,
  FileText,
  Link2,
  Store,
  Menu,
  X,
} from 'lucide-react';
import type { RootState } from '@/store';

interface SidebarItem {
  key: string;
  label: string;
  path: string;
  icon: React.FC<{ className?: string }>;
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
      { key: 'account', label: 'Account', path: '/settings?tab=account', icon: User, description: 'Profile, name, email' },
      { key: 'security', label: 'Security', path: '/settings?tab=security', icon: Lock, description: 'Password, login' },
      { key: 'notifications', label: 'Notifications', path: '/settings?tab=notifications', icon: Bell, description: 'Email & push alerts' },
      { key: 'privacy', label: 'Privacy', path: '/settings?tab=privacy', icon: ShieldCheck, description: 'Data & visibility' },
      { key: 'profile-visibility', label: 'Profile Visibility', path: '/settings?tab=profile-visibility', icon: Eye, description: 'Who can see your profile' },
      { key: 'size-fits', label: 'Size & Fittings', path: '/settings?tab=size-fits', icon: Ruler, description: 'Body measurements' },
      { key: 'hidden-content', label: 'Hidden Content', path: '/settings?tab=hidden-content', icon: EyeOff, description: 'Manage hidden items' },
      { key: 'billing', label: 'Billing & Payments', path: '/settings?tab=billing', icon: CreditCard, description: 'Invoices & methods' },
    ],
  },
  {
    id: 'brand',
    label: 'Brand',
    collapsible: true,
    items: [
      { key: 'patches', label: 'Brand Patches', path: '/settings?tab=patches', icon: CheckCircle, description: 'Manage patch followers' },
      { key: 'subscriptions', label: 'Subscriptions', path: '/settings?tab=subscriptions', icon: Users, description: 'Your subscribers' },
    ],
  },
  {
    id: 'studio',
    label: 'Studio',
    collapsible: true,
    brandOnly: true,
    items: [
      { key: 'store-general', label: 'General', path: '/settings?tab=store-general', icon: Settings, description: 'Store name, bio, logo' },
      { key: 'store-social', label: 'Social & Links', path: '/settings?tab=store-social', icon: Link2, description: 'Social links, verification' },
      { key: 'store-policies', label: 'Policies', path: '/settings?tab=store-policies', icon: FileText, description: 'Return, shipping, terms' },
      { key: 'store-payments', label: 'Payments & Payouts', path: '/settings?tab=store-payments', icon: Wallet, description: 'Payout methods' },
      { key: 'store-team', label: 'Team Members', path: '/settings?tab=store-team', icon: Users, description: 'Manage access' },
      { key: 'store-notifications', label: 'Store Notifications', path: '/settings?tab=store-notifications', icon: Bell, description: 'Order & store alerts' },
      { key: 'store-danger', label: 'Danger Zone', path: '/settings?tab=store-danger', icon: AlertTriangle, danger: true, description: 'Close or delete store' },
    ],
  },
];

interface SettingsSidebarProps {
  active: string;
  onSelect: (key: string) => void;
}

/** Find which group a given tab key belongs to */
export function getGroupForKey(key: string): SidebarGroup | undefined {
  return sidebarGroups.find((g) => g.items.some((i) => i.key === key));
}

/** Find the item for a given tab key */
export function getItemForKey(key: string): SidebarItem | undefined {
  for (const g of sidebarGroups) {
    const item = g.items.find((i) => i.key === key);
    if (item) return item;
  }
  return undefined;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ active, onSelect }) => {
  const navigate = useNavigate();
  const me = useSelector((s: RootState) => s.user.profile);
  const isBrandUser = me?.type === 'BRAND';
  const [mobileOpen, setMobileOpen] = useState(false);

  // Track which collapsible groups are expanded
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const group of sidebarGroups) {
      if (group.collapsible) {
        init[group.id] = group.items.some((i) => i.key === active);
      }
    }
    return init;
  });

  const toggleGroup = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelect = (key: string, path: string) => {
    onSelect(key);
    navigate(path);
    setMobileOpen(false);
  };

  const visibleGroups = sidebarGroups.filter(
    (g) => !g.brandOnly || isBrandUser,
  );

  const renderGroup = (group: SidebarGroup) => {
    const isGroupActive = group.items.some((i) => i.key === active);
    const isExpanded = group.collapsible ? expanded[group.id] : true;

    return (
      <div key={group.id}>
        {group.collapsible ? (
          <button
            onClick={() => toggleGroup(group.id)}
            className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center justify-between transition-colors uppercase tracking-wider ${
              isGroupActive
                ? 'text-purple-600 dark:text-purple-400 bg-purple-500/10'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
          >
            <span>{group.label}</span>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {group.label}
          </div>
        )}

        {isExpanded && (
          <div className={group.collapsible ? 'ml-2 border-l border-gray-200 dark:border-white/10' : ''}>
            {group.items.map(({ key, label, path, icon: Icon, danger }) => {
              const isActive = active === key;
              return (
                <button
                  key={key}
                  onClick={() => handleSelect(key, path)}
                  className={`w-full text-left ${group.collapsible ? 'pl-6 pr-4' : 'px-4'} py-2 text-sm flex items-center gap-2.5 transition-colors ${
                    isActive
                      ? 'font-medium text-primary border-l-[3px] border-primary bg-primary/10 -ml-[1px]'
                      : danger
                        ? 'text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-500/10'
                        : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const sidebarContent = (
    <div className="py-4">
      <h2 className="px-4 text-xl font-semibold text-gray-900 dark:text-white mb-4">Settings</h2>
      <nav className="space-y-1">
        {visibleGroups.map((group, idx) => (
          <React.Fragment key={group.id}>
            {idx > 0 && (
              <div className="border-t border-gray-200 dark:border-white/5 my-3 mx-4" />
            )}
            {renderGroup(group)}
          </React.Fragment>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed bottom-4 right-4 z-30 p-3 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-colors"
        aria-label="Open settings menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-[280px] bg-white dark:bg-zinc-900 shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-4 pt-4">
              <span className="text-lg font-semibold text-gray-900 dark:text-white">Settings</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:block fixed left-0 top-16 h-[calc(100vh-64px)] w-[240px] z-20 overflow-y-auto scrollbar-hide border-r border-gray-200 dark:border-white/5 bg-white dark:bg-zinc-900">
        {sidebarContent}
      </aside>
    </>
  );
};

export default SettingsSidebar;
