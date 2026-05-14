import React from 'react';

const ProfileHeaderSkeleton: React.FC = () => {
  return (
    <div className="w-full animate-pulse">
      <div className="relative rounded-3xl overflow-hidden">
        <div className="h-64 w-full rounded-3xl bg-gray-200 dark:bg-gray-700" />
        <div className="absolute top-3 left-3 h-10 w-28 rounded-full bg-gray-300/80 dark:bg-gray-600/80" />
      </div>

      <div className="-mt-16 px-4 sm:-mt-20 sm:px-6">
        <div className="relative z-20 flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="shrink-0 rounded-xl border-2 border-gray-300 surface-card">
            <div className="h-40 w-40 rounded-xl surface-control-muted sm:h-44 sm:w-44 md:h-52 md:w-52" />
          </div>

          <div className="mt-4 flex flex-1 flex-col gap-2 sm:mt-2">
            <div className="h-7 w-56 rounded-md bg-gray-200 dark:bg-gray-700" />
            <div className="h-5 w-48 rounded-md bg-gray-200 dark:bg-gray-700" />
            <div className="h-5 w-36 rounded-md bg-gray-200 dark:bg-gray-700" />
            <div className="mt-2 flex flex-wrap gap-2">
              <div className="h-6 w-24 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="h-6 w-28 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="h-6 w-20 rounded-full bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>

          <div className="mt-1 flex items-center gap-2 self-end sm:self-start">
            <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeaderSkeleton;