import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import OrderManagement from '@/pages/dashboard/OrderManagement';
import CustomOrdersPage from '@/pages/studio/CustomOrdersPage';
import Tabs from '@/components/Tabs';

type OrderTab = 'standard' | 'custom';

const TAB_KEYS: OrderTab[] = ['standard', 'custom'];

/*
  Short on a phone, full once there is room.

  "Standard Orders" and "Custom Orders" are two of the longest labels in the
  Studio, and the underline indicator measures the LABEL rather than the button,
  so a label that wraps takes the indicator with it. At 360px the two full
  labels do not sit side by side; the nouns alone do, and the icon already
  carries the distinction.
*/
const TAB_LABELS: Record<OrderTab, React.ReactNode> = {
  standard: (
    <>
      <span className="sm:hidden">Standard</span>
      <span className="hidden sm:inline">Standard Orders</span>
    </>
  ),
  custom: (
    <>
      <span className="sm:hidden">Custom</span>
      <span className="hidden sm:inline">Custom Orders</span>
    </>
  ),
};

const TAB_ICONS: Record<OrderTab, React.ReactNode> = {
  standard: '📦',
  custom: '✂️',
};

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
      {/*
        Tab bar — an underline, not a filled pill.

        The pill carried its own background and its own radius, so switching
        tabs meant a solid purple block jumping between two shapes with nothing
        connecting them. `Tabs` is the app's shared strip: the active tab is
        marked by a rule under the label and the rule SLIDES between them, so
        the change of state is one continuous movement rather than two
        repaints. It measures the label, so the underline is the width of the
        word rather than the width of the button.
      */}
      <div className="sticky top-0 z-10 bg-white/90 px-2 pt-1 backdrop-blur-md dark:bg-zinc-950/90 sm:px-6">
        <Tabs
          tabs={TAB_KEYS}
          labels={TAB_LABELS}
          icons={TAB_ICONS}
          activeTab={activeTab}
          onTabChange={(tab) => handleTabChange(tab as OrderTab)}
          ariaLabel="Order types"
        />
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
