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
      {icon ? (
        <div className="mx-auto w-24 h-24 flex items-center justify-center bg-[color:var(--wiez-surface-subtle)] rounded-full mb-4 text-[color:var(--wiez-text-secondary)]">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-semibold text-[color:var(--wiez-text-primary)]">{title}</h3>
      {description && <p className="text-sm text-[color:var(--wiez-text-secondary)] mt-2">{description}</p>}
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
};

export default EmptyState;
