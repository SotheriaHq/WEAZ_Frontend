import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@/store';
import { closeSidebar } from '@/features/uiSlice';
import IslandBottomNav from '@/components/navigation/IslandBottomNav';
import {
  ADMIN_NAV_ITEMS,
  canAccessAdminPath,
  type AdminNavItem,
} from '@/components/admin/adminNavigation';

const AdminSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission, isSuperAdmin } = useAdminPermissions();
  const dispatch = useDispatch<AppDispatch>();

  const access = useMemo(
    () => ({ hasPermission, isSuperAdmin }),
    [hasPermission, isSuperAdmin],
  );

  // Requirements come from the shared route table, so the sidebar cannot offer
  // a destination the router will bounce the admin straight back out of.
  const visibleItems = useMemo(
    () => ADMIN_NAV_ITEMS.filter((item) => canAccessAdminPath(item.path, access)),
    [access],
  );

  const getIsActive = (item: AdminNavItem) => {
    const path = item.path.split('?')[0];
    if (item.path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  const handleNavigate = (path: string, options?: { replace?: boolean }) => {
    navigate(path, options);
    dispatch(closeSidebar());
  };

  return (
    <>
      <aside className="fixed left-0 top-16 z-20 hidden h-[calc(100vh-64px)] w-[200px] overflow-y-auto bg-transparent scrollbar-hide [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:block">
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
                      : 'text-gray-700 hover:bg-white/30 dark:text-gray-300 dark:hover:bg-white/[0.06]'
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

      <IslandBottomNav
        ariaLabel="Admin navigation"
        maxWidthClassName="max-w-[560px]"
        items={visibleItems.map((item) => ({
          key: item.key,
          label: item.label,
          path: item.path,
          emoji: item.emoji,
          active: getIsActive(item),
        }))}
        onSelect={(item) => handleNavigate(item.path, { replace: true })}
      />
    </>
  );
};

export default AdminSidebar;
