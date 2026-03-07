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
    <aside className="hidden md:block fixed left-0 top-16 h-[calc(100vh-64px)] w-[200px] z-20 overflow-y-auto scrollbar-hide border-r border-white/30 dark:border-white/10 bg-white/95 dark:bg-gray-950 backdrop-blur-xl shadow-lg">
      {/* Gradient overlay matching profile dropdown */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-purple-400/5 to-transparent opacity-40 pointer-events-none" />

      <div className="relative z-10 py-4 px-2">
        <div className="px-3 mb-4">
          <h2 className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Admin</h2>
        </div>

        <nav className="space-y-0.5">
          {visibleItems.map((item) => {
            const isActive = getIsActive(item);
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.path)}
                className={`w-full text-left px-3 py-2 text-sm rounded-xl transition-all duration-150 flex items-center gap-2.5 group ${
                  isActive
                    ? 'font-semibold text-purple-700 dark:text-purple-300 bg-purple-500/10 dark:bg-purple-500/15 border-l-3 border-purple-500'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-purple-500/5 dark:hover:bg-white/5'
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
