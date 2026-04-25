import React from 'react';
// Fixed: Removed unused Button import to resolve named export error

import { Menu } from 'lucide-react';

interface DashboardHeaderProps {
  onMenuClick: () => void;
  currency: 'NGN' | 'USD';
  onCurrencyChange: (currency: 'NGN' | 'USD') => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ 
  onMenuClick, 
  currency, 
  onCurrencyChange 
}) => {
  return (
    <header className="h-16 fixed top-0 right-0 left-0 lg:left-20 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 z-30 px-4 flex items-center justify-between transition-[left] duration-300">
      <div className="flex items-center">
        <button 
          onClick={onMenuClick}
          className="p-2 -ml-2 mr-2 lg:hidden hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold hidden sm:block">Brand Dashboard</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center bg-gray-100 dark:bg-gray-900 rounded-lg p-1">
          <button
            onClick={() => onCurrencyChange('NGN')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
              currency === 'NGN' 
                ? 'bg-white dark:bg-gray-800 shadow-sm' 
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            🇳🇬 NGN
          </button>
          <button
            onClick={() => onCurrencyChange('USD')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
              currency === 'USD' 
                ? 'bg-white dark:bg-gray-800 shadow-sm' 
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            🇺🇸 USD
          </button>
        </div>
        
        {/* User Menu or other actions could go here */}
      </div>
    </header>
  );
};
