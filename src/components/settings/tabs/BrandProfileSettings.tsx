import React from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';

const BrandProfileSettings: React.FC = () => {
  const { profile } = useSelector((state: RootState) => state.user);

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Brand Profile</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage your brand's public appearance.</p>
      </div>

      <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-white/10 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Brand Name</label>
            <input
              type="text"
              defaultValue={profile.brandFullName || ''}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Business Type</label>
            <input
              type="text"
              defaultValue={profile.brandBusinessType || ''}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
          <textarea
            defaultValue={profile.brandDescription || ''}
            rows={4}
            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Country</label>
            <input
              type="text"
              defaultValue={profile.brandCountry || ''}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">State</label>
            <input
              type="text"
              defaultValue={profile.brandState || ''}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">City</label>
            <input
              type="text"
              defaultValue={profile.brandCity || ''}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-white/10">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Social Links</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Instagram</label>
              <input
                type="text"
                defaultValue={profile.socialInstagram || ''}
                placeholder="@username"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Website</label>
              <input
                type="text"
                defaultValue={profile.socialWebsite || ''}
                placeholder="https://example.com"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default BrandProfileSettings;
