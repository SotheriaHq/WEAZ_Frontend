import React from 'react';

const Subscriptions: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
      <h1 className="text-2xl font-bold mb-4">Subscriptions</h1>
      <p className="text-gray-500 mb-6">Manage your subscriptions here.</p>
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <p className="font-mono text-sm">Coming Soon</p>
      </div>
    </div>
  );
};

export default Subscriptions;
