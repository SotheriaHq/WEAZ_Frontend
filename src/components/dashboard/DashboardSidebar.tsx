import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface DashboardSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ isOpen, onClose }) => {
  const navItems = [
    { to: '/dashboard/overview', emoji: '📊', label: 'Overview' },
    { to: '/dashboard/orders', emoji: '📦', label: 'Orders' },
    { to: '/dashboard/analytics', emoji: '📈', label: 'Analytics' },
    { to: '/dashboard/finance', emoji: '💰', label: 'Finance' },
    { to: '/dashboard/settings', emoji: '⚙️', label: 'Settings' },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-screen bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 transition-transform duration-300 ease-in-out w-64 lg:translate-x-0 lg:w-20 lg:hover:w-64 group",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center justify-center border-b border-gray-200 dark:border-gray-800">
          <span className="text-2xl font-bold">🧵</span>
          <span className="ml-3 font-bold text-xl hidden group-hover:block whitespace-nowrap lg:hidden lg:group-hover:block">
            Threadly
          </span>
        </div>

        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                "flex items-center p-3 rounded-xl transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-900/50",
                isActive && "bg-black text-white dark:bg-white dark:text-black shadow-lg"
              )}
              onClick={() => window.innerWidth < 1024 && onClose()}
            >
              <span className="text-2xl min-w-[2rem] text-center">{item.emoji}</span>
              <span className="ml-3 font-medium hidden group-hover:block whitespace-nowrap lg:hidden lg:group-hover:block opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};
