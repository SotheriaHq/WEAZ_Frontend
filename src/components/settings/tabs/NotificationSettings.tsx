import React, { useEffect, useState } from 'react';
import { NotificationsApi } from '@/api/NotificationsApi';
import { toast } from 'sonner';

interface NotificationSettingsData {
  security: {
    login: boolean;
  };
  engagement: {
    likes: boolean;
    comments: boolean;
    follows: boolean;
  };
  brand: {
    patchRequests: boolean;
    contributions: boolean;
  };
}

const NotificationSettings: React.FC = () => {
  const [settings, setSettings] = useState<NotificationSettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await NotificationsApi.getSettings();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load notification settings', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (category: keyof NotificationSettingsData, key: string, value: boolean) => {
    if (!settings) return;

    // Optimistic update
    const previousSettings = { ...settings };
    const newSettings = {
      ...settings,
      [category]: {
        ...settings[category],
        [key]: value,
      },
    };
    setSettings(newSettings);

    try {
      await NotificationsApi.updateSettings({
        [category]: {
          [key]: value,
        },
      });
      toast.success('Settings updated');
    } catch (error) {
      console.error('Failed to update settings', error);
      toast.error('Failed to update settings');
      setSettings(previousSettings); // Revert on error
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading settings...</div>;
  }

  if (!settings) return null;

  const sections = [
    {
      title: 'Brand Interactions',
      category: 'brand' as const,
      items: [
        { id: 'patchRequests', label: 'Brand Patch Requests', description: 'When another brand wants to connect with you' },
        { id: 'contributions', label: 'Contribution Requests', description: 'When a patched brand invites you to contribute' },
      ],
    },
    {
      title: 'Engagement',
      category: 'engagement' as const,
      items: [
        { id: 'follows', label: 'New Subscribers', description: 'When a user subscribes to your brand' },
        { id: 'comments', label: 'Comments', description: 'When someone comments on your collections' },
        { id: 'likes', label: 'Likes', description: 'When someone likes your content' },
      ],
    },
    {
      title: 'Security',
      category: 'security' as const,
      items: [
        { id: 'login', label: 'Login Alerts', description: 'Get notified when a new login occurs on your account' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Notification Preferences</h1>
        <p className="text-gray-600 dark:text-gray-400">Choose what you want to be notified about.</p>
      </div>

      <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-white/10 divide-y divide-gray-200 dark:divide-white/10">
        {sections.map((section) => (
          <div key={section.title} className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{section.title}</h3>
            <div className="space-y-4">
              {section.items.map((item) => {
                const isChecked = (settings[section.category] as any)?.[item.id] ?? true;
                return (
                  <div key={item.id} className="flex items-start justify-between">
                    <div>
                      <label htmlFor={item.id} className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                        {item.label}
                      </label>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                    <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                      <input
                        type="checkbox"
                        name={item.id}
                        id={item.id}
                        checked={isChecked}
                        onChange={(e) => handleToggle(section.category, item.id, e.target.checked)}
                        className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer peer checked:right-0 checked:border-purple-600"
                      />
                      <label
                        htmlFor={item.id}
                        className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer peer-checked:bg-purple-600"
                      ></label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      
      <style>{`
        .toggle-checkbox:checked {
          right: 0;
          border-color: #9333ea;
        }
        .toggle-checkbox:checked + .toggle-label {
          background-color: #9333ea;
        }
        .toggle-checkbox {
          right: 50%; /* Start at left */
          transition: all 0.3s;
        }
      `}</style>
    </div>
  );
};

export default NotificationSettings;
