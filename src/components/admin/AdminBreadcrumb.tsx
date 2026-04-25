import React from 'react';
import { useNavigate } from 'react-router-dom';

export interface BreadcrumbSegment {
  label: string;
  path?: string;
}

interface AdminBreadcrumbProps {
  segments: BreadcrumbSegment[];
}

const AdminBreadcrumb: React.FC<AdminBreadcrumbProps> = ({ segments }) => {
  const navigate = useNavigate();
  const all: BreadcrumbSegment[] = [{ label: 'Dashboard', path: '/admin' }, ...segments];

  return (
    <nav className="flex items-center gap-1.5 text-[12px] text-gray-400 dark:text-gray-500 mb-4">
      {all.map((seg, i) => {
        const isLast = i === all.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
            {isLast || !seg.path ? (
              <span className={isLast ? 'text-gray-700 dark:text-gray-200 font-semibold' : ''}>
                {seg.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => navigate(seg.path!)}
                className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors font-medium"
              >
                {seg.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default AdminBreadcrumb;
