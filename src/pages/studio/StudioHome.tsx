import React from 'react';
import { useSearchParams } from 'react-router-dom';
import StudioScaffold from '@/components/studio/StudioScaffold';
import DashboardHome from '@/pages/dashboard/DashboardHome';
import OrderManagement from '@/pages/dashboard/OrderManagement';
import AnalyticsPage from '@/pages/dashboard/AnalyticsPage';
import FinancePage from '@/pages/dashboard/FinancePage';
import CustomersPage from '@/pages/dashboard/CustomersPage';
import StoreManagement from '@/pages/studio/store/StoreManagement';
import MessagingManagementPage from '@/pages/messages/MessagingManagementPage';

const sections: Record<string, React.ReactNode> = {
  overview: <DashboardHome />,
  store: <StoreManagement />,
  orders: <OrderManagement />,
  messages: <MessagingManagementPage />,
  customers: <CustomersPage />,
  analytics: <AnalyticsPage />,
  finance: <FinancePage />,
};

const StudioHome: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('tab') || 'overview';
  const active = raw === 'shop' || raw === 'products' ? 'store' : raw;

  const setActive = (key: string) => {
    setSearchParams({ tab: key });
  };

  return (
    <StudioScaffold active={active} onSelect={setActive}>
      {sections[active] || sections['overview']}
    </StudioScaffold>
  );
};

export default StudioHome;
