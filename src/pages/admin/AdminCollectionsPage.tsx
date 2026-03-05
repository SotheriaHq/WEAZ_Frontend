import React from 'react';

const AdminCollectionsPage: React.FC = () => (
  <div className="space-y-6">
    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🗂️ Collections</h1>
    <p className="text-gray-600 dark:text-gray-400">Admin collection oversight — manage store and catalog collections across all brands.</p>
    <div className="p-8 rounded-xl border border-purple-200/30 dark:border-white/10 bg-white/60 dark:bg-white/5 text-center text-gray-500">
      Collection management interface will be populated with data from existing collection endpoints.
    </div>
  </div>
);

export default AdminCollectionsPage;
