import React from 'react';
import { useSearchParams } from 'react-router-dom';
import StudioScaffold from '@/components/studio/StudioScaffold';
import DashboardHome from '@/pages/dashboard/DashboardHome';
import UnifiedOrdersPage from '@/pages/studio/UnifiedOrdersPage';
import AnalyticsPage from '@/pages/dashboard/AnalyticsPage';
import FinancePage from '@/pages/dashboard/FinancePage';
import CustomersPage from '@/pages/dashboard/CustomersPage';
import StoreManagement from '@/pages/studio/store/StoreManagement';
import MessagingManagementPage from '@/pages/messages/MessagingManagementPage';
import BrandReviewsDashboardPage from '@/pages/studio/BrandReviewsDashboardPage';

const sections: Record<string, React.ReactNode> = {
  overview: <DashboardHome />,
  store: <StoreManagement />,
  orders: <UnifiedOrdersPage />,
  messages: <MessagingManagementPage />,
  reviews: <BrandReviewsDashboardPage />,
  customers: <CustomersPage />,
  analytics: <AnalyticsPage />,
  finance: <FinancePage />,
};

const StudioHome: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('tab') || 'overview';
  const active = raw === 'shop' || raw === 'products' ? 'store' : raw;

  const setActive = (key: string) => {
    // Tab switches are UI state — replace so mobile back doesn't replay them.
    // Preserve existing params (especially `surface=mobile-app`). Replacing
    // the whole search with `{ tab }` dropped the embedded marker, which
    // unregistered the native nav bridge and made the next dock tap reload
    // the document.
    const next = new URLSearchParams(searchParams);
    next.set('tab', key);
    setSearchParams(next, { replace: true });
  };

  const activeKey = sections[active] ? active : 'overview';

  /*
    Visited sections stay mounted; only the active one is shown.

    Rendering just `sections[active]` unmounted a section the moment the
    island or sidebar left it, so coming back rebuilt it from nothing —
    skeletons, refetches, scroll lost — for content the brand had just been
    looking at ("routing back to Studio still reloads what I've seen",
    2026-10-17). Hidden sections keep their DOM and state, so a return is
    instant. React 19.1 has no <Activity>; `display: none` is the stand-in.
    Sections mount lazily on first visit, so a cold Studio costs no more
    than before.
  */
  const [visited, setVisited] = React.useState<string[]>(() => [activeKey]);
  if (!visited.includes(activeKey)) {
    setVisited([...visited, activeKey]);
  }

  return (
    <StudioScaffold active={active} onSelect={setActive}>
      {visited.map((key) => (
        <div key={key} style={key === activeKey ? undefined : { display: 'none' }} aria-hidden={key !== activeKey}>
          {sections[key]}
        </div>
      ))}
    </StudioScaffold>
  );
};

export default StudioHome;
