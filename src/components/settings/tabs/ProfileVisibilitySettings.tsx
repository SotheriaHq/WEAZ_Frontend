import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { apiClient } from '@/api/httpClient';
import { toast } from 'sonner';

type ProfileVisibility = 'UNLOCKED' | 'LOCKED';

const ProfileVisibilitySettings: React.FC = () => {
  const user = useSelector((state: RootState) => state.user.profile);
  const [visibility, setVisibility] = useState<ProfileVisibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await apiClient.get('/users/me/profile');
        if (mounted) {
          setVisibility((res.data?.profileVisibility as ProfileVisibility) ?? 'UNLOCKED');
        }
      } catch {
        if (mounted) {
          setVisibility('UNLOCKED');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const updateVisibility = async (next: ProfileVisibility) => {
    if (visibility === next) return;
    try {
      setSaving(true);
      await apiClient.patch('/users/me/profile-visibility', { profileVisibility: next });
      setVisibility(next);
      toast.success('Profile visibility updated.');
    } catch {
      toast.error('Failed to update visibility.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  if (user.type !== 'REGULAR') {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Profile Visibility</h1>
        <p className="text-gray-600 dark:text-gray-400">Profile visibility is available for end users only.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading visibility...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Profile Visibility</h1>
        <p className="text-gray-600 dark:text-gray-400">Control who can see your patches list and public profile details.</p>
      </div>

      <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-white/10 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Public profile</h3>
            <p className="text-sm text-gray-500">Anyone can view your profile and patches.</p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => updateVisibility('UNLOCKED')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              visibility === 'UNLOCKED'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
            } ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {visibility === 'UNLOCKED' ? 'Enabled' : 'Enable'}
          </button>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Private profile</h3>
            <p className="text-sm text-gray-500">Only you can view your patches list.</p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => updateVisibility('LOCKED')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              visibility === 'LOCKED'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
            } ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {visibility === 'LOCKED' ? 'Enabled' : 'Enable'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileVisibilitySettings;
