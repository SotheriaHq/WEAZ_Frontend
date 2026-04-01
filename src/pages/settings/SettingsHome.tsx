import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import SettingsSidebar, {
  getGroupForKey,
  getItemForKey,
} from '@/components/settings/SettingsSidebar';
import SecuritySettings from '@/components/settings/tabs/SecuritySettings';
import PatchesSettings from '@/components/settings/tabs/PatchesSettings';
import SubscriptionsSettings from '@/components/settings/tabs/SubscriptionsSettings';
import AccountSettings from '@/components/settings/tabs/AccountSettings';
import NotificationSettings from '@/components/settings/tabs/NotificationSettings';
import EmailPreferencesSettings from '@/components/settings/tabs/EmailPreferencesSettings';
import StoreGeneralSettings from '@/components/settings/tabs/StoreGeneralSettings';
import StorePoliciesSettings from '@/components/settings/tabs/StorePoliciesSettings';
import StorePaymentsSettings from '@/components/settings/tabs/StorePaymentsSettings';
import ProfileVisibilitySettings from '@/components/settings/tabs/ProfileVisibilitySettings';
import SizeFitSettings from '@/components/settings/tabs/SizeFitSettings';
import HiddenContentSettings from './HiddenContentSettings';
import type { RootState } from '@/store';

/* ── Coming Soon placeholder ─────────────────────────────────────── */
const ComingSoon: React.FC<{ title: string; description: string }> = ({
  title,
  description,
}) => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h1>
      <p className="text-gray-500 dark:text-gray-400">{description}</p>
    </div>
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-full bg-gray-100 dark:bg-white/5 mb-4 text-3xl" aria-hidden="true">
        🚧
      </div>
      <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
        Coming Soon
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
        We're building this section. It will be available in a future update.
      </p>
    </div>
  </div>
);

/* ── Danger Zone (Store) ─────────────────────────────────────────── */
const StoreDangerZone: React.FC = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-2">
        Danger Zone
      </h1>
      <p className="text-gray-500 dark:text-gray-400">
        Irreversible actions for your store. Proceed with caution.
      </p>
    </div>
    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
      <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">
        Close Store
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Permanently close your store. All active listings will be removed and
        pending orders must be fulfilled first. This action cannot be undone.
      </p>
      <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">
        Close Store
      </button>
    </div>
    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
      <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">
        Delete Store Data
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Request permanent deletion of all store data including products,
        orders history, and analytics. This is irreversible.
      </p>
      <button className="px-4 py-2 border border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-lg text-sm font-medium transition-colors">
        Request Data Deletion
      </button>
    </div>
  </div>
);

/* ── Section map ─────────────────────────────────────────────────── */
const sections: Record<string, React.ReactNode> = {
  // Personal
  account: <AccountSettings />,
  security: <SecuritySettings />,
  notifications: <NotificationSettings />,
  'email-preferences': <EmailPreferencesSettings />,
  privacy: (
    <ComingSoon
      title="Privacy"
      description="Control who can see your activity, message you, and access your data."
    />
  ),
  'profile-visibility': <ProfileVisibilitySettings />,
  'size-fits': <SizeFitSettings />,
  'hidden-content': <HiddenContentSettings />,
  billing: (
    <ComingSoon
      title="Accounts"
      description="Manage account-level billing and payment preferences."
    />
  ),

  // Brand
  patches: <PatchesSettings />,
  subscriptions: <SubscriptionsSettings />,

  // Studio
  'store-general': <StoreGeneralSettings />,
  'store-social': (
    <ComingSoon
      title="Social & Links"
      description="Connect your social accounts and manage verification badges for your store."
    />
  ),
  'store-policies': <StorePoliciesSettings />,
  'store-payments': <StorePaymentsSettings />,
  'store-team': (
    <ComingSoon
      title="Team Members"
      description="Invite team members and manage who has access to your store settings."
    />
  ),
  'store-notifications': <NotificationSettings />,
  'store-danger': <StoreDangerZone />,
};

/* ── Breadcrumbs ─────────────────────────────────────────────────── */
const Breadcrumbs: React.FC<{ activeKey: string; onNavigate: (key: string) => void }> = ({
  activeKey,
  onNavigate,
}) => {
  const group = getGroupForKey(activeKey);
  const item = getItemForKey(activeKey);

  return (
    <nav className="flex items-center gap-1.5 text-sm mb-6 flex-wrap">
      <button
        onClick={() => onNavigate('account')}
        className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      >
        Settings
      </button>
      {group && (
        <>
          <span className="text-gray-300 dark:text-gray-600" aria-hidden="true">›</span>
          <span className="text-gray-400 dark:text-gray-500">
            {group.label}
          </span>
        </>
      )}
      {item && (
        <>
          <span className="text-gray-300 dark:text-gray-600" aria-hidden="true">›</span>
          <span className="text-gray-900 dark:text-white font-medium">
            {item.label}
          </span>
        </>
      )}
    </nav>
  );
};

/* ── Main component ──────────────────────────────────────────────── */
const SettingsHome: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const me = useSelector((s: RootState) => s.user.profile);
  const isBrandUser = me?.type === 'BRAND';
  const active = searchParams.get('tab') || 'account';
  const resolvedActive =
    !isBrandUser && active.startsWith('store-') ? 'account' : active;
  const resolvedSection =
    resolvedActive === 'billing' && isBrandUser
      ? <StorePaymentsSettings />
      : sections[resolvedActive];

  const setActive = (key: string) => {
    setSearchParams({ tab: key });
  };

  return (
    <div className="min-h-screen">
      <SettingsSidebar active={resolvedActive} onSelect={setActive} />

      <div className="min-h-screen pb-10 px-4 md:pl-[248px] pt-6">
        <div className="max-w-4xl mx-auto">
          <Breadcrumbs activeKey={resolvedActive} onNavigate={setActive} />
          {resolvedSection ?? (
            <ComingSoon
              title="Not Found"
              description="This settings section doesn't exist or has been moved."
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsHome;
