import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { NotificationsApi } from '@/api/NotificationsApi';
import { useNotificationSettingsQuery } from '@/query/queries';
import { queryKeys } from '@/query/queryKeys';
import type { RootState } from '@/store';
import { toast } from 'sonner';

interface NotificationSettingsData {
  security: {
    login: boolean;
    logout: boolean;
  };
  social: {
    threads: boolean;
    follows: boolean;
    patches: boolean;
  };
  comments: {
    enabled: boolean;
    replies: boolean;
    fromUnpatchedUsers: boolean;
  };
  tags: {
    mentions: boolean;
    fromUnpatchedUsers: boolean;
  };
  collections: {
    lifecycle: boolean;
    access: boolean;
  };
  brand: {
    patchRequests: boolean;
    contributions: boolean;
    verificationPrompts: boolean;
  };
  orders: {
    placed: boolean;
    statusChanges: boolean;
  };
  reviews: {
    reminders: boolean;
    replies: boolean;
    moderation: boolean;
  };
  fit: {
    reminders: boolean;
    shares: boolean;
    approvals: boolean;
  };
  messaging: {
    newMessages: boolean;
    reminders: boolean;
    moderation: boolean;
    desktop: boolean;
    sound: boolean;
    readReceipts: boolean;
    deliveryReceipts: boolean;
  };
}

const NotificationSettings: React.FC = () => {
  const userId = useSelector((state: RootState) => state.user.profile?.id);
  const queryClient = useQueryClient();
  const settingsQuery = useNotificationSettingsQuery(userId, { enabled: Boolean(userId) });
  const settings = settingsQuery.data as NotificationSettingsData | null | undefined;
  const loading = settingsQuery.isLoading && !settings;

  const handleToggle = async (category: keyof NotificationSettingsData, key: string, value: boolean) => {
    if (!settings || !userId) return;

    const previousSettings = settings;
    const newSettings = {
      ...settings,
      [category]: {
        ...settings[category],
        [key]: value,
      },
    };
    const queryKey = queryKeys.notifications.settings(userId);
    queryClient.setQueryData(queryKey, newSettings);

    try {
      const updated = await NotificationsApi.updateSettings({
        [category]: {
          [key]: value,
        },
      });
      queryClient.setQueryData(queryKey, updated);
      toast.success('Settings updated');
    } catch (error) {
      console.error('Failed to update settings', error);
      toast.error('Failed to update settings');
      queryClient.setQueryData(queryKey, previousSettings);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading settings...</div>;
  }

  if (settingsQuery.error && !settings) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>Failed to load settings.</p>
        <button
          type="button"
          className="mt-3 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          onClick={() => void settingsQuery.refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!settings) return null;

  const sections = [
    {
      title: 'Social & Engagement',
      category: 'social' as const,
      items: [
        { id: 'threads', label: 'Threads', description: 'When someone threads your content' },
        { id: 'follows', label: 'Follows', description: 'When someone follows your profile' },
        { id: 'patches', label: 'Patches', description: 'When someone patches your profile or collabs your collection' },
      ],
    },
    {
      title: 'Comments',
      category: 'comments' as const,
      items: [
        { id: 'enabled', label: 'All Comment Notifications', description: 'Master switch for comment notifications' },
        { id: 'replies', label: 'Replies To My Comments', description: 'When someone replies to your comment thread' },
        { id: 'fromUnpatchedUsers', label: 'Allow Comments From Unpatched Users', description: 'Turn off to receive comment notifications only from users patched with you' },
      ],
    },
    {
      title: 'Tagging',
      category: 'tags' as const,
      items: [
        { id: 'mentions', label: 'Tag Mentions', description: 'When you are tagged or your saved tags are matched in content/products' },
        { id: 'fromUnpatchedUsers', label: 'Allow Tags From Unpatched Users', description: 'Turn off to receive tag notifications only from users patched with you' },
      ],
    },
    {
      title: 'Collections',
      category: 'collections' as const,
      items: [
        { id: 'lifecycle', label: 'Collection Lifecycle', description: 'Collection/product publish and delete activity' },
        { id: 'access', label: 'Private Access Requests', description: 'Requests, approvals, and revocations for private collection access' },
      ],
    },
    {
      title: 'Brand Interactions',
      category: 'brand' as const,
      items: [
        { id: 'patchRequests', label: 'Brand Patch Requests', description: 'When another brand wants to connect with you' },
        { id: 'contributions', label: 'Contribution Requests', description: 'When a patched brand invites you to contribute' },
        { id: 'verificationPrompts', label: 'Store Verification Prompts', description: 'After store setup, show a success reminder that prompts brand verification' },
      ],
    },
    {
      title: 'Orders & Delivery',
      category: 'orders' as const,
      items: [
        {
          id: 'placed',
          label: 'Order Placed Confirmations',
          description: 'Get notified as soon as your checkout succeeds and your order is created',
        },
        {
          id: 'statusChanges',
          label: 'Order Status Changes',
          description: 'Get notified when your order moves to processing, shipped, delivered, cancelled, returned, or refund-related states',
        },
      ],
    },
    {
      title: 'Security',
      category: 'security' as const,
      items: [
        { id: 'login', label: 'Sign-in in-app alerts', description: 'Show an in-app notification when your account signs in. Email sign-in alerts are controlled in Email notifications.' },
        { id: 'logout', label: 'Sign-out in-app alerts', description: 'Show an in-app notification when your account signs out from one or all devices.' },
      ],
    },
    {
      title: 'Size Fittings',
      category: 'fit' as const,
      items: [
        {
          id: 'reminders',
          label: 'Fit Update Reminders',
          description: 'Remind me every two weeks to refresh my size measurements',
        },
        {
          id: 'shares',
          label: 'Fit Sharing Activity',
          description: 'Notify me when my fitting profile is shared or reshared',
        },
        {
          id: 'approvals',
          label: 'Share Approvals',
          description: 'Notify me about share request approvals and rejections',
        },
      ],
    },
    {
      title: 'Order Messaging',
      category: 'messaging' as const,
      items: [
        {
          id: 'newMessages',
          label: 'New Messages',
          description: 'Get notified when someone sends a message in an order thread',
        },
        {
          id: 'reminders',
          label: 'Unread Reminders',
          description: 'Receive reminders when you still have unread order messages',
        },
        {
          id: 'moderation',
          label: 'Moderation Notices',
          description: 'Receive critical notices when support or moderation changes thread visibility',
        },
        {
          id: 'desktop',
          label: 'Desktop Notifications',
          description: 'Show browser notifications when WIEZ is open in the background',
        },
        {
          id: 'sound',
          label: 'Sound Alerts',
          description: 'Play a short sound for new order messages',
        },
        {
          id: 'readReceipts',
          label: 'Read Receipts (colored ✓✓)',
          description: 'When on: your sent messages show colored double ticks when read, and others can see when you read their messages. When OFF: you see no colored ticks on your sent messages, AND others will not see colored ticks when you read theirs. This setting is mutual.',
        },
        {
          id: 'deliveryReceipts',
          label: 'Delivery Receipts (double ✓✓)',
          description: 'When on: your sent messages show double ticks once delivered. When OFF: all your messages show a single tick only — you also won\'t see double ticks on others\' messages to you. This setting is mutual.',
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Notification Preferences</h1>
        <p className="text-gray-600 dark:text-gray-400">Choose which account, order, and activity updates should reach you in real time.</p>
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
