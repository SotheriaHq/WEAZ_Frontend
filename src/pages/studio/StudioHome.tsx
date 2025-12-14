import React from 'react';
import { useSearchParams } from 'react-router-dom';
import StudioSidebar from '@/components/studio/StudioSidebar';
import { Navbar } from '@/components/Navbar';
import SideBar from '@/components/SideBar';
import DashboardHome from '@/pages/dashboard/DashboardHome';
import OrderManagement from '@/pages/dashboard/OrderManagement';
import AnalyticsPage from '@/pages/dashboard/AnalyticsPage';
import FinancePage from '@/pages/dashboard/FinancePage';
import ProductsPage from '@/pages/dashboard/ProductsPage';
import CustomersPage from '@/pages/dashboard/CustomersPage';

const sections: Record<string, React.ReactNode> = {
  overview: <DashboardHome />,
  products: <ProductsPage />,
  orders: <OrderManagement />,
  customers: <CustomersPage />,
  analytics: <AnalyticsPage />,
  finance: <FinancePage />,
};

const StudioHome: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = searchParams.get('tab') || 'overview';

  const setActive = (key: string) => {
    setSearchParams({ tab: key });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#000000]">
      {/* Navbar */}
      <Navbar minimal={false} />
      
      {/* Global Sidebar (Overlay) */}
      <SideBar />
      
      {/* Local studio sidebar with its own panel */}
      <StudioSidebar active={active} onSelect={setActive} />

      {/* Content area shifts for the studio sidebar */}
      <div className="min-h-screen pb-10 px-4 md:pl-[220px] pt-20">
        <div className="max-w-6xl mx-auto">
          {sections[active] || sections['overview']}
        </div>
      </div>
    </div>
  );
};

export default StudioHome;
