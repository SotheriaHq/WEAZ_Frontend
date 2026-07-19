import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { apiClient } from '@/api/httpClient';
import { toast } from 'sonner';

type ProfileVisibility = 'UNLOCKED' | 'LOCKED';

type PrivacyToggles = {
  showUsername: boolean;
  showLocation: boolean;
};

function PrivacyToggleRow({
  emoji,
  title,
  hint,
  value,
  disabled,
  onToggle,
}: {
  emoji: string;
  title: string;
  hint: string;
  value: boolean;
  disabled: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          {emoji} {title}
        </h3>
        <p className="text-sm text-gray-500">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onToggle(!value)}
        className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition ${
          value ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'
        } ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

const ProfileVisibilitySettings: React.FC = () => {
  const user = useSelector((state: RootState) => state.user.profile);
  const [visibility, setVisibility] = useState<ProfileVisibility | null>(null);
  const [privacy, setPrivacy] = useState<PrivacyToggles>({
    showUsername: true,
    showLocation: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await apiClient.get('/users/me/profile');
        const profile = res.data?.data ?? res.data;
        if (mounted) {
          setVisibility((profile?.profileVisibility as ProfileVisibility) ?? 'UNLOCKED');
          setPrivacy({
            showUsername: profile?.showUsername !== false,
            showLocation: profile?.showLocation !== false,
          });
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

  const updatePrivacyToggle = async (key: keyof PrivacyToggles, next: boolean) => {
    const previous = privacy[key];
    if (previous === next) return;
    setSaving(true);
    setPrivacy((current) => ({ ...current, [key]: next }));
    try {
      const res = await apiClient.patch('/users/me/profile-privacy', { [key]: next });
      const updated = res.data?.data ?? res.data;
      setPrivacy({
        showUsername: updated?.showUsername !== false,
        showLocation: updated?.showLocation !== false,
      });
      toast.success(
        key === 'showUsername'
          ? next
            ? 'Your username is visible again.'
            : 'Your username is now hidden from your public profile.'
          : next
            ? 'Your location is visible again.'
            : 'Your location is now hidden from your public profile.',
      );
    } catch {
      setPrivacy((current) => ({ ...current, [key]: previous }));
      toast.error('Could not save that just now — try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading privacy settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Profile Visibility</h1>
        <p className="text-gray-600 dark:text-gray-400">Choose what shows up on your public profile.</p>
      </div>

      <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-white/10 p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">What others see</h2>
        <PrivacyToggleRow
          emoji="🪪"
          title="Show my username"
          hint="Your @handle on your public profile. Turn this off to keep it just for you."
          value={privacy.showUsername}
          disabled={saving}
          onToggle={(next) => void updatePrivacyToggle('showUsername', next)}
        />
        <PrivacyToggleRow
          emoji="📍"
          title="Show my location"
          hint="Your location on your public profile. Turn this off to keep it private."
          value={privacy.showLocation}
          disabled={saving}
          onToggle={(next) => void updatePrivacyToggle('showLocation', next)}
        />
      </div>

      {user.type === 'REGULAR' && visibility !== null && (
        <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-white/10 p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Patches list</h2>
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
      )}
    </div>
  );
};

export default ProfileVisibilitySettings;
