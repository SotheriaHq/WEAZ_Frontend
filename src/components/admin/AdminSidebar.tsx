import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';

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
  { key: 'users', label: 'Users', path: '/admin/users', emoji: '👤', permission: 'USERS_READ' },
  { key: 'brands', label: 'Brands', path: '/admin/brands', emoji: '🏷️', permission: 'BRANDS_READ' },
  { key: 'verification', label: 'Verification', path: '/admin/verification', emoji: '🪪', permission: 'BRANDS_VERIFY' },
  { key: 'products', label: 'Products', path: '/admin/products', emoji: '📦', permission: 'PRODUCTS_READ' },
  { key: 'collections', label: 'Collections', path: '/admin/collections', emoji: '🗂️', permission: 'COLLECTIONS_READ' },
  { key: 'taxonomy', label: 'Taxonomy', path: '/admin/taxonomy', emoji: '🧬', permission: 'TAXONOMY_READ' },
  { key: 'tags', label: 'Tags', path: '/admin/tags', emoji: '🏷️', permission: 'TAGS_READ' },
  { key: 'measurements', label: 'Measurements', path: '/admin/measurements', emoji: '📐', permission: 'MEASUREMENTS_READ' },
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

  return (
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
  );
};

export default AdminSidebar;
