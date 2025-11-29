import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import SettingsSidebar from '@/components/settings/SettingsSidebar';
import BrandProfileSettings from '@/components/settings/tabs/BrandProfileSettings';
import PatchesSettings from '@/components/settings/tabs/PatchesSettings';
import SubscriptionsSettings from '@/components/settings/tabs/SubscriptionsSettings';
import AccountSettings from '@/components/settings/tabs/AccountSettings';
import NotificationSettings from '@/components/settings/tabs/NotificationSettings';

const sections: Record<string, React.ReactNode> = {
  'brand-profile': <BrandProfileSettings />,
  patches: <PatchesSettings />,
  subscriptions: <SubscriptionsSettings />,
  account: <AccountSettings />,
  notifications: <NotificationSettings />,
  privacy: (
    <>
      <h1 className="text-2xl font-semibold mb-2">Privacy</h1>
      <p className="text-gray-600 dark:text-gray-400">Manage your privacy settings.</p>
    </>
  ),
  billing: (
    <>
      <h1 className="text-2xl font-semibold mb-2">Billing & payments</h1>
      <p className="text-gray-600 dark:text-gray-400">No invoices yet.</p>
    </>
  ),
  advanced: (
    <>
      <h1 className="text-2xl font-semibold mb-2">Advanced settings</h1>
      <p className="text-gray-600 dark:text-gray-400">Coming soon.</p>
    </>
  ),
};

const SettingsHome: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = searchParams.get('tab') || 'brand-profile';

  const setActive = (key: string) => {
    setSearchParams({ tab: key });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Local settings sidebar with its own panel */}
      <SettingsSidebar active={active} onSelect={setActive} />

      {/* Content area shifts for the settings sidebar + global collapsed rail */}
      <div className="min-h-screen pt-16 pb-10 px-4 md:pl-[300px] lg:pl-[344px]">
        <div className="max-w-4xl mx-auto">
          {sections[active]}
        </div>
      </div>
    </div>
  );
};

export default SettingsHome;
