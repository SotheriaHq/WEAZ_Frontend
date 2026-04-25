import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';

export const DashboardLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-gray-100">
      <DashboardSidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      
      <DashboardHeader 
        onMenuClick={() => setIsSidebarOpen(true)}
        currency={currency}
        onCurrencyChange={setCurrency}
      />

      <main className="pt-20 pb-8 px-4 lg:pl-24 transition-[padding] duration-300">
        <div className="max-w-7xl mx-auto">
          {/* Pass currency context to children via Outlet context if needed, 
              or use a real context provider. For now, we assume pages fetch their own data 
              or we pass it down if we were using direct components. 
              With Outlet, we can use useOutletContext. */}
          <Outlet context={{ currency }} />
        </div>
      </main>
    </div>
  );
};
