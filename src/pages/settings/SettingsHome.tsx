import React from 'react';
import { useSearchParams } from 'react-router-dom';
import SettingsSidebar from '@/components/settings/SettingsSidebar';
import SecuritySettings from '@/components/settings/tabs/SecuritySettings';
import PatchesSettings from '@/components/settings/tabs/PatchesSettings';
import SubscriptionsSettings from '@/components/settings/tabs/SubscriptionsSettings';
import AccountSettings from '@/components/settings/tabs/AccountSettings';
import NotificationSettings from '@/components/settings/tabs/NotificationSettings';
import StoreGeneralSettings from '@/components/settings/tabs/StoreGeneralSettings';
import HiddenContentSettings from './HiddenContentSettings';

const sections: Record<string, React.ReactNode> = {
  security: <SecuritySettings />,
  patches: <PatchesSettings />,
  subscriptions: <SubscriptionsSettings />,
  account: <AccountSettings />,
  notifications: <NotificationSettings />,
  'hidden-content': <HiddenContentSettings />,
  'store-general': <StoreGeneralSettings />,
  'store-social': (
    <>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Social & Verification</h1>
      <p className="text-gray-500 dark:text-gray-400">Manage your store's social links and verification status.</p>
    </>
  ),
  'store-policies': (
    <>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Store Policies</h1>
      <p className="text-gray-500 dark:text-gray-400">Configure shipping, returns, and other policies.</p>
    </>
  ),
  'store-payments': (
    <>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Payments & Payouts</h1>
      <p className="text-gray-500 dark:text-gray-400">Manage your payment methods and payout settings.</p>
    </>
  ),
  'store-team': (
    <>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Team Members</h1>
      <p className="text-gray-500 dark:text-gray-400">Manage who has access to your store settings.</p>
    </>
  ),
  'store-notifications': (
    <>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Store Notifications</h1>
      <p className="text-gray-500 dark:text-gray-400">Configure notification preferences for your store.</p>
    </>
  ),
  'store-danger': (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-2">Danger Zone</h1>
      <p className="text-gray-500 dark:text-gray-400">Irreversible actions for your store.</p>
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
        <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">Close Store</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Permanently close your store. This action cannot be undone.
        </p>
        <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">
          Close Store
        </button>
      </div>
    </div>
  ),
  privacy: (
    <>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Privacy</h1>
      <p className="text-gray-500 dark:text-gray-400">Manage your privacy settings.</p>
    </>
  ),
  billing: (
    <>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Billing & payments</h1>
      <p className="text-gray-500 dark:text-gray-400">No invoices yet.</p>
    </>
  ),
  advanced: (
    <>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Advanced settings</h1>
      <p className="text-gray-500 dark:text-gray-400">Coming soon.</p>
    </>
  ),
};

const SettingsHome: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = searchParams.get('tab') || 'account';

  const setActive = (key: string) => {
    setSearchParams({ tab: key });
  };

  return (
    <div className="min-h-screen">
      {/* Local settings sidebar with its own panel */}
      <SettingsSidebar active={active} onSelect={setActive} />

      {/* Content area shifts for the settings sidebar + global collapsed rail */}
      <div className="min-h-screen pb-10 px-4 md:pl-[300px] pt-6">
        <div className="max-w-4xl mx-auto">
          {sections[active]}
        </div>
      </div>
    </div>
  );
};

export default SettingsHome;
