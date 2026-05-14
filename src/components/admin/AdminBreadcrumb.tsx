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
    <nav className="mb-4 flex items-center gap-1.5 text-[12px] text-theme-secondary">
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
              <span className={isLast ? 'font-semibold text-theme' : ''}>
                {seg.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => navigate(seg.path!)}
                className="font-medium transition-colors hover:text-theme"
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
