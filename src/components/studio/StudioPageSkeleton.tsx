import React from 'react';

type StudioPageSkeletonVariant = 'dashboard' | 'list' | 'detail' | 'form';

type StudioPageSkeletonProps = {
  variant?: StudioPageSkeletonVariant;
  rows?: number;
};

const pulse = 'animate-pulse rounded-xl bg-gray-200/80 dark:bg-white/10';

const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="rounded-2xl border border-gray-200/70 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
      <div className={`h-6 w-56 ${pulse}`} />
      <div className={`mt-3 h-4 w-40 ${pulse}`} />
    </div>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-gray-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.03]"
        >
          <div className={`h-4 w-24 ${pulse}`} />
          <div className={`mt-4 h-8 w-28 ${pulse}`} />
          <div className={`mt-3 h-3 w-20 ${pulse}`} />
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="rounded-2xl border border-gray-200/70 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.03] lg:col-span-2">
        <div className={`h-5 w-36 ${pulse}`} />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className={`h-16 w-full ${pulse}`} />
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-gray-200/70 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
        <div className={`h-5 w-28 ${pulse}`} />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={`h-14 w-full ${pulse}`} />
          ))}
        </div>
      </div>
    </div>
  </div>
);

const ListSkeleton: React.FC<{ rows: number }> = ({ rows }) => (
  <div className="space-y-4">
    <div className="rounded-2xl border border-gray-200/70 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
      <div className={`h-6 w-44 ${pulse}`} />
      <div className={`mt-3 h-10 w-full ${pulse}`} />
    </div>

    <div className="rounded-2xl border border-gray-200/70 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className={`h-16 w-full ${pulse}`} />
        ))}
      </div>
    </div>
  </div>
);

const DetailSkeleton = () => (
  <div className="space-y-5">
    <div className={`h-4 w-56 ${pulse}`} />

    <div className="rounded-[2rem] border border-gray-200/70 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
      <div className={`h-8 w-72 ${pulse}`} />
      <div className={`mt-3 h-4 w-full ${pulse}`} />
      <div className={`mt-2 h-4 w-4/5 ${pulse}`} />
    </div>

    <div className="grid gap-5 xl:grid-cols-3">
      <div className="space-y-3 xl:col-span-2">
        <div className={`h-52 w-full ${pulse}`} />
        <div className={`h-36 w-full ${pulse}`} />
      </div>
      <div className={`h-96 w-full ${pulse}`} />
    </div>
  </div>
);

const FormSkeleton = () => (
  <div className="space-y-6">
    <div className={`h-6 w-60 ${pulse}`} />
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className={`h-44 w-full ${pulse}`} />
        <div className={`h-44 w-full ${pulse}`} />
        <div className={`h-44 w-full ${pulse}`} />
      </div>
      <div className="space-y-4">
        <div className={`h-36 w-full ${pulse}`} />
        <div className={`h-36 w-full ${pulse}`} />
      </div>
    </div>
  </div>
);

const StudioPageSkeleton: React.FC<StudioPageSkeletonProps> = ({
  variant = 'dashboard',
  rows = 6,
}) => {
  if (variant === 'list') {
    return <ListSkeleton rows={Math.max(3, rows)} />;
  }

  if (variant === 'detail') {
    return <DetailSkeleton />;
  }

  if (variant === 'form') {
    return <FormSkeleton />;
  }

  return <DashboardSkeleton />;
};

export default StudioPageSkeleton;
