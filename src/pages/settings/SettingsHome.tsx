import React from 'react';
import SettingsSidebar from '@/components/settings/SettingsSidebar';

const dummySections: Record<string, React.ReactNode> = {
  account: (
    <>
      <h1 className="text-2xl font-semibold mb-2">Choose how you appear</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">Signed in as user@example.com</p>
      <div className="rounded-lg border border-gray-200 dark:border-white/10 p-4">
        <div className="h-32 rounded bg-gray-50 dark:bg-gray-900" />
      </div>
    </>
  ),
  notifications: (
    <>
      <h1 className="text-2xl font-semibold mb-2">Notifications</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">Dummy preferences for now.</p>
      <div className="space-y-3">
        {[1,2,3].map((i) => (
          <label key={i} className="flex items-center gap-3">
            <input type="checkbox" className="accent-primary" defaultChecked={i%2===0} />
            <span>Email alert #{i}</span>
          </label>
        ))}
      </div>
    </>
  ),
  privacy: (
    <>
      <h1 className="text-2xl font-semibold mb-2">Privacy</h1>
      <p className="text-gray-600 dark:text-gray-400">Placeholder content.</p>
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
  const [active, setActive] = React.useState<string>('account');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Local settings sidebar with its own panel */}
      <SettingsSidebar active={active} onSelect={setActive} />

      {/* Content area shifts for the settings sidebar + global collapsed rail */}
      <div className="min-h-screen pt-20 pb-10 px-4 md:pl-[300px] lg:pl-[344px]">
        <div className="max-w-4xl mx-auto">
          {dummySections[active]}
        </div>
      </div>
    </div>
  );
};

export default SettingsHome;
