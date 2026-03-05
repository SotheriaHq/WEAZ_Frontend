import React from 'react';

const AdminTagsPage: React.FC = () => (
  <div className="space-y-6">
    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🏷️ Tags</h1>
    <p className="text-gray-600 dark:text-gray-400">Manage the platform tag vocabulary — create, merge, and curate tags.</p>
    <div className="p-8 rounded-xl border border-purple-200/30 dark:border-white/10 bg-white/60 dark:bg-white/5 text-center text-gray-500">
      Tags management interface will connect to existing tag admin endpoints.
    </div>
  </div>
);

export default AdminTagsPage;
