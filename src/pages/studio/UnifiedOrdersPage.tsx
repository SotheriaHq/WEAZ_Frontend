import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import OrderManagement from '@/pages/dashboard/OrderManagement';
import CustomOrdersPage from '@/pages/studio/CustomOrdersPage';

type OrderTab = 'standard' | 'custom';

const TABS: { key: OrderTab; label: string; icon: string }[] = [
  { key: 'standard', label: 'Standard Orders', icon: '📦' },
  { key: 'custom', label: 'Custom Orders', icon: '✂️' },
];

const UnifiedOrdersPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramSub = searchParams.get('orderTab');
  const [activeTab, setActiveTab] = useState<OrderTab>(
    paramSub === 'custom' ? 'custom' : 'standard',
  );

  const handleTabChange = (tab: OrderTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'orders');
    if (tab === 'custom') {
      params.set('orderTab', 'custom');
    } else {
      params.delete('orderTab');
    }
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-0">
      {/* Tab bar */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-gray-200/50 dark:border-white/10">
        <div className="flex items-center gap-1 px-4 py-2 sm:px-6">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'standard' ? (
          <OrderManagement />
        ) : (
          <CustomOrdersPage />
        )}
      </div>
    </div>
  );
};

export default UnifiedOrdersPage;
