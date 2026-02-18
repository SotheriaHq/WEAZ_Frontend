import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { SizeFitApi } from '@/api/SizeFitApi';
import type { SizeFitProfile } from '@/types/sizeFit';

const SizeFitSettings: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<SizeFitProfile | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await SizeFitApi.getMyProfile();
        setProfile(data);
      } catch (error) {
        console.error('Failed to load size fit settings', error);
        toast.error('Failed to load size fitting settings');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const save = async () => {
    if (!profile) return;
    try {
      setSaving(true);
      const updated = await SizeFitApi.updateSettings({
        visibility: profile.visibility,
        sharePolicy: profile.sharePolicy,
        notifyOnShare: profile.notifyOnShare,
        requireUpdateEveryDays: profile.requireUpdateEveryDays,
      });
      setProfile((prev) => (prev ? { ...prev, ...updated } : prev));
      toast.success('Size fitting settings updated');
    } catch (error) {
      console.error('Failed to save size fit settings', error);
      toast.error('Failed to save size fitting settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading size fitting settings...</div>;
  }

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Size Fittings</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Configure visibility, sharing policy, and reminder frequency.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-white/10 p-6 space-y-4">
        <label className="block text-sm text-gray-700 dark:text-gray-300">
          <span className="block mb-1 font-medium">Visibility</span>
          <select
            value={profile.visibility}
            onChange={(e) =>
              setProfile((prev) =>
                prev
                  ? { ...prev, visibility: e.target.value as 'PUBLIC' | 'PRIVATE' }
                  : prev,
              )
            }
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2"
          >
            <option value="PRIVATE">Private</option>
            <option value="PUBLIC">Public</option>
          </select>
        </label>

        <label className="block text-sm text-gray-700 dark:text-gray-300">
          <span className="block mb-1 font-medium">Share Policy</span>
          <select
            value={profile.sharePolicy}
            onChange={(e) =>
              setProfile((prev) =>
                prev
                  ? {
                      ...prev,
                      sharePolicy: e.target.value as
                        | 'OWNER_ONLY'
                        | 'REQUIRE_PERMISSION'
                        | 'ALLOW_ANYONE',
                    }
                  : prev,
              )
            }
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2"
          >
            <option value="OWNER_ONLY">Only me</option>
            <option value="REQUIRE_PERMISSION">Require owner permission</option>
            <option value="ALLOW_ANYONE">Allow re-share by anyone</option>
          </select>
        </label>

        <label className="block text-sm text-gray-700 dark:text-gray-300">
          <span className="block mb-1 font-medium">Reminder Every (days)</span>
          <input
            type="number"
            min={7}
            max={60}
            value={profile.requireUpdateEveryDays}
            onChange={(e) =>
              setProfile((prev) =>
                prev
                  ? { ...prev, requireUpdateEveryDays: Number(e.target.value || 14) }
                  : prev,
              )
            }
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2"
          />
        </label>

        <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={profile.notifyOnShare}
            onChange={(e) =>
              setProfile((prev) => (prev ? { ...prev, notifyOnShare: e.target.checked } : prev))
            }
            className="rounded border-gray-300 text-indigo-600"
          />
          Notify me whenever my size fittings are shared.
        </label>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="rounded-lg border border-gray-300 dark:border-white/20 text-sm px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5"
          >
            Open Full Size/Fits Modal
          </button>
        </div>
      </div>
    </div>
  );
};

export default SizeFitSettings;

