import React from 'react';
import { UserMinus } from 'lucide-react';

const SubscriptionsSettings: React.FC = () => {
  // Mock data
  const subscriptions = [
    { id: 1, name: 'John Doe', username: '@johndoe', date: '2024-03-10' },
    { id: 2, name: 'Jane Smith', username: '@janesmith', date: '2024-03-12' },
    { id: 3, name: 'Fashion Lover', username: '@fashionlover', date: '2024-02-28' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Subscriptions</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage users who are subscribed to your brand.</p>
      </div>

      <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-white/10">
        <div className="p-6 border-b border-gray-200 dark:border-white/10">
          <div className="relative">
            <input
              type="text"
              placeholder="Search subscribers..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <svg
              className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-white/10">
          {subscriptions.map((sub) => (
            <div key={sub.id} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium">
                  {sub.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{sub.name}</h3>
                  <p className="text-sm text-gray-500">{sub.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">Subscribed {sub.date}</span>
                <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors" title="Remove subscriber">
                  <UserMinus className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionsSettings;
