import React from 'react';

const AdminDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">📊 Admin Dashboard</h1>
      <p className="text-gray-600 dark:text-gray-400">Welcome to the Threadly Admin Console.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Users', emoji: '👤', value: '—' },
          { label: 'Brands', emoji: '🏷️', value: '—' },
          { label: 'Pending Payouts', emoji: '💰', value: '—' },
          { label: 'Open Disputes', emoji: '⚖️', value: '—' },
        ].map((card) => (
          <div
            key={card.label}
            className="p-4 rounded-xl border border-purple-200/30 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-sm"
          >
            <div className="text-2xl mb-1">{card.emoji}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{card.label}</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
