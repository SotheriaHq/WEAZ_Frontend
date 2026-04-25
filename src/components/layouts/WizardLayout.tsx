import React from 'react';
import type { ReactNode } from 'react';

interface WizardLayoutProps {
  title: string;
  description?: string;
  left: ReactNode;
  right: ReactNode;
  actions?: ReactNode;
  className?: string;
}

const WizardLayout: React.FC<WizardLayoutProps> = ({
  title,
  description,
  left,
  right,
  actions,
  className = '',
}) => (
  <div className={`mx-auto flex max-w-screen-xl flex-col gap-6 ${className}`}>
    <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
        {description ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start">
      <div className="min-w-0">{left}</div>
      <div className="min-w-0">{right}</div>
    </div>
  </div>
);

export default WizardLayout;
