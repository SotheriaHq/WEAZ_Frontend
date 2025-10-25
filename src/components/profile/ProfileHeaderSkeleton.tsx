import React from 'react';

const ProfileHeaderSkeleton: React.FC = () => {
  return (
    <div className="w-full animate-pulse">
      {/* Container for banner and overlapping avatar */}
      <div className="relative mb-16">
        {/* Banner Skeleton */}
        <div className="h-48 rounded-lg bg-gray-200 dark:bg-gray-700"></div>

        {/* QR Code Skeleton */}
        <div className="absolute top-4 right-4 h-20 w-20 rounded-md bg-gray-300 dark:bg-gray-600"></div>
        
        {/* Profile Image Skeleton */}
        <div className="absolute left-6 -bottom-12 w-32 h-32 rounded-full border-4 border-white dark:border-gray-900 bg-gray-300 dark:bg-gray-600"></div>
      </div>

      {/* Profile Info & Actions Skeleton */}
      <div className="px-6">
        <div className="flex justify-between items-start">
          {/* Left side: Info Skeleton */}
          <div className="flex-1">
            <div className="pl-[132px + 1rem]">
              <div className="h-7 w-48 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded-md mt-2"></div>
            </div>
            {/* Tags Skeleton */}
            <div className="mt-4 flex flex-wrap gap-2">
              <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              <div className="h-6 w-28 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            </div>
          </div>
          
          {/* Right side: Action Buttons Skeleton */}
          <div className="flex items-center gap-2 mt-1">
            <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeaderSkeleton;