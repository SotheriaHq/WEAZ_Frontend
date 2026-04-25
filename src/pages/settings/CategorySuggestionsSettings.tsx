/**
 * PHASE 5: Category Suggestions Settings Page
 * Admin interface to review and moderate category suggestions
 */
import React from 'react';

const CategorySuggestionsSettings: React.FC = () => {
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold">Category Suggestions</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          This feature has been removed. Categories can only be created and managed by Super Admins.
        </p>
      </div>
    </div>
  );
};

export default CategorySuggestionsSettings;
