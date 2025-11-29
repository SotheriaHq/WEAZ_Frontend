import React from 'react';

const NotificationSettings: React.FC = () => {
  const sections = [
    {
      title: 'Brand Interactions',
      items: [
        { id: 'patch_requests', label: 'Brand Patch Requests', description: 'When another brand wants to connect with you' },
        { id: 'patch_updates', label: 'Patch Status Updates', description: 'When a patch request is accepted or rejected' },
        { id: 'contributions', label: 'Contribution Requests', description: 'When a patched brand invites you to contribute' },
      ],
    },
    {
      title: 'Community',
      items: [
        { id: 'new_followers', label: 'New Subscribers', description: 'When a user subscribes to your brand' },
        { id: 'comments', label: 'Comments', description: 'When someone comments on your collections' },
        { id: 'likes', label: 'Likes', description: 'When someone likes your content' },
      ],
    },
    {
      title: 'System',
      items: [
        { id: 'security', label: 'Security Alerts', description: 'Important updates about your account security' },
        { id: 'updates', label: 'Product Updates', description: 'News about new features and improvements' },
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
              {section.items.map((item) => (
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
                      defaultChecked
                      className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer peer checked:right-0 checked:border-purple-600"
                    />
                    <label
                      htmlFor={item.id}
                      className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer peer-checked:bg-purple-600"
                    ></label>
                  </div>
                </div>
              ))}
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
