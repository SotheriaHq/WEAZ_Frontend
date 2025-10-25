import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  cta?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, cta }) => {
  return (
    <div className="text-center py-12">
      <div className="mx-auto w-24 h-24 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full mb-4">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="text-sm text-gray-500 mt-2">{description}</p>}
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
};

export default EmptyState;
