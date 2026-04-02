import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '@/store';
import { customOrdersBuyerApi, type CustomOrderChartFamily } from '@/api/CustomOrderApi';
import UniversalSelect from '@/components/forms/UniversalSelect';

const AccountSettings: React.FC = () => {
  const { profile } = useSelector((state: RootState) => state.user);
  const navigate = useNavigate();
  const [displayChartFamily, setDisplayChartFamily] = useState<CustomOrderChartFamily>('UK');

  useEffect(() => {
    let active = true;
    void customOrdersBuyerApi
      .getDisplayChartPreference()
      .then((preference) => {
        if (active) {
          setDisplayChartFamily(preference.displayChartFamily);
        }
      })
      .catch(() => {
        // Keep default if preference endpoint is unavailable.
      });
    return () => {
      active = false;
    };
  }, []);

  if (!profile) return null;

  const handleDisplayChartChange = (value: string) => {
    const next = value as CustomOrderChartFamily;
    setDisplayChartFamily(next);
    void customOrdersBuyerApi.updateDisplayChartPreference({
      displayChartFamily: next,
      updatedAtMs: Date.now(),
    });
  };

  const handleOpenSecurity = () => {
    navigate('/settings?tab=security');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Account Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage your login and security preferences.</p>
      </div>

      <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-white/10 p-6 space-y-8">
        {/* Email Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Email Address</h3>
          <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/10">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Current Email</p>
              <p className="text-sm text-gray-500">{profile.email}</p>
            </div>
            <button className="px-4 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/10 rounded-lg transition-colors">
              Change Email
            </button>
          </div>
        </div>

        {/* Password Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Password</h3>
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleOpenSecurity}
              className="w-full flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors text-left"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Change Password</p>
                <p className="text-sm text-gray-500">Open Security tab to update your password</p>
              </div>
              <span className="text-gray-400">→</span>
            </button>
            <button className="w-full flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors text-left">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Two-Factor Authentication</p>
                <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
              </div>
              <span className="px-3 py-1 text-xs font-medium text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                Disabled
              </span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Custom Order Display Chart</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This sets your preferred size chart labels used across custom-order composer and size-chart conversion views.
          </p>
          <UniversalSelect
            label="Preferred chart"
            value={displayChartFamily}
            onChange={handleDisplayChartChange}
            options={[
              { value: 'UK', label: 'UK' },
              { value: 'US', label: 'US' },
              { value: 'NIGERIA', label: 'Nigeria' },
              { value: 'ASIA', label: 'Asia' },
            ]}
            className="max-w-sm"
          />
        </div>

        {/* Danger Zone */}
        <div className="pt-8 border-t border-gray-200 dark:border-white/10">
          <h3 className="text-lg font-medium text-red-600 mb-4">Danger Zone</h3>
          <div className="p-4 rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-900 dark:text-red-200">Delete Account</p>
              <p className="text-sm text-red-600 dark:text-red-400">Permanently delete your account and all data</p>
            </div>
            <button className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
