import React from 'react';
import { useSearchParams } from 'react-router-dom';
import StudioSidebar from '@/components/studio/StudioSidebar';
import DashboardHome from '@/pages/dashboard/DashboardHome';
import OrderManagement from '@/pages/dashboard/OrderManagement';
import AnalyticsPage from '@/pages/dashboard/AnalyticsPage';
import FinancePage from '@/pages/dashboard/FinancePage';
import SettingsPage from '@/pages/dashboard/SettingsPage';

const sections: Record<string, React.ReactNode> = {
  overview: <DashboardHome />,
  orders: <OrderManagement />,
  analytics: <AnalyticsPage />,
  finance: <FinancePage />,
  settings: <SettingsPage />,
};

const StudioHome: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = searchParams.get('tab') || 'overview';

  const setActive = (key: string) => {
    setSearchParams({ tab: key });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#000000]">
      {/* Local studio sidebar with its own panel */}
      <StudioSidebar active={active} onSelect={setActive} />

      {/* Content area shifts for the studio sidebar + global collapsed rail */}
      <div className="min-h-screen pb-10 px-4 md:pl-[300px] pt-20">
        <div className="max-w-6xl mx-auto">
          {sections[active] || sections['overview']}
        </div>
      </div>
    </div>
  );
};

export default StudioHome;
