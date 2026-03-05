import React from 'react';

const AdminTaxonomyPage: React.FC = () => (
  <div className="space-y-6">
    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🧬 Taxonomy</h1>
    <p className="text-gray-600 dark:text-gray-400">Manage category types, categories, and sub-categories.</p>
    <div className="p-8 rounded-xl border border-purple-200/30 dark:border-white/10 bg-white/60 dark:bg-white/5 text-center text-gray-500">
      Taxonomy management interface will connect to existing category admin endpoints.
    </div>
  </div>
);

export default AdminTaxonomyPage;
