import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@/store';
import { closeSidebar } from '@/features/uiSlice';

interface NavItem {
  key: string;
  label: string;
  path: string;
  emoji: string;
  permission?: string;
  superAdminOnly?: boolean;
}

const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', path: '/admin', emoji: '📊' },
  { key: 'custom-orders', label: 'Custom Orders', path: '/admin/custom-orders', emoji: '✂️', permission: 'MODERATION_READ' },
  { key: 'users', label: 'Users', path: '/admin/users', emoji: '👤', permission: 'USERS_READ' },
  { key: 'brands', label: 'Brands', path: '/admin/brands', emoji: '🏷️', permission: 'BRANDS_READ' },
  { key: 'verification', label: 'Verification', path: '/admin/verification', emoji: '🪪', permission: 'BRANDS_VERIFY' },
  { key: 'content', label: 'Content Management', path: '/admin/content', emoji: '🧰' },
  { key: 'charts', label: 'Charts', path: '/admin/measurements', emoji: '📐', permission: 'MEASUREMENTS_READ' },
  { key: 'configurations', label: 'Configurations', path: '/admin/taxonomy', emoji: '🧬', permission: 'TAXONOMY_READ' },
  { key: 'tags', label: 'Tags', path: '/admin/tags', emoji: '🏷️', permission: 'TAGS_READ' },
  { key: 'payouts', label: 'Payouts', path: '/admin/payouts', emoji: '💰', permission: 'PAYOUTS_READ' },
  { key: 'disputes', label: 'Disputes', path: '/admin/disputes', emoji: '⚖️', permission: 'DISPUTES_READ' },
  { key: 'moderation', label: 'Moderation', path: '/admin/moderation', emoji: '🛡️', permission: 'MODERATION_READ' },
  { key: 'audit', label: 'Audit', path: '/admin/audit', emoji: '📋', permission: 'AUDIT_READ' },
  { key: 'settings', label: 'Settings', path: '/admin/settings', emoji: '⚙️', superAdminOnly: true },
];

const AdminSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission, isSuperAdmin } = useAdminPermissions();
  const dispatch = useDispatch<AppDispatch>();

  const visibleItems = navItems.filter((item) => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    if (item.permission && !hasPermission(item.permission)) return false;
    return true;
  });

  const getIsActive = (item: NavItem) => {
    if (item.path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(item.path);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    dispatch(closeSidebar());
  };

  return (
    <>
      <aside className="fixed left-0 top-16 z-20 hidden h-[calc(100vh-64px)] w-[200px] overflow-y-auto bg-transparent scrollbar-hide [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:block">
        <div className="relative z-10 px-2 py-4">
          <div className="mb-4 px-3">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
              Admin
            </h2>
          </div>

          <nav className="space-y-0.5">
            {visibleItems.map((item) => {
              const isActive = getIsActive(item);
              return (
                <button
                  key={item.key}
                  onClick={() => navigate(item.path)}
                  className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-all duration-150 ${
                    isActive
                      ? 'border-l-3 border-purple-500 bg-[linear-gradient(90deg,rgba(217,70,239,0.14),rgba(255,255,255,0.05))] font-semibold text-purple-700 dark:bg-[linear-gradient(90deg,rgba(168,85,247,0.2),rgba(255,255,255,0.03))] dark:text-purple-200'
                      : 'text-gray-700 hover:bg-white/30 dark:text-gray-300 dark:hover:bg-white/6'
                  }`}
                >
                  <span className="text-base">{item.emoji}</span>
                  <span className="text-[13px]">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Mobile Bottom Dock */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200/70 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 shadow-[0_-6px_18px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-black/85 md:hidden">
        <div className="flex w-full items-stretch gap-1 overflow-x-auto scrollbar-hide [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleItems.map((item) => {
            const isActive = getIsActive(item);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNavigate(item.path)}
                className={`flex min-w-[72px] shrink-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10'
                }`}
                aria-label={item.label}
              >
                <span className="text-lg leading-none">{item.emoji}</span>
                <span className="truncate w-full text-center">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default AdminSidebar;
