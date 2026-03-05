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
    <aside className="hidden md:block fixed left-0 top-16 h-[calc(100vh-64px)] w-[200px] z-20 overflow-y-auto scrollbar-hide border-r border-purple-200/30 dark:border-white/10 bg-gradient-to-b from-[#faf8ff]/90 to-[#f5f0ff]/80 dark:from-[#0f0f0f]/95 dark:to-[#0a0a0a]/90 backdrop-blur-xl">
      <div className="py-4 px-2">
        <div className="px-3 mb-4">
          <h2 className="text-sm font-bold text-black dark:text-white uppercase tracking-wider">Admin</h2>
        </div>

        <nav className="space-y-1">
          {visibleItems.map((item) => {
            const isActive = getIsActive(item);
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.path)}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-150 flex items-center gap-2 group ${
                  isActive
                    ? 'font-medium text-primary border-l-4 border-primary bg-primary/10'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span className="text-base">{item.emoji}</span>
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};

export default AdminSidebar;
