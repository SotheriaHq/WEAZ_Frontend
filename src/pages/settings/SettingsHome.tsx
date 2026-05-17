import React, { useEffect } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import SettingsSidebar, {
  getGroupForKey,
  getItemForKey,
} from '@/components/settings/SettingsSidebar';
import PatchesSettings from '@/components/settings/tabs/PatchesSettings';
import SubscriptionsSettings from '@/components/settings/tabs/SubscriptionsSettings';
import AccountSecuritySettings from '@/components/settings/tabs/AccountSecuritySettings';
import NotificationSettings from '@/components/settings/tabs/NotificationSettings';
import EmailPreferencesSettings from '@/components/settings/tabs/EmailPreferencesSettings';
import StoreGeneralSettings from '@/components/settings/tabs/StoreGeneralSettings';
import StorePoliciesSettings from '@/components/settings/tabs/StorePoliciesSettings';
import StorePaymentsSettings from '@/components/settings/tabs/StorePaymentsSettings';
import ProfileVisibilitySettings from '@/components/settings/tabs/ProfileVisibilitySettings';
import SizeFitSettings from '@/components/settings/tabs/SizeFitSettings';
import HiddenContentSettings from './HiddenContentSettings';
import type { RootState } from '@/store';
import { hasActiveBrandMembership } from '@/lib/brandAccess';

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

/* ── Location settings ───────────────────────────────────────────── */
const LocationSettings: React.FC = () => {
  const handleShareLocation = () => {
    toast.info('Location sharing is coming soon.');
  };

  return (
    <div className="space-y-6">
      <Link
        to="/settings?tab=account-security"
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
      >
        <span aria-hidden="true">👈</span>
        Back to settings
      </Link>

      <div>
        <h1 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-white">
          Location
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Choose whether Threadly can ask for your location to personalize nearby brands, delivery context, and future local discovery.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl" aria-hidden="true">
          📍
        </div>
        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          Share your location?
        </h2>
        <p className="mb-5 max-w-xl text-sm leading-6 text-gray-600 dark:text-gray-300">
          Threadly will always ask before using your location. Your precise location will not be shared with brands or other users from this screen.
        </p>
        <button
          type="button"
          onClick={handleShareLocation}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
        >
          Share location
        </button>
      </div>
    </div>
  );
};

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
  account: <AccountSecuritySettings />,
  security: <AccountSecuritySettings />,
  'account-security': <AccountSecuritySettings />,
  notifications: <NotificationSettings />,
  'email-preferences': <EmailPreferencesSettings />,
  privacy: (
    <ComingSoon
      title="Privacy"
      description="Control who can see your activity, message you, and access your data."
    />
  ),
  'profile-visibility': <ProfileVisibilitySettings />,
  location: <LocationSettings />,
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
  'store-team': <Navigate to="/studio/staff" replace />,
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
        onClick={() => onNavigate('account-security')}
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
  const isBrandUser = hasActiveBrandMembership(me);
  const active = searchParams.get('tab') || 'account';
  const normalizedAccountTab = active === 'account' || active === 'security' ? 'account-security' : active;
  const normalizedActive =
    isBrandUser && normalizedAccountTab === 'store-payments' ? 'billing' : normalizedAccountTab;
  const resolvedActive =
    !isBrandUser && normalizedActive.startsWith('store-')
      ? 'account'
      : normalizedActive;
  const resolvedSection =
    resolvedActive === 'billing' && isBrandUser
      ? <StorePaymentsSettings />
      : sections[resolvedActive];

  useEffect(() => {
    if (isBrandUser && active === 'store-payments') {
      setSearchParams({ tab: 'billing' }, { replace: true });
    }
  }, [active, isBrandUser, setSearchParams]);

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
