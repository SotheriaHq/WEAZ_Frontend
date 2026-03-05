import React from 'react';

const AdminMeasurementsPage: React.FC = () => (
  <div className="space-y-6">
    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">📐 Measurements</h1>
    <p className="text-gray-600 dark:text-gray-400">Review and approve freeform measurement points and brand-submitted size charts.</p>
    <div className="p-8 rounded-xl border border-purple-200/30 dark:border-white/10 bg-white/60 dark:bg-white/5 text-center text-gray-500">
      Measurement review interface connects to the admin moderation queue for measurement-related items.
    </div>
  </div>
);

export default AdminMeasurementsPage;
